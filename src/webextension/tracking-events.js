// TIME-TRACKING

"use strict";

/*
The big idea is there are two main operations. First, 'clock on' temporarily
stores a domain and a starting time stamp for that domain.  Second, 'clock off'
calculates the time elapsed since the time stamp for the domain, and adds that
to the tally in storage for that domain.  It then clears the domain and the time
stamp data.  Various events trigger a clock off attempt first and then clock on.
Clock off is always tried before clock on so that any time is logged before a
new timing 'cycle' begins.
*/

var get_next_alert_at = (aRateInMins, aTotalSecs) => {
    let rateSecs = aRateInMins * 60;
    return aTotalSecs + (rateSecs - (aTotalSecs % rateSecs));
};

var get_notification_message = (aStorage) => {
    let domainData = extract_domain_data(aStorage),
        domainsArray = get_sorted_domains(domainData),
        topFive = domainsArray.slice(0, 3),
        reducer = (msg, dmn) => msg + format_time(dmn[1]) + "  " + dmn[0] + "\n",
        message = topFive.reduce(reducer, "");
    return message;
};

async function show_notification(minutes) {
    try {
        let storage = await STORAGE.get(null),
            message = await get_notification_message(storage),
            id = await browser.notifications.create({
                "type": "basic",
                "iconUrl": browser.extension.getURL("icons/hourglass-icon-64.png"),
                "title": minutes + " Today",
                "message": message
            });
        setTimeout(() => {
            browser.notifications.clear(id);
            gState.notificationIsShowing = false;
        }, 8000);

    } catch (e) { console.error(e); }
};

async function maybe_show_notification() {
    try {
        let fromStorage = await STORAGE.get([
                "totalSecs",
                "oNotificationsOn",
                "oNotificationsRate",
                "nextAlertAt"
            ]),
            totalSecs = fromStorage.totalSecs;

        if (fromStorage.oNotificationsOn &&
            fromStorage.oNotificationsRate > 0 &&
            totalSecs >= fromStorage.nextAlertAt) {

            // somehow we got duplicate notifications, so we prevent that
            let minutes = format_time(totalSecs);
            if (minutes !== gState.notificationsMinutes) {
                gState.notificationsMinutes = minutes;
                show_notification(minutes);
            }
            let next = get_next_alert_at(fromStorage.oNotificationsRate, totalSecs);
            STORAGE.set({nextAlertAt: next});
        }
    } catch (e) { console.error(e); }
};

async function log_seconds(aDomain, aRawSeconds) {
    try {
        let fromStorage = await STORAGE.get(["totalSecs", aDomain]),
            oldSeconds = fromStorage[aDomain] || 0,
            // Round to two decimal places.
            newSeconds = Math.round(aRawSeconds * 100) / 100,
            newData = {totalSecs: fromStorage.totalSecs + newSeconds};

        console.log('log_seconds', newSeconds, aDomain);

        newData[aDomain] = oldSeconds + newSeconds;
        STORAGE.set(newData);

    } catch (e) { console.error(e); }
};

async function maybe_clock_off(aStartStamp, aTimingDomain) {
    console.log('maybe_clock_off', aTimingDomain, aStartStamp);
    try {
        if (aStartStamp) {
            console.log('clock off', aTimingDomain, aStartStamp);

            clearTimeout(gState.clockOnTimeout);

            // Clear timing data so we don't clock off again until after clock on.
            Object.assign(gState.timing, {
                domain: null,
                stamp: null
            });

            let rawSeconds = (Date.now() - aStartStamp) / 1000;
            if (rawSeconds > 0.5) {
                await log_seconds(aTimingDomain, rawSeconds);
                maybe_show_notification();
            }
        }
    } catch (e) { console.error(e); }
};

var get_clock_on_timeout_MS = (aTotalSecs) => {
    // Wait at least some minimum amount.
    let secsUntilNextMinute = (62 - (aTotalSecs % 60)),
        min = 5,
        secs = secsUntilNextMinute > min ? secsUntilNextMinute : min;
    return secs * 1000;
};

