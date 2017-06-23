/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Contributor(s): Paul Morris.

require("sdk/webextension").startup().then(({browser}) => {
    const ss = require("sdk/simple-storage").storage;

    if (ss.today && !ss.migratedToWebExtension) {

        const sanitize_whitelist = (whitelistString) => {
            // takes a string (from the whitelist pref) and returns an array
            let items = whitelistString.split(','),
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

        const migrate_data = (message, sender, sendResponse) => {
            if (message === "migrate-legacy-data") {

                const sprf = require("sdk/simple-prefs");

                const whitelist = sprf.prefs["whiteListPref"],
                    prefs = {
                      oButtonBadgeTotal: sprf.prefs["buttonBadgePref"] === 't',
                      oDayStartOffset: 4,
                      oNotificationsOn: sprf.prefs["showRemindersPref"],
                      oNotificationsRate: sprf.prefs["reminderRatePref"],
                      oWhitelistArray: whitelist ? sanitize_whitelist(whitelist) : []
                    },
                    domains = Object.assign({}, ss.today.dmnsObj),
                    deleteThese = ['MTTvsn', 'tempShowRemindersPref', 'tempReminderTypePref'],
                    deleteTheseToday = ['totalSecs', 'nextDayStartsAt', 'dmnsArray', 'dmnsObj'];

                let toStorage = Object.assign(prefs, ss);

                toStorage['totalSecs'] = ss.today.totalSecs;
                toStorage['nextDayStartsAt'] = ss.today.nextDayStartsAt;

                deleteThese.forEach(key => { delete toStorage[key]; });
                deleteTheseToday.forEach(key => { delete toStorage.today[key] });
                Object.keys(domains).forEach(key => { toStorage[key] = domains[key]; });

                // Send the data
                sendResponse({toStorage: toStorage});

                // Mark the SDK data as migrated
                ss.migratedToWebExtension = true;

            } else {
                sendResponse({});
            }
            browser.runtime.onMessage.removeListener(migrate_data);
        }
        browser.runtime.onMessage.addListener(migrate_data);

    } else {
        var migrate_nothing = (message, sender, sendResponse) => {
            sendResponse({});
            browser.runtime.onMessage.removeListener(migrate_nothing);
        }
        browser.runtime.onMessage.addListener(migrate_nothing);
    };
});
