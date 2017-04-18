/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Contributor(s): Paul Morris.

const webext = require("sdk/webextension"),
    ss = require("sdk/simple-storage").storage,
    sprf = require("sdk/simple-prefs");

// WHITELIST HANDLING

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


// LOAD THE WEBEXTENSION

webext.startup().then(({browser}) => {
    browser.runtime.onMessage.addListener((msg, sender, sendReply) => {
        if (msg === "sync-legacy-addon-data" && ss.today) {
            let prefs = {
                  oButtonBadgeTotal: sprf.prefs["buttonBadgePref"] === 't',
                  oDayStartOffset: 4,
                  oNotificationsOn: sprf.prefs["showRemindersPref"],
                  oNotificationsRate: sprf.prefs["reminderRatePref"],
                  oWhitelistArray: sprf.prefs["whiteListPref"] ? sanitize_whitelist(sprf.prefs["whiteListPref"]) : []
                }
                toStorage = Object.assign(prefs, ss),
                domains = Object.assign({}, ss.today.dmnsObj),
                domainsKeys = Object.keys(domains),
                totalSecs = ss.today.totalSecs,
                nextDayStartsAt = ss.today.nextDayStartsAt,
                deleteThese = ['MTTvsn', 'tempShowRemindersPref', 'tempReminderTypePref'],
                deleteTheseToo = ['totalSecs', 'nextDayStartsAt', 'dmnsArray', 'dmnsObj'];

            deleteThese.forEach(key => { delete toStorage[key]; });
            deleteTheseToo.forEach(key => { delete toStorage.today[key] });
            toStorage['totalSecs'] = totalSecs;
            toStorage['nextDayStartsAt'] = nextDayStartsAt;
            domainsKeys.forEach(key => { toStorage[key] = domains[key]; });

            // Send the data
            sendReply({toStorage: toStorage});

        }
    });
});
