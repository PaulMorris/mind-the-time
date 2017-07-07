/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Javascript for the summary page (summary/index.html)
"use strict";

// remove failed-to-load message
document.body.removeChild(document.getElementById("loadFailMessage"));

// add click listeners for top navigation bar
[['mindTheTimeNavLink', 'topnav'],
    ['monthsNavLink', 'rowMonths'],
    ['weeksNavLink', 'rowWeeks'],
    ['daysNavLink', 'rowDays'],
    ['optionsNavLink', 'rowPrefs']].forEach((pair) => {
    document.getElementById(pair[0]).addEventListener('click', smooth_scroll.bind(null, pair[1]));
});

var gTodayStamp;

// TABLE CONSTRUCTION

var put_in_td = (elem) => {
    let td = document.createElement('td'),
        child = (typeof elem === 'string' ? document.createTextNode(elem) : elem);
    td.appendChild(child);
    return td;
};

var put_tds_in_a_row = (tds) => {
    let row = document.createElement('tr');
    for (let td of tds) {
        row.appendChild(td);
    }
    return row;
};

var make_graph = (secs) => {
    let minsPerPx = 2,
        totalMins = Math.floor(secs / 60),
        hours = Math.floor(totalMins / 60),
        mins = Math.floor(totalMins % 60),
        graphUL = document.createElement('ul');

    graphUL.setAttribute('class', 'graphUL');
    // sets how many hours per row:
    // graphUL.style.maxWidth = ((hours < 5) ? (totalMins / minsPerPx) : ( 300 / minsPerPx)  ) + 12 + "px";
    while (hours) {
        let lig = document.createElement('li');
        lig.setAttribute('class', 'graphLI');
        // lig.style.width=((60 / minsPerPx) - 1) + "px";
        graphUL.appendChild(lig);
        hours -= 1;
    }
    let lig = document.createElement('li');
    lig.setAttribute('class', 'graphLI');
    lig.style.width = (mins / minsPerPx) + "px";
    graphUL.appendChild(lig);
    return graphUL;
};

var make_header_row = (header) => {
    let h4 = document.createElement('h4');
    h4.setAttribute('class', 'dateheader');
    h4.appendChild( document.createTextNode(header) );

    let td = put_in_td(h4);
    td.setAttribute('class', 'headertd');
    td.colSpan = "5";

    let row = document.createElement('tr');
    row.setAttribute('class', 'headerrow');
    row.appendChild(td);
    return row;
};

var make_day_summary_row = (boxID, c, tsecs, dayItem) => {
    let percent = (tsecs === 0 ? "0%" : Math.round( (dayItem[1] / tsecs) * 100) + "%"),
        time = format_time(dayItem[1]),
        graph = make_graph(dayItem[1]),
        nodes = [" ", dayItem[0], time, percent, graph],
        tds = nodes.map(put_in_td);

    tds[1].setAttribute('class', 'domain-td');

    let row = put_tds_in_a_row(tds);
    row.setAttribute('id', 'daysArray-trow' + boxID + c);
    return row;
};

var make_domain_row = (boxID, c, tsecs, dmnsItem, rowsShown) => {
    let domainNode;

    // TODO: lowercase version introduced with first webextension version
    // eventually we should drop the uppercase version once it is out of
    // users data
    if (dmnsItem[0] === "o3xr2485dmmdi78177v7c33wtu7315.net" ||
        dmnsItem[0] === "O3Xr2485dmmDi78177V7c33wtu7315.net") {
        domainNode = document.createTextNode("No websites logged (only time)");
    } else {
        domainNode = document.createElement('a');
        domainNode.setAttribute('href', "http://" + dmnsItem[0]);
        domainNode.setAttribute('class', 'domainlink');
        domainNode.setAttribute('target', '_blank');
        domainNode.appendChild( document.createTextNode( dmnsItem[0] ));
    }

    let percent = (tsecs === 0 ? "0%" : Math.round( (dmnsItem[1] / tsecs) * 100) + "%"),
        rowNumber = c + 1 + ".",
        nodes = [rowNumber, domainNode, format_time(dmnsItem[1]), percent, make_graph(dmnsItem[1])],
        tds = nodes.map(put_in_td);

    tds[1].setAttribute('class', 'domain-td');

    let row = put_tds_in_a_row(tds);
    row.setAttribute('id', 'trow' + boxID + c);
    if (c > rowsShown - 1) {
        row.setAttribute('style', 'display:none');
    }
    return row;
};

var make_total_row = (tsecs) => {
    let nodes = [" ", "Total", format_time(tsecs), "100%", make_graph(tsecs)],
        tds = nodes.map(put_in_td),
        row = put_tds_in_a_row(tds);
    row.setAttribute('class', 'totalrow');
    return row;
};

