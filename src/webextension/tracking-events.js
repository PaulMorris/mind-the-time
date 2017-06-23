// TIME-TRACKING

"use strict";

// auxiliary functions

var get_next_alert_at = (aRateInMins, aTotalSecs) => {
    let rateSecs = aRateInMins * 60;
    return aTotalSecs + (rateSecs - (aTotalSecs % rateSecs));
};

var show_notification = (minutes) => {
    browser.notifications.create({
        "type": "basic",
        "iconUrl": browser.extension.getURL("icons/hourglass-icon-64.png"),
        "title": "Mind the Time - " + minutes,
        "message": ""
    }).then(id => {
        setTimeout(() => {
            browser.notifications.clear(id);
            gState.notificationIsShowing = false;
        }, 8000);
    });
};

async function log_seconds(aDomain, aSeconds) {
    console.log('logging ', aSeconds, "seconds at", aDomain);
    let result;
    try {
        result = await STORAGE.get([
            "totalSecs",
            "oNotificationsOn",
            "oNotificationsRate",
            "nextAlertAt",
            aDomain
        ]);
    } catch (e) { console.error(e); }

    let oldSeconds = result[aDomain] || 0,
        currentSecs = oldSeconds + aSeconds,
        newTotalSecs = result.totalSecs += aSeconds,

        // currentDomainSecs is stored for access by the button panel, that displays it
        newData = {
            totalSecs: newTotalSecs,
            currentDomainSecs: currentSecs
        };

    newData[aDomain] = currentSecs;

    // show a notification?
    if (result.oNotificationsOn &&
        result.oNotificationsRate > 0 &&
        newTotalSecs >= result.nextAlertAt) {
            // somehow we were getting duplicate notifications, so we prevent that
            let minutes = format_time(newTotalSecs);
            if (minutes !== gState.notificationsMinutes) {
                gState.notificationsMinutes = minutes;
                show_notification(minutes);
            }
            let next = get_next_alert_at(result.notificationsRate, newTotalSecs);
            newData.nextAlertAt = next;
    }
    STORAGE.set(newData).catch(e => console.error(e));
};

// stops timing and adds elapsed time to totals
var maybe_clock_off = (aState) => {
    if (aState.startStamp) {
        console.log('clock off');
        let startStamp = aState.startStamp;

        // null timestamp means don't clock off again until after clock on
        aState.startStamp = null;
        clearTimeout(aState.clockOnTimeout);

        // calculate how many seconds have passed, rounding to two decimal places
        let rawSeconds = ( Date.now() - startStamp ) / 1000;
        if (rawSeconds > 1) {
            let seconds = Math.round( rawSeconds * 100 ) / 100;
            log_seconds(aState.timingDomain, seconds);
        }
    }
};

var get_clockable_domain = (aDomain, aWhitelistArray, aUrl) => {
    let urlObj = new URL(aUrl),
        dom = urlObj.host;

    // Only deal with url if it is different from last clock on
    if (dom !== aDomain) {
        let protocol = urlObj.protocol;
        if ((protocol !== 'http:' && protocol !== 'https:') ||
            aWhitelistArray.includes(dom)) {
            return false;
        }
    }
    return dom;
};

var get_clock_on_timeout_MS = (aTotalSecs) => {
    // Wait at least some minimum amount.
    let secsUntilNextMinute = (62 - (aTotalSecs % 60)),
        min = 5,
        secs = secsUntilNextMinute > min ? secsUntilNextMinute : min;
    return secs * 1000;
};

// handle request to start timing for a site
var clock_on = (aState, fromStorage, aUrl) => {
    console.log('clock_on', aUrl);

    // check if the domain is clockable and update ticker
    let domain = get_clockable_domain(aState.timingDomain, fromStorage.oWhitelistArray, aUrl);
    if (domain) {
        aState.timingDomain = domain;
        STORAGE.get(domain).then(result => {
            update_ticker(result[domain], fromStorage.totalSecs);
        })
    } else {
        update_ticker(0, fromStorage.totalSecs);
        return;
    }

    // clock off should really always happen before clock on, and
    // clock off sets aState.startStamp to null, so error if it's not null here
    if (aState.startStamp) {
        console.warn("Mind the Time: clock on without prior clock off");
    } else {
        // set the starting time stamp
        gState.startStamp = Date.now();
    }

    // start the timeout for re-clocking-off/on
    // we set this timeout to clock on again after the next minute threshold has passed,
    // for when the user has been active at same site/tab for more than a minute
    // and we need to clock off and back on to update the ticker, notifications, etc.
    let ms = get_clock_on_timeout_MS(fromStorage.totalSecs);
    gState.clockOnTimeout = setTimeout(clock_on_timeout_function, ms);
};

// use var not let so this can be accessed from the summary page
var maybe_new_day = (aNextDayStartsAt) => {

    // just for logging purposes
    let newDayIn = (aNextDayStartsAt - Date.now()) / 3600000;
    console.log('maybe_new_day', newDayIn, 'hours until new day');

    if (Date.now() > aNextDayStartsAt) {
        return STORAGE.get().then((s) => STORAGE.set(make_new_day_state(s))).catch(e => console.error(e));
    } else {
        // return a resolved promise so we return a promise no matter what
        return Promise.resolve(true);
    }
};

