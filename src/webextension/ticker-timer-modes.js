// TICKER (AKA TOGGLE BUTTON AND BADGE)

"use strict";

// set button badge color
// browser.browserAction.setBadgeBackgroundColor({ color: '#404040' });

// updates the time shown in the ticker (aka button badge)
var update_ticker_default = (secsHere, totalSecs) => {
    let value = secsHere ? format_time_minimal(secsHere) : "0";
    browser.browserAction.setBadgeText({ text: value });
};

var update_ticker_total_secs = (secsHere, totalSecs) => {
    browser.browserAction.setBadgeText( {text: format_time_minimal(totalSecs) });
};

// use var so this is accessible from external scopes
var update_ticker;


// TIMER MODE

// updates the internal and external timer mode indications
// called when user changes the mode and on initialization/startup
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

async function set_ticker_update_function(mode) {
    try {
        let result = await STORAGE.get('oButtonBadgeTotal');
        if (mode === 'O') {
            update_ticker = () => null;
        } else if (mode === 'B' || result.oButtonBadgeTotal) {
            update_ticker = update_ticker_total_secs;
        } else {
            update_ticker = update_ticker_default;
        }
    } catch (e) {
        console.error(e);
    }
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
