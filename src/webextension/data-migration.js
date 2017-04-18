"use strict";

// takes a storage object and makes sure all properties are set,
// if properties are unset then defaults values are set
// returns a complete storage object
/*
var fill_in_storage_gaps = (aStorage = {}) => {
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
        };

    Object.keys(simpleDefaults).forEach(key => {
        if (is_null_or_undefined(aStorage[key])) {
            aStorage[key] = simpleDefaults[key];
        }
    });

    if (is_null_or_undefined(aStorage.nextAlertAt)) {
        aStorage.nextAlertAt = get_next_alert_at(aStorage.oNotificationsRate, aStorage.totalSecs);
    }
    if (!aStorage.today) {
        aStorage.today = get_empty_today_object(aStorage.oDayStartOffset);
    }

    aStorage.nextDayStartsAt = get_next_day_starts_at(aStorage.today.dayNum, aStorage.oDayStartOffset);

    if (!aStorage.past7daySum) {
        aStorage.past7daySum = get_empty_summary_object();
    }
    if (!aStorage.weekSums) {
        aStorage.weekSums = new Array(10).fill(get_empty_summary_object());
    }
    if (!aStorage.monthSums) {
        aStorage.monthSums = new Array(6).fill(get_empty_month_summary_object());
    }
    return aStorage;
};
*/

// Background script to ask the add-on sdk part to gather data and
// send it back to the background page, where it can be saved using
// the WebExtensions storage API.
// Then make a new day if needed.
// Then initialize and reload the summary page/tab if it is open.

var handle_data_sync = (response) => {
    // let storage = await STORAGE.get();
    // await STORAGE.set(initialize(storage));

    // let alsoToStorage = {};
    let newStorage;

    if (response && response.toStorage) {
        // let priorNextDayStartsAt = response.toStorage.nextDayStartsAt;

        // newStorage = fill_in_storage_gaps(response.toStorage);

        // combine what we got from response and the initializations (gaps in that)
        // to get a complete storage object
        newStorage = Object.assign(response.toStorage, get_storage_initializations(response.toStorage));

        // alsoToStorage = get_storage_initializations(response.toStorage);
        // await STORAGE.set(response.toStorage);

        // WE DON"T NEED TO START A NEW DAY, IT WILL BE STARTED WHEN WE UPDATE THE STORAGE
        /*
        if (newStorage.nextDayStartsAt &&
            Date.now() > newStorage.nextDayStartsAt) {
            newStorage = make_new_day_state(newStorage);
            // await maybe_new_day(response.toStorage.newDayStartsAt);
        }
        */
    } else {
        newStorage = get_storage_initializations({});
    }
    return STORAGE.set(newStorage);
};

var reload_summary_page = () => {
    let oldUrl = "resource://jid0-hynmqxa9zqgfjadreri4n2ahksi-at-jetpack/data/index.html",
        newUrl = browser.extension.getURL("summary/index.html");
        browser.tabs.query({}).then(tabs => {
            let filteredTabs = tabs.filter(t => t.url === oldUrl),
                summaryTab = filteredTabs.length > 0 ? filteredTabs[0] : false;
            if (summaryTab) {
                browser.tabs.update(summaryTab.id, {url: newUrl});
            }
        }).catch(LOG_ERROR);
}

browser.runtime.sendMessage("sync-legacy-addon-data")
    .then(handle_data_sync)
    .then(() => {
        misc_init();
        reload_summary_page();
    })
    .catch(LOG_ERROR);



/*
// promise chain version
browser.runtime.sendMessage("sync-legacy-addon-data")
    .then(response => (response && response.toStorage) ?
            browser.storage.local.set(response.toStorage) :
            Promise.resolve("Nothing to add to storage or no response back."))
    .then(() => STORAGE.get())
    .then(storage => STORAGE.set(initialize(storage)))
    .then(() => browser.tabs.query({}))
    .then(tabs => {
        let oldUrl = "resource://jid0-hynmqxa9zqgfjadreri4n2ahksi-at-jetpack/data/index.html",
            newUrl = browser.extension.getURL("summary/index.html"),
            summaryTabSet = tabs.filter(t => t.url === oldUrl),
            summaryTab = summaryTabSet.length > 0 ? summaryTabSet[0] : false;

        return summaryTab ?
            browser.tabs.update(summaryTab.id, {url: newUrl}) :
            Promise.resolve("The summary page/tab was not open.");
    })
    .catch(LOG_ERROR);
*/