var make_show_more_row = (len, rowsShown, boxID) => {
    let showLink = document.createElement('a');
    showLink.setAttribute('class', 'showmore');
    showLink.appendChild( document.createTextNode("Show " + (len - rowsShown) + " More") );
    showLink.addEventListener("click", () => {
        show_or_hide_rows(boxID, len, rowsShown, true);
        }, false);

    let tds = [" ", showLink].map(put_in_td);
    tds[1].setAttribute('id', 'showCell' + boxID);
    tds[1].colSpan = "4";
    tds[1].appendChild(showLink);

    let row = put_tds_in_a_row(tds);
    row.setAttribute('id', 'showrow' + boxID );
    return row;
};

// handles "show/hide more rows"
var show_or_hide_rows = (boxID, len, rowsShown, showMore) => {
    let i,
        showLink = document.createElement('a'),
        showCell = document.getElementById('showCell' + boxID),
        showWhatText,
        displayValue;

    if (showMore === true) {
        showWhatText = document.createTextNode( "Show Only First 10" );
        displayValue = null;
        showLink.addEventListener("click", () => {
            show_or_hide_rows(boxID, len, rowsShown, false);
            // scroll to top of table (using boxID)
            document.defaultView.postMessage( boxID, "*");
            }, false);

    } else {
        showWhatText = document.createTextNode( "Show " + (len - rowsShown) + " More" );
        displayValue = "none";
        showLink.addEventListener("click", () => {
            show_or_hide_rows(boxID, len, rowsShown, true);
            }, false);
    }

    showLink.setAttribute('class', 'showmore');
    showLink.appendChild(showWhatText);
    showCell.innerHTML = "";
    showCell.appendChild(showLink);

    for (i = rowsShown; i < len; i += 1) {
        document.getElementById("trow" + boxID + i).style.display = displayValue;
    }
};

var make_table = (data, aHeaderText, boxID) => {

    let domainCount = data.dmnsArray.length,
        rowsShown = 10,
        tab = document.createElement('table'),
        tbo = document.createElement('tbody');

    // date header row
    tbo.appendChild(make_header_row(aHeaderText));

    // daysArray rows
    if (data.daysArray) {
        for (let c = 0; c < data.daysArray.length; c += 1) {
            tbo.appendChild( make_day_summary_row( boxID, c, data.totalSecs, data.daysArray[c] ));
        }
    }

    // total header row
    tbo.appendChild( make_total_row(data.totalSecs) );

    // create domain rows
    for (let c = 0; c < domainCount; c += 1) {
        tbo.appendChild( make_domain_row(boxID, c, data.totalSecs, data.dmnsArray[c], rowsShown) );
    }

    // show more row
    if (domainCount > rowsShown) {
        tbo.appendChild( make_show_more_row( domainCount, rowsShown, boxID ) );
    }

    tab.setAttribute('class','MTTtable');
    tab.appendChild(tbo);
    return tab;
};

var make_empty_table_message_row = (text) => {
    let td = put_in_td(text);
    td.colSpan = "5";
    td.setAttribute('class', 'emptytableTD');
    let row = document.createElement('tr');
    row.appendChild(td);
    return row;
};

var make_empty_table = (header, contentText) => {
    let headerRow = make_header_row( header),
        messageRow = make_empty_table_message_row(contentText),
        tbo = document.createElement('tbody'),
        tab = document.createElement('table');
    tbo.appendChild(headerRow);
    tbo.appendChild(messageRow);
    tab.setAttribute('class','MTTtable');
    tab.appendChild(tbo);
    return tab;
};

async function handle_days_button_click() {
    try {
        let fromStorage = await browser.storage.local.get('days'),
            node = document.getElementById("showDaysButton"),
            days_partB = fromStorage.days.slice(8);

        node.parentNode.removeChild(node);
        add_day_big_rows(days_partB.length, 15, 29);
        add_day_tables(days_partB, 15, 29);
    } catch (e) {
        console.error(e);
    }
};

var make_more_days_button = () => {
    let dayButton = document.createElement('p'),
        dayButtonText = document.createTextNode( "Show All Day Summaries" );
    dayButton.appendChild(dayButtonText);
    dayButton.setAttribute('id', 'showDaysButton');
    dayButton.addEventListener("click", handle_days_button_click, false);
    return dayButton;
};


// HIGHER LEVEL MANAGEMENT

var table_needed = (data) => {
    return data && data.dmnsArray.length > 0;
}

var pair_array = (a) => {
    // [1,2,3,4,5] --> [[1,2],[3,4],[5]]
    let temp = a.slice(),
        arr = [];
    while (temp.length) {
        arr.push(temp.splice(0,2));
    }
    return arr;
};

var make_box = (boxIdNum) => {
    let box = document.createElement('div');
    box.setAttribute('class','sum-box');
    box.setAttribute('id', 'box' + boxIdNum);
    return box;
};

