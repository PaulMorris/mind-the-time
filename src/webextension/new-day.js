// Handle shuffling data for a new day

"use strict";

var get_week_header_text = (weekNum) => {
    let from = new Date((weekNum + 1) * ONE_DAY_MS),
        to = new Date(from.getTime() + (6 * ONE_DAY_MS)),
        fromMonth = from.getMonth() + 1,
        fromDate = from.getDate(),
        toMonth = to.getMonth() + 1,
        toDate = to.getDate();

    return WEEK_WORD + " " + fromMonth + "/" + fromDate + " - " + toMonth + "/" + toDate;
};

var get_past7days_header_text = (num) => {
    let from = new Date((num - 6) * ONE_DAY_MS), // a week ago
        to = new Date(num * ONE_DAY_MS), // yesterday
        fromMonth = from.getMonth() + 1,
        fromDate = from.getDate(),
        toMonth = to.getMonth() + 1,
        toDate = to.getDate();

    return PAST_7_DAYS_TEXT + "   " + fromMonth + "/" + fromDate + " - " + toDate + "/" + toDate;
};

var domain_obj_to_array = (obj) => {
    // takes a domains object and generates an array of sorted domain data
    let arr = [];

    for (let key in obj) {
        if (obj.hasOwnProperty(key) && obj[key] !== 0) {
            // round to the nearest second
            arr.push([ key, Math.round(obj[key]) ]);
        }
    }
    // return sorted array
    return arr.sort((a, b) => b[1] - a[1]);
};

var combine_data_from_days = (sourceArray) => {
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
    summ.dmnsArray = domain_obj_to_array( dmns );
    return summ;
};

var get_daily_totals = (sourceArray) => {
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

var make_month_summ = (monthNum, days) => {

    let daysSubset = days.filter((day) => day && day.monthNum && day.monthNum === monthNum),
        summ = combine_data_from_days(daysSubset);

    summ.headerText = MONTH_NAMES[monthNum % 12];
    summ.monthNum = monthNum;
    return summ;
};

var make_week_summ = (weekNum, days) => {

    let daysSubset = days.filter((day) => day && day.weekNum && day.weekNum === weekNum),
        summ = combine_data_from_days(daysSubset);

    summ.daysArray = get_daily_totals(daysSubset);
    summ.headerText = get_week_header_text(weekNum);
    summ.weekNum = weekNum;
    return summ;
};

var make_past7days_summ = (num, days) => {

    let daysSubset = days.filter((day) => day && day.dayNum > num - 8 && day.dayNum < num),
        summ = combine_data_from_days(daysSubset);

    summ.daysArray = get_daily_totals(daysSubset);
    summ.headerText = get_past7days_header_text(num);
    summ.firstDayNum = num - 7;
    return summ;
};

var make_new_day_state = (aStorage) => {
    // We want the day to possibly change at other times than midnight,
    // so subtract offset in milliseconds from current UTC time.
    let date = new Date(Date.now() - (aStorage.oDayStartOffset * ONE_HOUR_MS)),
        dayNumNow = get_day_number(date),
        monthNumNow = date.getMonth() + 1,
        weekNumNow = get_week_number(dayNumNow),

        // final dump of domain data to an array
        domainData = extract_domain_data(aStorage),
        domainsArray = domain_obj_to_array(domainData);

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

    // check for new week and new month
    // make a final summary and remove any extra elements
    if (aStorage.today.weekNum !== weekNumNow) {
        aStorage.weekSums[0] = make_week_summ(aStorage.today.weekNum, aStorage.days);
        // we are about to add a new one below to make 10
        aStorage.weekSums.length = 9;
    }
    if (aStorage.today.monthNum !== monthNumNow) {
        aStorage.monthSums[0] = make_month_summ(aStorage.today.monthNum, aStorage.days);
        // we are about to add a new one below to make 6
        aStorage.monthSums.length = 5;
    }

    // initialize aStorage.today object for new day's data
    aStorage.today = get_empty_today_object(aStorage.oDayStartOffset);
    aStorage.nextDayStartsAt = get_next_day_starts_at(aStorage.today.dayNum, aStorage.oDayStartOffset);

    // clear domain data (we have to do both STORAGE and aStorage)
    let domainKeys = get_domain_keys(aStorage);
    domainKeys.forEach(key => { delete aStorage[key]; });
    STORAGE.remove(domainKeys);
    aStorage.totalSecs = 0;

    // make current summaries for week, month, past7days
    aStorage.past7daySum = make_past7days_summ(dayNumNow, aStorage.days);
    aStorage.weekSums.unshift(make_week_summ(weekNumNow, aStorage.days));
    aStorage.monthSums.unshift(make_month_summ(monthNumNow, aStorage.days));

    // reset alert messages
    aStorage.nextAlertAt = get_next_alert_at(aStorage.oNotificationsRate, 0);

    gState = get_null_gState();
    return aStorage;
};

async function start_new_day() {
    try {
        let storage = await STORAGE.get();
        return STORAGE.set(make_new_day_state(storage));
    } catch (e) {
        console.error(e);
    }
};
