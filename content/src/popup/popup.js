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

class Popup {
    constructor(options) {
        // Initialize and react to changes on the enable-add-on checkbox.
        this.enableAddonCheckbox = document.getElementById('addonEnabled');
        this.enableAddonCheckbox.addEventListener('change', this.onEnableAddonCheckboxChanged.bind(this));

        // Initialize and react to changes on the color chooser.
        this.colorChooser = new ColorChooser(options);

        // Initialize and react to changes on the opacity slider.
        this.opacitySlider = document.getElementById('opacitySlider');
        this.opacitySlider.addEventListener('input', this.onOpacitySliderMoved.bind(this));

        // Initialize and react to changes on the enable-for-domain checkbox.
        this.enableForDomainCheckbox = document.getElementById('enableForDomain');
        this.enableForDomainCheckbox.addEventListener('change', this.onEnableForDomainCheckboxChanged.bind(this));

        // Initialize and react to changes on the enable-for-page checkbox.
        this.enableForPageCheckbox = document.getElementById('enableForPage');
        this.enableForPageCheckbox.addEventListener('change', this.onEnableForPageCheckboxChanged.bind(this));

        this.applyOptions(options);
    }

    applyOptions(options) {
        this.options = options;

        this.loadI18nStrings();

        this.enableAddonCheckbox.checked = options.addonEnabled;
        this.opacitySlider.value = options.opacity;
        this.enableForDomainCheckbox.checked = options.domainEnabled;
        this.enableForPageCheckbox.checked = options.pageEnabled;

        this.enableElements();
    }

    loadI18nStrings() {
        document.getElementById('popupHeading').innerText = browser.i18n.getMessage('extensionName');
        document.getElementById('addonEnabledText').innerText = browser.i18n.getMessage('enableReadingRuler');
        document.getElementById('colorHeading').innerText = browser.i18n.getMessage('colorHeading');
        document.getElementById('opacityHeading').innerText = browser.i18n.getMessage('opacityHeading');
        document.getElementById('enableForPageText').innerText = browser.i18n.getMessage('showOnThisPage');
        document.getElementById('enableForDomainText').innerText = browser.i18n.getMessage('showOnAllPagesOf', this.options.host);
    }

    enableElements() {
        document.getElementById('form').classList.toggle('disabled', !this.options.addonEnabled);
        this.colorChooser.disabled = !this.options.addonEnabled;
        this.opacitySlider.disabled = !this.options.addonEnabled;
        this.enableForDomainCheckbox.disabled = !this.options.addonEnabled;
        this.enableForPageCheckbox.disabled = !this.options.addonEnabled;
    }

    async onEnableAddonCheckboxChanged(e) {
        this.options.addonEnabled = e.target.checked;
        await this.options.write();
        this.enableElements();
    }

    async onOpacitySliderMoved(e) {
        this.options.opacity = this.opacitySlider.value;
        await this.options.write();
    }

    // Initialize and react to changes on the enable-for-domain checkbox.
    async onEnableForDomainCheckboxChanged(e) {
        this.options.domainEnabled = e.target.checked;
        await this.options.write();
    }

    // Initialize and react to changes on the enable-for-page checkbox.
    async onEnableForPageCheckboxChanged(e) {
        this.options.pageEnabled = e.target.checked;
        await this.options.write();
    }

}

/**
 * This is the entry point for the add-on's "popup" script.  This script
 * executes in the tiny web "page" showing the add-on's dropdown menu when
 * you click the add-on's icon.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Activate the ruler when the popup is shown.
    broadcast(EXTENSION_COMMANDS.activate);

    // Read the add-on's options.
    const tab = await getCurrentTab();
    const options = new Options(tab.url);
    await options.read();
    await options.broadcast();

    const popup = new Popup(options);

    // Activate the ruler when entering the popup.  This gives direct feedback
    // to what option changes look like, and counters the deactivation of the
    // ruler when the mouse exits the window to open the popup.
    document.documentElement.addEventListener('mouseenter', e => broadcast(EXTENSION_COMMANDS.activate));
    document.documentElement.addEventListener('mouseleave', e => broadcast(EXTENSION_COMMANDS.deactivate));

    // Deactivate the ruler when the popup closes.
    window.addEventListener('blur', e => {
        if (e.target === window) {
            broadcast(EXTENSION_COMMANDS.deactivate);
        }
    });
}, false);
