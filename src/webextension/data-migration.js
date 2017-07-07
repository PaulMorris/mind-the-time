"use strict";

// Background script to ask the add-on sdk part to convert its data and
// send it back to the background page, where it can be saved using
// the WebExtensions storage API.
// Then initialize and reload the summary page/tab if it is open.

async function migrate_summary_page() {
    try {
        let oldUrl = "resource://jid0-hynmqxa9zqgfjadreri4n2ahksi-at-jetpack/data/index.html",
            summaryTab = await get_tab_by_url(oldUrl);
        if (summaryTab) {
            let newUrl = browser.extension.getURL("summary/index.html");
            browser.tabs.update(summaryTab.id, {url: newUrl});
        }
    } catch (e) { console.error(e); }
};

async function maybe_migrate_data(forced = false) {
    try {
        let storage = await STORAGE.get(),
            dataAlreadyExists = storage && storage.oDayStartOffset !== undefined;

        if (dataAlreadyExists && !forced) {
            // Data already exists; dont migrate.
            // We make sure timerMode will always be (re)set, which causes the storage
            // change listeners to fire, and then other listeners will be set up based on
            // the timer mode.
            initialize_state();
            await STORAGE.set({timerMode: storage.timerMode});

        } else {
            // No data; send migrate message.
            let response = await browser.runtime.sendMessage("migrate-legacy-data"),
                migrating = response && response.toStorage,
                toStorage = migrating ? response.toStorage : {};

            initialize_state();
            await STORAGE.set(get_initial_storage(toStorage));
            if (migrating) {
                migrate_summary_page();
            }
        }
    } catch (e) {
        console.error(e);
        // for development, allows loading and testing webextension part
        initialize_state();
        await STORAGE.set(get_initial_storage());
    }
};

maybe_migrate_data();
