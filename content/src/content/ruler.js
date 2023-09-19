/*
 * Copyright 2020-2022 Oren Trutner
 *
 * This file is part of Reading Ruler.
 *
 * Reading Ruler is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Reading Ruler is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Reading Ruler.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Represents a "ruler" that highlights a row of text.
 * A ruler uses a visualizer object to do the actual highlighting.
 */
class Ruler {
    constructor(visualizer = null) {
        this.enabled = false;   // enabled unless the user turned it off
        this.appearance = 'ruler';
        this.forcedVisualizer = visualizer;
        this.visualizer = visualizer || new HighlightVisualizer();
        this.latestRowBounds = null;
        this.latestPosition = null;
        this.options = {};

        this.visualizer.addToDocument();
    }

    // Public methods

    /** Applies a snapshot of an Options object. */
    applyOptions(optionsSnapshot) {
        this.enableIf(optionsSnapshot.enabled);
        this.setAppearance(optionsSnapshot.appearance);
        this.setColor(optionsSnapshot.color);
        this.setOpacity(optionsSnapshot.opacity);
    }

    /** Enables or disables the ruler, based on the given input. */
    enableIf(enable) {
        if (enable) {
            this.enable();
        } else {
            this.disable();
        }
    }

    /** Enables the ruler.  It will stay enabled until explicitly disabled. */
    enable() {
        this.enabled = true;
        this.show();
    }

    /** Disables the ruler.  It will stay disabled until explicitly enabled. */
    disable() {
        this.enabled = false;
        this.hide();
    }

    /** Activates the ruler, if it was temporarily deactivated. */
    activate() {
        this.show();
    }

    /** Temporarily deactivates the ruler. */
    deactivate() {
        this.hide();
    }

    /** Sets the ruler's appearance. */
    setAppearance(newAppearance) {
        if (this.appearance === newAppearance) {
            return;
        }

        // Keep the new appearance.
        this.appearance = newAppearance;

        // Replace the visualizer, if the new appearance requires it.
        const newVisualizer = this.forcedVisualizer || Ruler.VISUALIZER_BY_APPEARANCE[newAppearance] || Ruler.VISUALIZER_BY_APPEARANCE["ruler"];
        if (this.visualizer !== newVisualizer) {
            // Remove the old visualizer.
            this.visualizer.hide();
            this.visualizer.removeFromDocument();

            // Bring in the new visualizer.
            this.visualizer = newVisualizer;
            this.visualizer.addToDocument();
        }

        // Show and position the new visualizer.
        this.show();
        this.positionAtLatest();

        this.visualizer.setColor(this.options.color);
        this.visualizer.setOpacity(this.options.opacity);
    }

    /** Sets the ruler's color. */
    setColor(newColor) {
        this.options.color = newColor;
        this.visualizer.setColor(newColor);
    }

    /** Sets the ruler's opacity. */
    setOpacity(newOpacity) {
        this.options.opacity = newOpacity;
        this.visualizer.setOpacity(newOpacity);
    }

    /**
     * Positions and shows the ruler on the text row around a mouse coordinate.
     * As a performance optimization, only makes a change if the coordinate
     * exited the previously highlighted row.
     */
    positionAroundIfRowExited(x, y) {
        if (!this.enabled || (this.latestRowBounds && rectContains(this.latestRowBounds, x, y))) {
            return;
        }

        this.positionAround(x, y)
    }

    /**
     * Positions and shows the ruler on the text row around a mouse coordinate.
     */
    positionAround(x, y) {
        // Do nothing if disabled.
        if (!this.enabled) {
            return;
        }

        // Find the row bounds.
        const rowBounds = this.latestRowBounds = this.boundsAroundPoint(x, y);
        if (!rowBounds) {
            this.stash();
            return;
        }
        roundRect(rowBounds);

        // Make sure the ruler is visible.
        this.activate();

        // Position the ruler.
        inflateRect(rowBounds, Ruler.PADDING.x, Ruler.PADDING.y);
        this.positionAt(rowBounds);
    }

