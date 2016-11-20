function testAdd() {
    return createFunctionFromString("sum(2,x)")(2) === 4;
}

function testMax() {
    return createFunctionFromString("max(2,x)")(5) === 5;
}

function testNestedFunctions() {
    return createFunctionFromString("sum(x,sum(x, -5))")(3) === 1;
}

function testPow() {
    return createFunctionFromString("pow(x, 4)")(2) === 16;
}

function testRecip() {
    return createFunctionFromString("recip(x, 4, 4, 0)")(2) === .5;
}

function testDivideBy0() {
    return createFunctionFromString("div(x, 0)")(2) !== Infinity
}

function runTests() {
    // for each function, run
    var ul = document.getElementById('error-display'),
        functions = [];

    for (i in window) {
        if (typeof(window[i]) === 'function' && i.indexOf('test') === 0) {
            functions.push(window[i]);
        }
    }

    for (var i=0; i<functions.length; i++) {
        var li = document.createElement("li");

        if (functions[i]()) {
            li.innerHTML = functions[i].name + ": PASS";
            li.setAttribute('class', 'pass');
        } else {
            li.innerHTML = functions[i].name + ": FAIL";
            li.setAttribute('class', 'fail');
        }
        ul.appendChild(li);
    }
}

