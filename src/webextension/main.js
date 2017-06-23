/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Contributor(s): Paul Morris.

"use strict";

// just for testing, clear all data
// browser.storage.local.clear();

// INITIALIZE VALUES

const ONE_DAY_MS = 86400000,
    ONE_MINUTE_MS = 60000,
    ONE_HOUR_MS = 3600000,
    IDLE_TIMEOUT_SECS = 15,
    DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    MONTH_NAMES = ["December", "January", "February", "March",
                  "April", "May", "June", "July", "August",
                  "September", "October", "November"],
    WEEK_WORD = "Week",
    PAST_7_DAYS_TEXT = "Past 7 Days",
    STORAGE = browser.storage.local,
    // all keys in storage that aren't domains, used to extract domain data for today
    STORAGE_KEYS = [
        "currentDomainSecs",
        "days",
        "monthSums",
        "nextAlertAt",
        "nextDayStartsAt",
        "oButtonBadgeTotal",
        "oDayStartOffset",
        "oNotificationsOn",
        "oNotificationsRate",
        "oWhitelistArray",
        "past7daySum",
        "timerMode",
        "today",
        "totalSecs",
        "weekSums"
    ],
    OPTIONS = [
        "oButtonBadgeTotal",
        "oDayStartOffset",
        "oNotificationsOn",
        "oNotificationsRate",
        "oWhitelistArray"
    ],
    // used with promises
    LOG_ERROR = e => console.error(e);

var gState = {};

var get_null_gState = () => ({
    timingDomain: null,
    startStamp: null,
    clockOnTimeout: null,
    preClockOnTimeout: null,
    notificationsMinutes: ""
});

var is_null_or_undefined = thing => thing === null || thing === undefined;

var time_to_hours_and_minutes = time => {
    let absTime = Math.abs(time),
        h = Math.floor(absTime / 3600),
        m = Math.floor(absTime / 60) % 60;
    return [h, m];
};

var format_time = time => {
    let [h, m] = time_to_hours_and_minutes(time);
    return ((h < 1) ? "0:" : h + ":") +
           ((m < 10) ? ((m < 1) ? "00" : "0" + m) : m);
};

var format_time_minimal = time => {
    // used for ticker button badge
    let [h, m] = time_to_hours_and_minutes(time);
    return ((h > 0) ? h + ":" : "") +
           ((h > 0) && (m < 10) ? "0" + m : m);
};

var get_next_day_starts_at = (dayNum, aDayStartOffset) => {
    // determine when the next day starts in milliseconds since midnight on 1/1/1970
    // add one to get next day, convert to milliseconds,
    // adjust for local time zone, and add 4 hours so new day starts at 4am
    let localTimeZoneOffsetMS = new Date().getTimezoneOffset() * ONE_MINUTE_MS,
        startsAt = ((dayNum + 1) * ONE_DAY_MS) + localTimeZoneOffsetMS + (aDayStartOffset * ONE_HOUR_MS);
        // console.log("DAYNUMS", dayNum);
    return startsAt;
};

var get_domain_keys = aStorage => {
    let allKeys = Object.keys(aStorage),
        domainKeys = allKeys.filter(key => !STORAGE_KEYS.includes(key));
        return domainKeys;
};

var extract_domain_data = aStorage => {
    let domainKeys = get_domain_keys(aStorage),
        domainData = {};
    domainKeys.forEach(key => { domainData[key] = aStorage[key] });
    return domainData;
};

var sanitize_whitelist = oldWhitelistString => {
    // takes a string (from the whitelist pref) and returns an array
    let items = oldWhitelistString.split(','),
        whitelistSet = new Set();

    for (let item of items) {
        // trim whitespace
        item = item.trim();

        // skip empty items
        if (item.length !== 0) {
            // remove any sub-directories, trailing slashes, and http:// or https://
            try { item = new URL(item).host; }
            catch(e) {
                try { item = new URL("http://" + item).host; }
                catch(e) { }
            }
            whitelistSet.add(item);
        }
    }
    // convert set to an array
    return [...whitelistSet];
};

async function get_tab_by_url(aUrl) {
    try {
        let tabs = await browser.tabs.query({}),
            filteredTabs = tabs.filter(t => t.url === aUrl);
        return filteredTabs[0] || false;
    } catch (e) {
        console.error(e);
        return false;
    }
};

async function delete_all_data() {
    gState = get_null_gState();
    update_ticker(0);
    try {
        let savedData = await STORAGE.get(OPTIONS);
        await STORAGE.clear();
        await STORAGE.set(get_initial_storage(savedData));
        // reload the summary page if it is open
        let summaryUrl = browser.extension.getURL("summary/index.html"),
            summaryTab = await get_tab_by_url(summaryUrl);
        if (summaryTab) {
            browser.tabs.reload(summaryTab.id, {bypassCache: true});
        }
    } catch (e) {
        console.error(e);
    }
};