function restart_clock_on_timeout(aTotalSecs) {
    // Restarts the timeout for re-clocking-off/on.
    // We set this timeout to clock off and on again after the next minute
    // threshold has passed, to update the ticker, notifications, etc. when
    // the user has been active at same site/tab for more than a minute.
    let ms = get_clock_on_timeout_MS(aTotalSecs);
    gState.clockOnTimeout = setTimeout(clock_on_timeout_function, ms);
}

async function clock_on(aDomain) {
    // Starts timing for a site.
    console.log('clock_on', aDomain);

    // Clock off should always happen before clock on, and it sets
    // gState.timing values to null, so we warn and redo the clock off if not.
    if (gState.timing.stamp && gState.timing.domain) {
        console.warn("Mind the Time: clock on without prior clock off");
        await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
    }
    Object.assign(gState.timing, {
        domain: aDomain,
        stamp: Date.now()
    });
};

var is_clockable_protocol = (aProt) => (aProt === 'http:' || aProt === 'https:');

async function get_current_url() {
    // returns a promise that resolves to the url of the active window/tab
    try {
        let tabs = await browser.tabs.query({currentWindow: true, active: true});
        return tabs[0].url;

    } catch (e) { console.error(e); }
};

async function pre_clock_on_2(aUrl) {
    // Maybe starts a new day, updates the ticker, and maybe clocks on.
    try {
        let urlString = aUrl || await get_current_url(),
            url = new URL(urlString),
            domain = url.host,
            dateNow = Date.now(),
            fromStorage = await STORAGE.get([
                "nextDayStartsAt",
                "oWhitelistArray",
                "totalSecs",
                domain
            ]);

        // console.log('hours until new day:', (fromStorage.nextDayStartsAt - dateNow) / 3600000);
        if (dateNow > fromStorage.nextDayStartsAt) {
            await start_new_day(dateNow);
        }

        // Only clock on if the domain has a clockable url protocol
        // (http/https) and it is not in the whitelist.
        if (is_clockable_protocol(url.protocol) &&
            !fromStorage.oWhitelistArray.includes(domain)) {

            let seconds = fromStorage[domain] || 0;
            update_ticker(seconds, fromStorage.totalSecs);
            clock_on(domain);
            restart_clock_on_timeout(fromStorage.totalSecs)
        } else {
            update_ticker(0, fromStorage.totalSecs);
        }
    } catch (e) { console.error(e); }
};

var pre_clock_on = (aUrl) => {
    // avoid redundant clock_on calls for the same event
    clearTimeout(gState.preClockOnTimeout);
    gState.preClockOnTimeout = setTimeout(pre_clock_on_2.bind(null, aUrl), 50);
};


// EVENT HANDLING

async function tabs_on_updated(tabId, changeInfo, tab) {
    try {
        if (changeInfo.url) {
            console.log('! tabs.onUpdated', tabId, changeInfo, tab);
            await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
            pre_clock_on(changeInfo.url);
        }
    } catch (e) { console.error(e); }
};

async function tabs_on_activated(activeInfo) {
    console.log('! tabs.onActivated', activeInfo);
    try {
        let tabInfo = await browser.tabs.get(activeInfo.tabId);
        await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
        pre_clock_on(tabInfo.url);

    } catch (e) { console.error(e); }
};

async function tabs_activated_updated_blue_mode() {
    console.log('! tabs_activated_updated_blue_mode');
    try {
        await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
        pre_clock_on("http://o3xr2485dmmdi78177v7c33wtu7315.net/");

    } catch (e) { console.error(e); }
};

var tabs_on_removed = (tabId, removeInfo) => {
    console.log('! tabs.onRemoved', removeInfo);
    maybe_clock_off(gState.timing.stamp, gState.timing.domain);
};

async function windows_on_focus_changed(windowId) {
    console.log('! windows.onFocusChanged', windowId);
    try {
        await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
        if (windowId !== -1) {
            pre_clock_on();
        }
    } catch (e) { console.error(e); }
};

