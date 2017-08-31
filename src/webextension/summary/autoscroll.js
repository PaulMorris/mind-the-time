
function current_y_position() {
    if (self.pageYOffset)
        return self.pageYOffset;
    if (document.documentElement && document.documentElement.scrollTop)
        return document.documentElement.scrollTop;
    if (document.body.scrollTop)
        return document.body.scrollTop;
    return 0;
};

function elem_y_position(eID) {
    var elm = document.getElementById(eID),
        y = elm.offsetTop,
        node = elm;
    while (node.offsetParent && node.offsetParent != document.body) {
        node = node.offsetParent;
        y += node.offsetTop;
    }
    return y;
};

function scroll_some(leapY) {
    window.scrollTo(0, leapY);
};

function smooth_scroll(eID) {
    var startY = current_y_position(),
        stopY = elem_y_position(eID) - 35,
        distance = stopY > startY ? stopY - startY : startY - stopY;
    if (distance < 100) {
        scrollTo(0, stopY);
        return;
    }
    var speed = Math.round(distance / 100);
    if (speed >= 20) speed = 20;
    var step = Math.round(distance / 25),
        leapY = stopY > startY ? startY + step : startY - step;
        timer = 0;
    if (stopY > startY) {
        for (var i = startY; i < stopY; i += step) {
            setTimeout(scroll_some, timer * speed, leapY);
            leapY += step;
            if (leapY > stopY) leapY = stopY;
            timer += 1;
        }
        return;
    }
    for (var i = startY; i > stopY; i -= step) {
        setTimeout(scroll_some, timer * speed, leapY);
        leapY -= step;
        if (leapY < stopY) leapY = stopY;
        timer++;
    }
};

// listen for "show only 10 rows" and scroll to boxId, passed as event
window.addEventListener('message', event => smooth_scroll(event.data), false);