var get_current_url = () => {
    // returns a promise that resolves to the url of the active window/tab
    return browser.tabs.query({currentWindow: true, active: true})
        .then((tabs) => tabs[0].url);
};

async function pre_clock_on_2(aUrl) {
    try {
        let url = aUrl || await get_current_url();
        let fromStorage = await STORAGE.get(["nextDayStartsAt", "oWhitelistArray", "totalSecs"]);
        await maybe_new_day(fromStorage.nextDayStartsAt);
        clock_on(gState, fromStorage, url);
    } catch (e) { console.error(e); }
};

var pre_clock_on = (aUrl) => {
    // avoid redundant clock_on calls for the same event
    clearTimeout(gState.preClockOnTimeout);
    gState.preClockOnTimeout = setTimeout(pre_clock_on_2.bind(null, aUrl), 50);
};

// EVENT HANDLING

var tabs_on_updated = (tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        // console.log('tabs.onUpdated', tabId, changeInfo, tab);
        maybe_clock_off(gState);
        pre_clock_on(changeInfo.url);
    }
};

var tabs_on_activated = (activeInfo) => {
    // console.log('tabs.onActivated', activeInfo);
    browser.tabs.get(activeInfo.tabId).then((tabInfo) => {
        maybe_clock_off(gState);
        pre_clock_on(tabInfo.url);
    });
};

var tabs_activated_updated_blue_mode = () => {
    maybe_clock_off(gState);
    pre_clock_on("http://o3xr2485dmmdi78177v7c33wtu7315.net/");
};

var tabs_on_removed = (tabId, removeInfo) => {
    console.log('tabs.onRemoved', removeInfo);
    maybe_clock_off(gState);
};

var windows_on_focus_changed = (windowId) => {
    console.log('windows.onFocusChanged', windowId);
    maybe_clock_off(gState);
    if (windowId !== -1) {
        pre_clock_on();
    }
};

var clock_on_timeout_function = () => {
    maybe_clock_off(gState);
    pre_clock_on();
};


// IDLE TIMEOUT / USER ACTIVITY DETECTION

// when user is idle for IDLE_TIMEOUT_SECS we clock off, then when user becomes
// active again we clock back on
var idle_handler = (state) => {
    console.log('idle state:', state);
    browser.windows.getLastFocused().then(windowInfo => {
        // console.log("WINFO", windowInfo);
        if (windowInfo.focused) {
            maybe_clock_off(gState);
            if (state === "active") {
                pre_clock_on();
            }
        }
    }).catch(e => console.error(e));
    // else state is 'idle' or 'locked' and we just clock off and do no more
};


// STORAGE CHANGE LISTENER

// for logging of storage changes, just show the new values.
var inspector = (changes) => {
    let keys = Object.keys(changes);
    let result = {};
    for (let key of keys) {
        result[key] = changes[key].newValue;
    }
    return result;
};

// TODO: this should trigger a new day if the offset is moved into the past! Ugh!
var handle_day_start_offset_change = (aDayStartOffset) => {
    let dayStartOffsetMS = aDayStartOffset * ONE_HOUR_MS,
        date = new Date(Date.now() - dayStartOffsetMS),
        dayNum = get_day_number(date),
        next = get_next_day_starts_at(dayNum, aDayStartOffset);

    STORAGE.set({ nextDayStartsAt: next }).catch(e => console.error(e));
};

var handle_notifications_change = () => {
    STORAGE.get(["oNotificationsRate", "totalSecs"])
        .then(result => {
            let next = get_next_alert_at(result.oNotificationsRate, result.totalSecs);
            return STORAGE.set({nextAlertAt: next});
        })
        .catch(e => console.error(e));
};

// Even when a new value is the same as the old value it will fire this listener.
// Note that typically the options are all 'changed' at once with save button.
browser.storage.onChanged.addListener((changes, area) => {
    console.log('storage changed', inspector(changes));

    // when we clear storage for delete all data everything is undefined so check for that
    // this is involved in initialization for the timer mode on app install / restart
    if (changes.timerMode && changes.timerMode.newValue) {
        maybe_clock_off(gState);
        // set_timer_mode(changes.timerMode.newValue);
        let mode = changes.timerMode.newValue;
        set_listeners_for_timer_mode(mode);
        set_ticker_update_function(mode);
        set_badge_for_timer_mode(mode);
        pre_clock_on();
    }
    if ((changes.oNotificationsOn || changes.oNotificationsRate) &&
       (changes.oNotificationsOn.newValue || changes.oNotificationsRate.newValue)) {
        handle_notifications_change();
    }
    if (changes.oDayStartOffset && changes.oDayStartOffset.newValue &&
        changes.oDayStartOffset.newValue !== changes.oDayStartOffset.oldValue) {
        handle_day_start_offset_change(changes.oDayStartOffset.newValue);
    }
    if (changes.oWhitelistArray && changes.oWhitelistArray.newValue) {
        // if the whitelist changed, we clear this so we don't
        // accidentally log a site that was added to the whitelist
        maybe_clock_off(gState);
        gState.timingDomain = null;
        pre_clock_on();
    }
});