async function clock_on_timeout_function() {
    console.log('! clock_on_timeout_function');
    try {
        await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
        pre_clock_on();

    } catch (e) { console.error(e); }
};


// IDLE TIMEOUT / USER ACTIVITY DETECTION

// when user is idle for IDLE_TIMEOUT_SECS we clock off, then when user becomes
// active again we clock back on
async function idle_handler(aIdleState) {
    // console.log('idle state:', aIdleState);
    try {
        let windowInfo = await browser.windows.getLastFocused();

        let d = new Date;
        console.log('! idle-state:', aIdleState, 'window-focused:', windowInfo.focused, d.getHours() + ':' + d.getMinutes());

        if (windowInfo.focused) {
            await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
            if (aIdleState === "active") {
                pre_clock_on();
            }
            // else aIdleState is 'idle' or 'locked' and we just clock off and do no more
        }
    } catch (e) { console.error(e); }
};


// STORAGE CHANGE LISTENER

// For logging of storage changes, just show the new values.
/*
var storage_change_inspector = (changes) => {
    let keys = Object.keys(changes);
    let result = {};
    for (let key of keys) {
        result[key] = changes[key].newValue;
    }
    return result;
};
*/

async function handle_whitelist_change() {
    // If the whitelist changed, we clear the current domain so we don't
    // accidentally log a site that was added to the whitelist.
    try {
        await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
        pre_clock_on();

    } catch (e) { console.error(e); }
};

async function handle_day_start_offset_change(aDayStartOffset) {
    let dateNow = Date.now(),
        date = get_date_with_offset(aDayStartOffset, aDateNow),
        dayNum = get_day_number(date),
        next = get_next_day_starts_at(dayNum, aDayStartOffset);
    try {
        await STORAGE.set({nextDayStartsAt: next});

        // Start a new day if the new day offset is moved into the past.
        let fromStorage = await STORAGE.get('today');
        if (dayNum > fromStorage.today.dayNum) {
            start_new_day(dateNow);
        }
    } catch (e) { console.error(e); }
};

async function handle_notifications_change() {
    try {
        let fromStorage = await STORAGE.get(["oNotificationsRate", "totalSecs"]),
            next = get_next_alert_at(fromStorage.oNotificationsRate, fromStorage.totalSecs);
        STORAGE.set({nextAlertAt: next});

    } catch (e) { console.error(e); }
};

async function handle_timer_mode_change(mode) {
    try {
        await maybe_clock_off(gState.timing.stamp, gState.timing.domain);
        set_listeners_for_timer_mode(mode);
        set_ticker_update_function(mode);
        set_popup_ticker_function(mode);
        set_badge_for_timer_mode(mode);
        pre_clock_on();

    } catch (e) { console.error(e); }
};

// Even when a new value is the same as the old value it will fire this listener.
// Note that options are typically all changed at once (but maybe not actually
// changed) when save button is clicked.
browser.storage.onChanged.addListener((changes, area) => {
    // console.log('storage changed', storage_change_inspector(changes));

    // when we clear storage for delete all data everything is undefined so check for that
    // this is involved in initialization for the timer mode on app install / restart
    if (changes.timerMode && changes.timerMode.newValue) {
        handle_timer_mode_change(changes.timerMode.newValue);
    }
    if ((changes.oNotificationsOn || changes.oNotificationsRate) &&
       (changes.oNotificationsOn.newValue || changes.oNotificationsRate.newValue)) {
        handle_notifications_change();
    }
    if (changes.oDayStartOffset &&
        // The newValue can be 0 (a JS falsy value).
        !is_null_or_undefined(changes.oDayStartOffset.newValue) &&
        changes.oDayStartOffset.newValue !== changes.oDayStartOffset.oldValue) {
        handle_day_start_offset_change(changes.oDayStartOffset.newValue);
    }
    if (changes.oWhitelistArray && changes.oWhitelistArray.newValue) {
        handle_whitelist_change();
    }
});