var make_big_row = (rowIdNum) => {
    let bigRow = document.createElement('div');
    bigRow.setAttribute('class','big-row');
    bigRow.setAttribute('id', 'row' + rowIdNum);
    return bigRow;
};

var add_day_big_rows = (boxCount, rowIdNum, boxIdNum) => {
    // creates a pattern, a paired array, which solves the problem
    // of an odd number of days needing only one box in last big row
    let pattern = pair_array( Array(boxCount).fill(true) );

    for (let pair of pattern) {
        let bigRow = make_big_row(rowIdNum);

        for (let item of pair) {
            bigRow.appendChild(make_box(boxIdNum));
            boxIdNum += 1;
        }

        document.getElementById("day-rows").appendChild(bigRow);
        rowIdNum += 1;
    }
};

var add_day_tables = (days, rowIdNum, boxIdNum) => {
    for (let day of days) {
        if (day !== null && day.totalSecs !== 0) {
            let boxID = "box" + boxIdNum;
            document.getElementById(boxID).appendChild(make_table(day, day.headerText, boxID));
            boxIdNum += 1;
        }
    }
};


// LOADING DATA

var load_summary = (aStorage) => {
    let today = aStorage.today,
        domainData = gBackground.extract_domain_data(aStorage),
        headerText = "Today, " + today.headerText;

    today.dmnsArray = gBackground.get_sorted_domains(domainData);

    // round because today's total is still dynamic, not done yet.
    today.totalSecs = Math.round(aStorage.totalSecs);

    document.getElementById("box0").innerHTML = "";
    document.getElementById("box0").appendChild(make_table(today, headerText, "box0"));

    // if it's a new day, reload rest of data/tables
    if (today.dayNum !== gTodayStamp) {
        gTodayStamp = today.dayNum;
        load_the_rest(aStorage);
    }
};


// first load only data for previous day, current week, and previous week

