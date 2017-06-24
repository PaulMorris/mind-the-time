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
    } catch (e) {
        console.error(e);
    }
};

async function maybe_migrate_data() {
    try {
        let storage = await STORAGE.get(),
            dataAlreadyExists = storage && storage.oDayStartOffset !== undefined;

        if (dataAlreadyExists) {
            // Data already exists; dont migrate.
            // We make sure timerMode will always be (re)set, which causes the storage
            // change listeners to fire, and then other listeners will be set up based on
            // the timer mode.
            await STORAGE.set({timerMode: storage.timerMode});
            initialize_state();

        } else {
            // No data; send migrate message.
            let response = await browser.runtime.sendMessage("migrate-legacy-data"),
                migrating = response && response.toStorage,
                toStorage = migrating ? response.toStorage : {};

            await STORAGE.set(get_initial_storage(toStorage));
            initialize_state();
            if (migrating) {
                migrate_summary_page();
            }
        }
    } catch (e) {
        console.error(e);
        // for development, allows loading and testing webextension part
        await STORAGE.set(get_initial_storage());
        initialize_state();
    }
};

maybe_migrate_data();