// INITIALIZE DATA STORAGE

// accepts a date object, returns the number of that day starting from 1/1/1970
// date arg has already been adjusted for 4am day change.
// The offset for the local time zone (getTimezoneOffset) is given in minutes
// so convert it to milliseconds.
// Subtract the time zone offset because it is positive if behind UTC and
// negative if ahead.
// Example: USA EST is +5 hours offset from UTC, so subtract 5 hours of MS
// from UTC MS to get local MS.
var get_day_number = (date) => {
    let localTimeMS = date.getTime() - (date.getTimezoneOffset() * ONE_MINUTE_MS);

    // console.log("timezoneOffset in hours: " + date.getTimezoneOffset() / 60);
    // console.log("dayNum: " + Math.floor( localTimeMS / ONE_DAY_MS ));

    return Math.floor( localTimeMS / ONE_DAY_MS );
};

var get_week_number = (dayNumber) => {
    // returns the day number of the Sunday before the dayNumber argument
    // we don't use Date.prototype.getDay for this to avoid time zone complications
    return dayNumber - ((dayNumber - 3) % 7);
};

var get_day_header_text = (date) => (DAY_NAMES[date.getDay()] + "   " +
                                    (date.getMonth() + 1) + "/" + date.getDate());

var get_date_with_offset = (aOffset) => {
    return new Date(Date.now() - (aOffset * ONE_HOUR_MS));
};

var get_empty_today_object = (aDayStartOffset) => {
    // used to initialize or reset today object.
    // used at add-on install, new day, delete all data.

    // subtract offset in ms from current time for adjusted day change moment
    let date = get_date_with_offset(aDayStartOffset),
        dayNumber = get_day_number(date);

    // console.log( ( get_next_day_starts_at(dayNumber) - Date.now() ) / ONE_MINUTE_MS / 60 + " = hours until new day");
    // console.log( ( get_next_day_starts_at(dayNumberDttt) - Date.now() ) / 1000 / 60 / 60 + " = hours until new day (DTTT)");

    return {
        headerText: get_day_header_text(date),
        monthNum: date.getMonth() + 1,
        dateNum: date.getDate(),
        dateObj: date,
        dayNum: dayNumber,
        weekNum: get_week_number(dayNumber)
    };
};

var get_empty_month_summary_object = () => {
    // month summary objects don't need a daysArray
    return {
        dmnsArray: [],
        totalSecs: 0,
        headerText: ""
    };
};

var get_empty_summary_object = () => {
    let result = get_empty_month_summary_object();
    result.daysArray = [];
    return result;
};

// Called on installation and when deleting all data.
// Takes aStorage object and creates a newStorage object by adding any values
// missing from aStorage. Returns newStorage. STORAGE can then be set with newStorage.
// Called without an argument it returns a complete initial storage object.
var get_initial_storage = (aStorage = {}) => {
    let simpleDefaults = {
            oButtonBadgeTotal: false,
            oNotificationsOn: false,
            oNotificationsRate: 60,
            oDayStartOffset: 0,
            oWhitelistArray: [],
            currentDomainSecs: 0,
            timerMode: "D",
            totalSecs: 0,
            days: []
        },
        newStorage = Object.assign(simpleDefaults, aStorage);

    if (is_null_or_undefined(aStorage.nextAlertAt)) {
        newStorage.nextAlertAt = get_next_alert_at(newStorage.oNotificationsRate, newStorage.totalSecs);
    }

    let dayNum;
    if (!aStorage.today) {
        newStorage.today = get_empty_today_object(newStorage.oDayStartOffset);
        dayNum = newStorage.today.dayNum;
    } else {
        dayNum = aStorage.today.dayNum;
    }
    newStorage.nextDayStartsAt = get_next_day_starts_at(dayNum, newStorage.oDayStartOffset);

    if (!aStorage.past7daySum) {
        newStorage.past7daySum = get_empty_summary_object();
    }
    if (!aStorage.weekSums) {
        newStorage.weekSums = new Array(10).fill(get_empty_summary_object());
    }
    if (!aStorage.monthSums) {
        newStorage.monthSums = new Array(6).fill(get_empty_month_summary_object());
    }
    return newStorage;
};

var initialize_state = () => {
    gState = get_null_gState();
    browser.idle.setDetectionInterval(IDLE_TIMEOUT_SECS);
};

// initialize storage, globals etc.
// for now this happens in data-migration.js until we say goodbye to the add-on sdk
/*
STORAGE.get()
    .then(s => STORAGE.set(get_storage_initializations(s)))
    .then(misc_init)
    .catch(LOG_ERROR);
*/
