// TICKER (AKA TOGGLE BUTTON AND BADGE)

"use strict";

// Updates the internal and external timer mode indications.
// Called when user changes the mode and on initialization/startup.
var set_listeners_for_timer_mode = (mode) => {
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
        browser.tabs.onUpdated.removeListener(tabs_activated_updated_blue_mode);
        browser.tabs.onUpdated.removeListener(tabs_on_updated);
        browser.tabs.onActivated.removeListener(tabs_activated_updated_blue_mode);
        browser.tabs.onActivated.removeListener(tabs_on_activated);
        browser.tabs.onRemoved.removeListener(tabs_on_removed);
        browser.windows.onFocusChanged.removeListener(windows_on_focus_changed);

    } else if (mode === 'B') {
        browser.tabs.onUpdated.removeListener(tabs_on_updated);
        browser.tabs.onActivated.removeListener(tabs_on_activated);
        browser.tabs.onUpdated.addListener(tabs_activated_updated_blue_mode);
        browser.tabs.onActivated.addListener(tabs_activated_updated_blue_mode);
        browser.tabs.onRemoved.addListener(tabs_on_removed);
        browser.windows.onFocusChanged.addListener(windows_on_focus_changed);

    } else {
        browser.tabs.onUpdated.removeListener(tabs_activated_updated_blue_mode);
        browser.tabs.onActivated.removeListener(tabs_activated_updated_blue_mode);
        browser.tabs.onUpdated.addListener(tabs_on_updated);
        browser.tabs.onActivated.addListener(tabs_on_activated);
        browser.tabs.onRemoved.addListener(tabs_on_removed);
        browser.windows.onFocusChanged.addListener(windows_on_focus_changed);
    }
};

// updates the time shown in the button badge ticker
var update_ticker_default = (secsHere, totalSecs) => {
    let value = secsHere ? format_time_minimal(secsHere) : "0";
    browser.browserAction.setBadgeText({ text: value });
};

var update_ticker_total_secs = (secsHere, totalSecs) => {
    browser.browserAction.setBadgeText( {text: format_time_minimal(totalSecs) });
};

var update_ticker;

async function set_ticker_update_function(mode) {
    try {
        let fromStorage = await STORAGE.get('oButtonBadgeTotal');
        if (mode === 'O') {
            update_ticker = () => null;
        } else if (mode === 'B' || fromStorage.oButtonBadgeTotal) {
            update_ticker = update_ticker_total_secs;
        } else {
            update_ticker = update_ticker_default;
        }
    } catch (e) { console.error(e); }
};

// For updating the time shown in the popup ticker. Returns a promise/string.
async function get_popup_ticker_default() {
    try {
        let url = await get_current_url(),
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

var set_popup_ticker_function = (mode) => {
    get_popup_ticker = mode === 'B' ? get_popup_ticker_total_only : get_popup_ticker_default;
};

var set_badge_for_timer_mode = (mode) => {
    if (mode === 'O') {
        browser.browserAction.setBadgeText({ text: "" });
    } else {
        let defaultColor = '#404040',
            colors = { 'G': "#00aa00", 'B': "#5555dd", 'O': defaultColor, 'D': defaultColor },
            newColor = colors[mode];
        browser.browserAction.setBadgeBackgroundColor({ color: newColor });
    }
};
