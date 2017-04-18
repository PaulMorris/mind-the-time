/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

document.getElementById("summaryButton").addEventListener('click', (e) => {
    let url = browser.extension.getURL("summary/index.html");

    browser.tabs.query({}).then(tabs => {
        let summaryTab = tabs.filter((t) => t.url === url);

        if (summaryTab.length > 0) {
            browser.windows.update(summaryTab[0].windowId, { focused: true });
            browser.tabs.update(summaryTab[0].id, { active: true });
        } else {
            browser.tabs.create({ url: url });
        }
        window.close();
    }).catch(e => console.error(e));
});

var change_mode = (mode) => {
    browser.storage.local.set({ timerMode: mode });
    window.close();
};

document.getElementById("D").addEventListener('click', (e) => { change_mode('D'); });
document.getElementById("G").addEventListener('click', (e) => { change_mode('G'); });
document.getElementById("B").addEventListener('click', (e) => { change_mode('B'); });
document.getElementById("O").addEventListener('click', (e) => { change_mode('O'); });

var tickerDiv = document.getElementById("tickerDiv");

// show the seconds in the popup panel
browser.storage.local.get(['currentDomainSecs', 'totalSecs', 'timerMode'])
.then((result) => {

    let format_time = (time) => {
        let absTime = Math.abs(time),
            h = Math.floor(absTime / 3600),
            m = Math.floor(absTime / 60) % 60;
        return ((h < 1) ? "0:" : h + ":") +
               ((m < 10) ? ((m < 1) ? "00" : "0" + m) : m);
    };

    // update popup ticker, \u00a0 is unicode for a space
    let tickerText = format_time(result.totalSecs);
    if (result.timerMode !== 'B') {
        tickerText = format_time(result.currentDomainSecs) +
        "\u00a0\u00a0/\u00a0\u00a0" +
        tickerText;
    }
    tickerDiv.textContent = tickerText;
});
