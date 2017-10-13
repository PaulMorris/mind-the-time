/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

// Handle shuffling data for a new day

"use strict";

function get_week_header_text(weekNum) {
    let from = new Date((weekNum + 1) * ONE_DAY_MS),
        to = new Date(from.getTime() + (6 * ONE_DAY_MS)),
        toDate = to.getDate();

    let dtf = new Intl.DateTimeFormat(undefined, {month: 'numeric', day: 'numeric'});
    return WEEK_WORD + " " + dtf.format(from) + " - " + dtf.format(to);
};

function get_past7days_header_text(num) {
    let from = new Date((num - 6) * ONE_DAY_MS), // a week ago
        to = new Date(num * ONE_DAY_MS), // yesterday
        toDate = to.getDate();
    let dtf = new Intl.DateTimeFormat(undefined, {month: 'numeric', day: 'numeric'});
    return PAST_7_DAYS_TEXT + "   " + dtf.format(from) + " - " + dtf.format(to);
};

function combine_data_from_days(sourceArray) {
    let dmns = {},
        summ = { totalSecs : 0 };

    // loop through all the days and merge each day's data
    for (let day of sourceArray) {
        summ.totalSecs += day.totalSecs;

        for (let [key, val] of day.dmnsArray) {
            if (dmns.hasOwnProperty(key)) {
                dmns[key] += val;
            } else {
                dmns[key] = val;
            }
        }
    }

    // convert domains object to sorted array
    summ.dmnsArray = get_sorted_domains(dmns);
    return summ;
};

function get_daily_totals(sourceArray) {
    let daysArray = [];
    for (let day of sourceArray) {
        daysArray.push([
            day.headerText,
            day.totalSecs,
            day.dayNum
        ]);
    }
    return daysArray.sort((a, b) => a[2] - b[2]);
};

function make_month_summ(monthNum, days) {

    let daysSubset = days.filter((day) => day && day.monthNum && day.monthNum === monthNum),
        summ = combine_data_from_days(daysSubset);

    let dtf = new Intl.DateTimeFormat(undefined, {month: 'long'});
    summ.headerText = dtf.format(new Date(2000, monthNum - 1));
    summ.monthNum = monthNum;
    return summ;
};

function make_week_summ(weekNum, days) {

    let daysSubset = days.filter((day) => day && day.weekNum && day.weekNum === weekNum),
        summ = combine_data_from_days(daysSubset);

    summ.daysArray = get_daily_totals(daysSubset);
    summ.headerText = get_week_header_text(weekNum);
    summ.weekNum = weekNum;
    return summ;
};

function make_past7days_summ(num, days) {

    let daysSubset = days.filter((day) => day && day.dayNum > num - 8 && day.dayNum < num),
        summ = combine_data_from_days(daysSubset);

    summ.daysArray = get_daily_totals(daysSubset);
    summ.headerText = get_past7days_header_text(num);
    summ.firstDayNum = num - 7;
    return summ;
};

function make_new_day_state(aStorage, aDateNow) {
    // aDateNow is Date.now(), the number of milliseconds elapsed since
    // 1 January 1970 00:00:00 UTC
    // We want the day to possibly change at other times than midnight,
    // so subtract offset in milliseconds from current UTC time.
    let date = get_date_with_offset(aStorage.oDayStartOffset, aDateNow),
        dayNumNow = get_day_number(date),
        monthNumNow = date.getMonth() + 1,
        weekNumNow = get_week_number(dayNumNow),

        // final dump of domain data to an array
        domainData = extract_domain_data(aStorage),
        domainsArray = get_sorted_domains(domainData);

    // create a new element in aStorage.days array (the new aStorage.days[0] ), copying the data over
    aStorage.days.unshift({
        dayNum: aStorage.today.dayNum,
        dmnsArray: domainsArray,
        totalSecs: Math.round(aStorage.totalSecs),
        headerText: aStorage.today.headerText,
        monthNum: aStorage.today.monthNum,
        weekNum: aStorage.today.weekNum
    });

    // delete old day data (keep 70 days)
    if (aStorage.days.length > 70) {
        aStorage.days.length = 70;
    }


    // Refresh summaries for past7days, week, month.
    aStorage.past7daySum = make_past7days_summ(dayNumNow, aStorage.days);
    aStorage.weekSums[0] = make_week_summ(aStorage.today.weekNum, aStorage.days);
    aStorage.monthSums[0] = make_month_summ(aStorage.today.monthNum, aStorage.days);

    // Check if we are in a new week or a new month, if so, add a new summary,
    // pushing previous one back, and remove any that are too old.
    if (aStorage.today.weekNum !== weekNumNow) {
        aStorage.weekSums.unshift(make_week_summ(weekNumNow, aStorage.days));
        aStorage.weekSums.length = 10;
    }
    if (aStorage.today.monthNum !== monthNumNow) {
        aStorage.monthSums.unshift(make_month_summ(monthNumNow, aStorage.days));
        aStorage.monthSums.length = 6;
    }

    // initialize aStorage.today object for new day's data
    aStorage.today = get_empty_today_object(aStorage.oDayStartOffset, aDateNow);
    aStorage.nextDayStartsAt = get_next_day_starts_at(aStorage.today.dayNum, aStorage.oDayStartOffset);

    // clear domain data (we have to do both STORAGE and aStorage)
    let domainKeys = get_domain_keys(aStorage);
    domainKeys.forEach(key => { delete aStorage[key]; });
    STORAGE.remove(domainKeys);
    aStorage.totalSecs = 0;

    // reset alert messages
    aStorage.nextAlertAt = get_next_alert_at(aStorage.oNotificationsRate, 0);

    gState = get_null_gState();
    return aStorage;
};

async function start_new_day(aDateNow) {
    // aDateNow is Date.now(), the number of milliseconds elapsed since
    // 1 January 1970 00:00:00 UTC
    try {
        let storage = await STORAGE.get();
        return STORAGE.set(make_new_day_state(storage, aDateNow));

    } catch (e) { console.error(e); }
};
