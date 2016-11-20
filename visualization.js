var LABEL_SPACING = 40,
    hasError = false,
    solrToJS = {
        'max': Math.max,
        'min': Math.min,
        'sum': function(a, b) {
            return parseFloat(a, 10) + parseFloat(b, 10);
        },
        'sub': function(a, b) {
            return parseFloat(a, 10) - parseFloat(b, 10);
        },
        'product': function(a, b) {
            return parseFloat(a, 10) * parseFloat(b, 10);
        },
        'div': function(a, b) {
            // TODO: elegantly handle divide by 0
            return parseFloat(a, 10) / parseFloat(b, 10);
        },
        'mod': function(a, b) {
            return parseFloat(a, 10) % parseFloat(b, 10);
        },
        'exp': Math.exp,
        'pow': Math.pow,
        'abs': Math.abs,
        'log': Math.log,
        'sqrt': Math.sqrt,
        'tanh': Math.tanh || function(x) {
            if (x === Infinity) {
                return 1;
            } else if (x === -Infinity) {
                return -1;
            } else {
                return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x));
            }
        },
        'recip': function(x, m, a, b) {
            return a/(m * x + b)
        }
    };

// converts a string representation of parameters into the constituent parts
//
// PARAMETERS
// paramsString: string with parameters ie: '100, div(x, 30)'
//
// RETURNS
// array of top-level parameter strings ie: ['100', 'div(x, 30)']
function splitParams(paramsString) {
    // TODO: replace with a regex?

    var params = [''],
        paramsIdx = 0,
        openCount = 0;

    for (var i = 0; i < paramsString.length; i++) {
        if (openCount === 0 && paramsString[i] === ',') {
            paramsIdx += 1;
            params[paramsIdx] = '';
        } else {
            params[paramsIdx] += paramsString[i];

            if (paramsString[i] === '(') {
                openCount += 1;
            } else if (paramsString[i] === ')') {
                openCount -= 1;
            }
        }
    }

    return params;
}


// returns a javascript function from the given solr algorithm
//
// PARAMETERS
// funcString: solr algorithm in string format ie: 'div(x, 50)'
//
// RETURNS
// javascript function from the given string
// ie: effectively returns function(x) { return function(x){return x;}(x) / 50 }
function createFunctionFromString(funcString) {
    var action = '',
        temp = '',
        params = [],
        evaluatedParams = [],
        solrAction = '',
        jsAction = '',
        i;

    solrAction = funcString.split('(')[0];
    jsAction = solrToJS[solrAction];
    
    if (jsAction) {
        paramsString = funcString.slice(funcString.indexOf('(') + 1, funcString.lastIndexOf(')'));

        params = splitParams(paramsString);

        for (i = 0; i < params.length; i++) {
            evaluatedParams[i] = createFunctionFromString(params[i]);
        }

        return function(x) {
            var newEvaluatedParams = []
            for (i = 0; i < params.length; i++) {
                newEvaluatedParams[i] = evaluatedParams[i](x);
            }
            return jsAction.apply(this, newEvaluatedParams);
        }
    }

    // if the string is a number, return the number
    // TODO: throw an error if a user gives a value like "45foo" or Infinity
    if (!isNaN(parseFloat(funcString))) {
        return function(x) {
            return parseFloat(funcString);
        };
    } else if (funcString === 'x') {
        // if the string is 'x' (the representative of field name) then return the variable x
        return function(x) {
            return x;
        };
    }

    hasError = true;
}

// Return (x,y) points between xstart and xend for the given scoreFunction
//
// PARAMETERS
// scoreFunction: javascript function that will return a y value for any given x
// xstart: smallest x value to graph
// xend: largest x value to graph
//
// RETURNS
// dictionary containing:
//     nodes: array of dictionaries with x,y for each point
//     maxY: maximum Y value of all points
//     minY: minumum Y value of all points
function calculateGraphData(scoreFunction, xstart, xend) {
    var nodes = [],
        maxY = 0,
        minY = 0,
        i,
        y;

    for (i = parseFloat(xstart, 10); i <= xend; i += 0.2) {
        y = scoreFunction(i)

        nodes.push({
            'x': i,
            'y': y
        });

        if (y > maxY) {
            maxY = y;
        }
        else if (y < minY) {
            minY = y;
        }
    }

    return {
        'nodes': nodes,
        'maxY': maxY,
        'minY': minY
    };
}


