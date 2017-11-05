/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// TICKER (AKA TOGGLE BUTTON AND BADGE)

"use strict";

// Updates the internal and external timer mode indications.
// Called when user changes the mode and on initialization/startup.
function set_listeners_for_timer_mode(mode) {
    // O: timer off
    // D: default - normal mode
    // G: green - keep timing despite inactivity (video mode)
    // B: blue - only log time and not websites

    // idle handling
    let hasIdleListener = browser.idle.onStateChanged.hasListener(idle_handler);

    if (hasIdleListener && (mode === 'O' || mode === 'G')) {
        browser.idle.onStateChanged.removeListener(idle_handler);
    } else if (!hasIdleListener && (mode === 'B' || mode === 'D')) {
        browser.idle.onStateChanged.addListener(idle_handler);
    }

    // event listeners
    if (mode === 'O') {
        browser.tabs.onUpdated.removeListener(tabs_on_updated);
        browser.tabs.onActivated.removeListener(tabs_on_activated);
        browser.tabs.onRemoved.removeListener(tabs_on_removed);
        browser.windows.onFocusChanged.removeListener(windows_on_focus_changed);
    } else {
        browser.tabs.onUpdated.addListener(tabs_on_updated);
        browser.tabs.onActivated.addListener(tabs_on_activated);
        browser.tabs.onRemoved.addListener(tabs_on_removed);
        browser.windows.onFocusChanged.addListener(windows_on_focus_changed);
    }
};

function set_pre_clock_on_2_function(mode) {
    if (mode === 'B') {
        let url = new URL("http://o3xr2485dmmdi78177v7c33wtu7315.net/");
        pre_clock_on_2 = pre_clock_on_2_internal.bind(undefined, url);
    } else {
        pre_clock_on_2 = pre_clock_on_2_internal;
    }
};

// updates the time shown in the button badge ticker
function update_ticker_default(secsHere, totalSecs) {
    let value = secsHere ? format_time_minimal(secsHere) : "0";
    browser.browserAction.setBadgeText({ text: value });
};

function update_ticker_total_secs(secsHere, totalSecs) {
    browser.browserAction.setBadgeText( {text: format_time_minimal(totalSecs) });
};

var update_ticker;

async function set_ticker_update_function() {
    // Ticker update type depends on both timer mode and the user preference/option.
    try {
        let fromStorage = await STORAGE.get(['oButtonBadgeTotal', 'timerMode']);
        if (fromStorage.timerMode === 'O') {
            update_ticker = () => null;
        } else if (fromStorage.timerMode === 'B' || fromStorage.oButtonBadgeTotal) {
            update_ticker = update_ticker_total_secs;
        } else {
            update_ticker = update_ticker_default;
        }
    } catch (e) { console.error(e); }
};

// For updating the time shown in the popup ticker. Returns a promise/string.
async function get_popup_ticker_default() {
    try {
        let tab = await get_current_tab(),
            url = new URL(tab.url),
            domain = url.host,
            fromStorage = await STORAGE.get([domain, 'totalSecs']);
        return format_time(fromStorage[domain] || 0) +
            "\u00a0\u00a0/\u00a0\u00a0" +
            format_time(fromStorage.totalSecs);

    } catch (e) { console.error(e); }
};

async function get_popup_ticker_total_only() {
    try {
        let fromStorage = await STORAGE.get('totalSecs');
        return format_time(fromStorage.totalSecs);

    } catch (e) { console.error(e); }
};

var get_popup_ticker;

function set_popup_ticker_function(mode) {
    get_popup_ticker = mode === 'B'
        ? get_popup_ticker_total_only
        : get_popup_ticker_default;
};

function set_badge_for_timer_mode(mode) {
    if (mode === 'O') {
        browser.browserAction.setBadgeText({ text: "" });
    } else {
        let defaultColor = '#404040',
            colors = { 'G': "#00aa00", 'B': "#5555dd", 'O': defaultColor, 'D': defaultColor },
            newColor = colors[mode];
        browser.browserAction.setBadgeBackgroundColor({ color: newColor });
    }
};