    /**
     * Positions and shows the ruler over a rectangle relative to a given
     * iframe.
     */
    positionOnFrame(frameWindow, rect) {
        const frame = frameFromWindow(frameWindow);
        const frameRect = frame.getBoundingClientRect();
        const frameStyle = window.getComputedStyle(frame);
        const rulerRect = translatedRect(
            rect,
            frameRect.left + parseInt(frameStyle.paddingLeft) + parseInt(frameStyle.borderLeftWidth),
            frameRect.top + parseInt(frameStyle.paddingTop) + parseInt(frameStyle.borderTopWidth));
        roundRect(rulerRect);
        this.activate();
        this.positionAt(rulerRect);
    }

    // Private methods

    /** Shows the ruler. */
    show() {
        if (this.enabled) {
            this.visualizer.show();
        }
    }

    /** Hides the ruler. */
    hide() {
        this.visualizer.hide();
    }

    /** Temporarily hides the ruler. */
    stash() {
        this.visualizer.stash();
        this.latestPosition = null;
    }

    /**
     * Positions the visualizer in the latest position it was in.
     * This is useful after changing visualizers.
     */
    positionAtLatest() {
        if (this.latestPosition) {
            this.visualizer.positionAt(this.latestPosition);
        }
    }

    /** Positions and sizes the ruler to cover a specific rectangle. */
    positionAt(rect) {
        if (!rectsAreEqual(rect, this.latestPosition)) {
            this.visualizer.positionAt(rect);
            this.latestPosition = rect;
        }
    }

    /**
     * Gets the bounds of the DOM element to highlight at a given mouse
     * coordinate.  Returns null if the element at that location shouldn't be
     * highlighted.
     */
    boundsAroundPoint(x, y) {
        // Find the DOM element at the given coordinate.
        const caretInfo = caretAtOrNear(x, y, Ruler.SAMPLE_COUNT);
        if (!caretInfo || !caretInfo.node) {
            return null;
        }

        // Get the shape of the DOM element.
        const element = this.ancestorBlockElement(caretInfo.node.parentElement, 3);
        const elementRect = element.getBoundingClientRect();

        // Position and size the ruler to highlight the DOM element.
        switch (caretInfo.node.nodeType) {
            case 1: // A non-text highlight-worthy element
                // Highlight the entire element.
                if (Ruler.ELEMENTS_TO_HIGHLIGHT.has(caretInfo.node.nodeName.toLowerCase())) {
                    return elementRect;
                } else {
                    return null;
                }
            case 3: // text
                // Highlight just the row under the mouse, not the entire
                // paragraph.
                return this.getTextElementBounds(element, caretInfo);
            default: return null;
        }
    }

    getTextElementBounds(textElement, caretInfo) {
        const elementRect = textElement.getBoundingClientRect();
        const writingMode = window.getComputedStyle(textElement).writingMode;

        if (writingMode.includes('vertical')) {
            // caretInfo.rect.width is 0 for some reasons
            // let's use font's size as a size
            const fontSize = parseInt(window.getComputedStyle(textElement).fontSize) || 0;
            return {
                x: caretInfo.rect.x,
                y: elementRect.y,
                width: fontSize,
                height: elementRect.height
            };
        }

        return {
            x: elementRect.x,
            y: caretInfo.rect.y,
            width: elementRect.width,
            height: caretInfo.rect.height
        };
    }

    /**
     * Gets the nearest ancestor block element of a given element.
     * Scans up to the given number of levels.
     * Returns null if the root of the DOM tree is reached, or the last ancestor
     * looked at if no block ancestor is found within the limit.
     */
    ancestorBlockElement(element, levels) {
        for (var level = 0;
            level < levels && element;
            ++level, element = element.parentElement) {

            if (window.getComputedStyle(element).display === 'block') {
                return element;
            }
        }

        return element;
    }
}

Ruler.SAMPLE_COUNT = 5;
Ruler.ELEMENTS_TO_HIGHLIGHT = new Set(['hg', 'img', 'svg', 'video']);
Ruler.PADDING = { x: 4, y: 2 };
Ruler.VISUALIZER_BY_APPEARANCE = {
    "ruler": new HighlightVisualizer(),
    "negative": new NegativeVisualizer()
};