var load_the_rest = (storage) => {
    // clear previous day and all non-day boxes, box1 to box20
    let n;
    for (n = 20; n > 0; n -= 1) {
        document.getElementById("box" + n).innerHTML = "";
    }
    document.getElementById("day-rows").innerHTML = "";
    document.getElementById("rowMonths").style.display = "none";
    document.getElementById("rowWeeks").style.display = "none";
    document.getElementById("rowDays").style.display = "none";


    // data for previous day, current week, and previous week,
    // n is 0 or 1, so we do not make the current week the previous week yet
    // if new current week will be empty
    n = (storage.weekSums[0] &&
         storage.weekSums[0].dmnsArray.length === 0 &&
         storage.weekSums[1] &&
         storage.weekSums[1].dmnsArray.length > 0) ? 1 : 0;

    let prevDay = storage.days[0],
        thisWeek = storage.weekSums[n],
        prevWeek = storage.weekSums[n + 1],
        prevDayTable,
        currentWeekTable,
        prevWeekTable;

    if (table_needed(prevDay)) {
        prevDayTable = make_table(prevDay, "Previous Day, " + prevDay.headerText, "box1");
    } else {
        prevDayTable = make_empty_table("Previous Day",
        "This table will show a summary for the previous day. Additional " +
        "tables covering the past 70 days will appear below.");
    }
    document.getElementById("box1").appendChild(prevDayTable);

    if (table_needed(thisWeek)) {
        currentWeekTable = make_table(thisWeek, "Current " + thisWeek.headerText, "box2");
    } else {
        currentWeekTable = make_empty_table("Current Week",
        "This table will summarize the current week so far, with sub-totals for each day. " +
        "(Data from today is not included in the current week until today is over.)");
    }
    document.getElementById("box2").appendChild(currentWeekTable);

    if (table_needed(prevWeek)) {
        prevWeekTable = make_table(prevWeek, "Previous " + prevWeek.headerText, "box3");
    } else {
        prevWeekTable = make_empty_table("Previous Week",
        "This table will summarize the previous week, with sub-totals for each day. " +
        "Tables covering the past ten weeks will appear below.");
    }
    document.getElementById("box3").appendChild(prevWeekTable);


    // NEXT PHASE

    let past7daySum = storage.past7daySum,
        weekSums = storage.weekSums,
        monthSums = storage.monthSums,
        days_partA = storage.days.slice(0, 8);

    // do not move the current month/week to previous if the new current month/week will be empty.
    // remove current month/week from the array if it is empty and previous month/week is not.
    if (!table_needed(monthSums[0]) && table_needed(monthSums[1])) {
        monthSums.shift();
    }
    if (!table_needed(weekSums[0]) && table_needed(weekSums[1])) {
        weekSums.shift();
    }

    let past7dayTable,
        currentMonthTable,
        prevMonthTable;

    if (table_needed(past7daySum)) {
        past7dayTable = make_table(past7daySum, past7daySum.headerText, "box4");
    } else {
        past7dayTable = make_empty_table("Past 7 Days",
        "This table will summarize the past seven days, including totals " +
        "for the time spent browsing each day.");
    }
    if (table_needed(monthSums[0])) {
        currentMonthTable = make_table(monthSums[0], "Current Month, " + monthSums[0].headerText, "box5");
    } else {
        currentMonthTable = make_empty_table("Current Month",
        "This table will summarize the current month so far. " +
        "(Data from today is not included in the current month until today is over.).");
    }
    if (table_needed(monthSums[1])) {
        prevMonthTable = make_table(monthSums[1], "Previous Month, " + monthSums[1].headerText, "box6");
    } else {
        prevMonthTable = make_empty_table("Previous Month",
        "This table will summarize the previous month.  Eventually monthly " +
        "summaries will be shown for the current month and the previous five months.");
    }

    document.getElementById("box4").appendChild(past7dayTable);
    document.getElementById("box5").appendChild(currentMonthTable);
    document.getElementById("box6").appendChild(prevMonthTable);

    // 0 is current month, 1 is previous month, 2-5 are the rest
    for (n = 5; n >= 2; n -= 1) {
        if (table_needed(monthSums[n])) {
            // n is 2 to 5, --> box7 to box10
            let boxID = "box" + (n + 5),
                table = make_table(monthSums[n], monthSums[n].headerText, boxID);
            document.getElementById(boxID).appendChild(table);
        }
    }

    let currentWeekTable2;
    if (table_needed(weekSums[0])) {
        currentWeekTable2 = make_table(weekSums[0], "Current, " + weekSums[0].headerText, "box11");
    } else {
        currentWeekTable2 = make_empty_table("More Weeks",
        "Tables for the past ten weeks will appear here.");
        document.getElementById("box12").style.display = "none";
    }
    document.getElementById("box11").appendChild(currentWeekTable2);

    if (table_needed(weekSums[1])) {
        let prevWeekTable2 = make_table(weekSums[1], weekSums[1].headerText, "box12");
        document.getElementById("box12").appendChild(prevWeekTable2);
        document.getElementById("box12").style.display = "block";
    }

    for (n = 9; n >= 2; n -= 1) {
        if (table_needed(weekSums[n])) {
            // n is 2 to 9, --> box13 to box20
            let boxID = "box" + (n + 11),
                table = make_table(weekSums[n], weekSums[n].headerText, boxID);
            document.getElementById(boxID).appendChild(table);
        }
    }

    // DAYS
    document.getElementById("day-rows").innerHTML = "";
    if (!days_partA[0]) {
        add_day_big_rows(1, 11, 21);
        document.getElementById("box21").appendChild(
            make_empty_table("More Days", "Tables for the past 70 days will appear here."));
    } else {
        add_day_big_rows(days_partA.length, 11, 21);
        add_day_tables(days_partA, 11, 21);

        // show the "show all days" button or not
        if (storage.days[8]) {
            document.getElementById("day-rows").appendChild(make_more_days_button());
        }
    }

    document.getElementById("rowMonths").style.display = "block";
    document.getElementById("rowWeeks").style.display = "block";
    document.getElementById("rowDays").style.display = "block";
    document.getElementById("rowPrefs").style.display = "block";
};


// BUTTONS

// reload button handler
async function handle_reload_click() {
    try {
        await start_load(gBackground);
        // flicker the current day so the user knows it was updated
        document.getElementById("box0").style.visibility = "hidden";
        setTimeout(() => { document.getElementById("box0").style.visibility = "visible"; }, 80);
    } catch (e) {
        console.error(e);
        window.location.reload();
    }
};

document.getElementById("reloadButton").addEventListener("click", handle_reload_click, false);


// INITIALIZATION

// gBackground is the top level document for background.js allowing access to
// functions and global variables.
var gBackground;

async function start_load () {
    try {
        let [bg, storage] = await Promise.all([
            browser.runtime.getBackgroundPage(),
            browser.storage.local.get()
        ]);
        gBackground = bg;

        let dateNow = Date.now();
        if (dateNow > storage.nextDayStartsAt) {
            await gBackground.start_new_day(dateNow);
        }
        load_summary(storage);
        return true;
    } catch (e) {
        console.error(e);
    }
};

start_load();


// FOR TESTING NEW DAY CODE
/*
async function test_new_day_2(dnow) {
    await gBackground.maybe_clock_off(gBackground.gState);
    await handle_reload_click();
    await gBackground.start_new_day(dnow);
    test_new_day(dnow);
}

function test_new_day(dnow = Date.now()) {
    gBackground.pre_clock_on(["http://mozilla.org", "http://gnu.org", "http://ubuntu.org"][dnow % 3]);
    setTimeout(test_new_day_2.bind(null, dnow + 86400001), 2000);
};
*/