function drawXAxis(svg, yOffset, xScale, viewportWidth, fieldName) {
    var xAxis = d3.svg.axis()
        .scale(xScale)
        .orient('bottom')
        .tickSize(1);

    svg.append('svg:g')
        .attr('class', 'xaxis')
        .attr('transform', 'translate(0,' + yOffset + ')')
        .call(xAxis);

    svg.append('svg:g')
        .append('text')
        .attr('class', 'graph-label')
        .attr('transform', 'translate(' + (viewportWidth / 2) + ',' + (yOffset + LABEL_SPACING) + ')')
        .attr('text-anchor', 'middle')
        .text(fieldName);
}

function drawYAxis(svg, xOffset, yScale, viewportHeight) {
    var yAxis = d3.svg.axis()
        .scale(yScale)
        .orient('left')
        .tickSize(1);

    svg.append('svg:g')
        .attr('class', 'yaxis')
        .attr('transform', 'translate(' +  xOffset + ', 0)')
        .call(yAxis);

    svg.append('svg:g')
        .attr('transform', 'translate(' +  (xOffset - LABEL_SPACING) + ',' + (viewportHeight / 2) + ')')
        .append('text')
        .attr('class', 'graph-label')
        .attr('text-anchor', 'middle')
        .attr('transform', 'rotate(-90)')
        .text('score');
}


// Draw the graph from the given data.
//
// PARAMETERS
// graphData: array of dictionaries with x and y fields
// xstart: smallest x value on graph
// xend: largest x value on graph
function drawGraph(graphData, xstart, xend, fieldName) {
    var maxY,
        minY,
        dataSet,
        xScale,
        yScale,
        svg,
        yOffset = 0,
        xOffset = 0,
        viewportWidth,
        viewportHeight;

    maxY = graphData['maxY'];
    minY = graphData['minY'];
    dataSet = graphData['nodes'];

    viewportWidth = window.innerWidth - 300,
    viewportHeight = window.innerHeight - 400;

    xScale = d3.scale.linear()
                .domain([xstart, xend])
                .range([0, viewportWidth]);

    yScale = d3.scale.linear()
                .domain([maxY, minY])
                .range([0, viewportHeight]);
    
    document.getElementById('graph').innerHTML = '';
    svg = d3.select('#graph')
        .append('svg')
        .attr('width', viewportWidth + 100)
        .attr('height', viewportHeight + 100)
        .append('svg:g')
        .attr('transform', 'translate(50,15)');

    svg.selectAll('circle')
        .data(dataSet)
        .enter()
        .append('circle')
        .attr('cx', function(d) {
              return xScale(d.x); 
        })
        .attr('cy', function(d) {
              return yScale(d.y); 
        })
        .attr('r', 4); 

    yOffset = viewportHeight * maxY / (maxY - minY);
    if (xstart < 0) {
        xOffset = Math.abs(xstart)/(xend - xstart) * viewportWidth;
    }
    
    drawXAxis(svg, yOffset, xScale, viewportWidth, fieldName);
    drawYAxis(svg, xOffset, yScale, viewportHeight);
}

function resetDisplay() {
    hasError = false;

    document.getElementById('error-display').innerHTML = '';
    document.getElementById('graph').innerHTML = '';
}

// Update the graph with values from the fields in the DOM
function updateGraph() {
    var algorithmString = document.getElementById('algorithm').value,
        xstart = document.getElementById('x-start').value,
        xend = document.getElementById('x-end').value,
        fieldName = document.getElementById('field-name').value,
        errorDisplay = document.getElementById('error-display'),
        errorString = '';

    resetDisplay();

    algorithmString = algorithmString.replace(/\s+/g, '');

    // TODO: handle the case where a fieldName is a subset of a function
    // use 'x' for the fieldName in the background
    algorithmString = algorithmString.replace(fieldName, 'x');

    scoreFunction = createFunctionFromString(algorithmString, errorString);
    if (hasError) {
        errorDisplay.innerHTML = 'There is an error with the algorithm input, please try again';
    } else {
        graphData = calculateGraphData(scoreFunction, xstart, xend)
        drawGraph(graphData, xstart, xend, fieldName);
    }

}
