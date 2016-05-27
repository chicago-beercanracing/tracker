var _height = 500;
var _width = 500;

function asyncCounter(numCalls, callback) {
    this.callback = callback;
    this.numCalls = numCalls;
    this.calls = 0;
}

asyncCounter.prototype.increment = function() {
    this.calls++;
    if (this.calls >= this.numCalls) {
        this.callback();
    }
}

var myAsyncCounter = new asyncCounter(3, draw);

var _wpdata;
var _codata;
d3.xml("../../common/waypoints.xml", function(error, data) {
    if (error) throw error;
    // Convert the XML document to an array of objects.
    // Note that querySelectorAll returns a NodeList, not a proper Array,
    // so we must use map.call to invoke array methods.
    _wpdata = [].map.call(data.querySelectorAll("wp"), function(wp) {
        return {
            id: wp.getAttribute("id"),
            lat: parseFloat(wp.getAttribute("lat")),
            lon: parseFloat(wp.getAttribute("lon"))
        };
    });

    _codata = [].map.call(data.querySelectorAll("course"), function(course) {
        return {
            name: course.getAttribute("name"),
            length: course.getAttribute("length"),
            wps: [].map.call(course.querySelectorAll("m"), function(mark) {
                return {
                    id: mark.getAttribute("id")
                }
            })
        };
    });
    myAsyncCounter.increment();
})


var _cdata;
d3.xml("../../common/classes.xml", function(error, data) {
    if (error) throw error;
    // Convert the XML document to an array of objects.
    // Note that querySelectorAll returns a NodeList, not a proper Array,
    // so we must use map.call to invoke array methods.
    _cdata = [].map.call(data.querySelectorAll("boat"), function(boat) {
        return {
            id: boat.getAttribute("id"),
            name: boat.getAttribute("name"),
            color: boat.getAttribute("color"),
            section: boat.getAttribute("section"),
            clas: boat.getAttribute("class"),
            rating: boat.getAttribute("rating"),
            flag: boat.getAttribute("flag")
        }
    });
    myAsyncCounter.increment();
})

var _rdata;
d3.xml("racedata.xml", function(error, data) {
    if (error) throw error;

    // Convert the XML document to an array of objects.
    // Note that querySelectorAll returns a NodeList, not a proper Array,
    // so we must use map.call to invoke array methods.
    _rdata = [].map.call(data.querySelectorAll("section"), function(section) {
        return {
            id: section.getAttribute("id"),
            start: section.getAttribute("start"),
            boats: [].map.call(section.querySelectorAll("boat"), function(boat) {
                return {
                    id: boat.getAttribute("id"),
                    positions: [].map.call(boat.querySelectorAll("p"), function(p) {
                        return {
                            time: p.getAttribute("t"),
                            lat: parseFloat(p.getAttribute("l")),
                            lon: parseFloat(p.getAttribute("o"))
                        }
                    })
                }
            })
        };
    });
    myAsyncCounter.increment();
})

var _xAxis;
var _yAxis;
var _x;
var _y;
var _svg;
var _objects;
var _margin = {
        top: 20,
        right: 20,
        bottom: 30,
        left: 40
    },
    width = 600 - _margin.left - _margin.right,
    height = 600 - _margin.top - _margin.bottom;
var _currMaxTime = 0;


var markerData = [
    {x:0, y:0},
    {x:0, y:4},
    {x:9, y:2}
]

var markLine = d3.svg.line()
    .x(function(d){return d.x;})
    .y(function(d){return d.y;})
    .interpolate("cardinal-closed");


function draw() {

    var minTime = Infinity;
    var maxTime = -Infinity;
    var minLat = Infinity;
    var maxLat = -Infinity;
    var minLon = Infinity;
    var maxLon = -Infinity;

    _rdata.forEach(function(race) {
        race.boats.forEach(function(boat) {
            boat.positions.forEach(function(position) {
                minTime = Math.min(minTime, position.time)
                maxTime = Math.max(maxTime, position.time)
                minLat = Math.min(minLat, position.lat)
                maxLat = Math.max(maxLat, position.lat)
                minLon = Math.min(minLon, position.lon)
                maxLon = Math.max(maxLon, position.lon)
            })
        })
    })

    _currMaxTime = maxTime;

    _x = d3.scale.linear()
        .domain([-87.58117, -87.53250])
        .range([0, width]);

    _y = d3.scale.linear()
        .domain([41.83, 41.87])
        .range([height, 0]);

    _xAxis = d3.svg.axis()
        .scale(_x)
        .orient("bottom")
        .tickSize(-height);

    _yAxis = d3.svg.axis()
        .scale(_y)
        .orient("left")
        .ticks(5)
        .tickSize(-width);

    var zoom = d3.behavior.zoom()
        .x(_x)
        .y(_y)
        .scaleExtent([0.1, 100])
        .on("zoom", zoomed);

    _svg = d3.select("#chart").append("svg")
        .attr("width", width + _margin.left + _margin.right)
        .attr("height", height + _margin.top + _margin.bottom)
        .append("g")
        .attr("transform", "translate(" + _margin.left + "," + _margin.top + ")")
        .call(zoom);

    var defs = _svg.append("defs")
    d3.set(
        _cdata.map(function(d) {
            return d.color;})
        ).values().forEach(function(color)
        {
            defs.append("marker")
            .attr("id", "boat"+color.replace("#",""))
            .attr("markerWidth", 10)
            .attr("markerHeight", 10)
            .attr("refX",0)
            .attr("refY",2)
            .attr("orient","auto")
            .attr("markerUnits","strokeWidth")
            .append("path")
            .data([markerData])
            .attr("d", function(d) {return markLine(d) + "Z";})
            .attr("fill", color)
            .attr("stroke", color)
            .attr("strokeWidth", 2)
        })

    _svg.append("rect")
        .attr("width", width)
        .attr("height", height);

    _svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(_xAxis);

    _svg.append("g")
        .attr("class", "y axis")
        .call(_yAxis);

    var slider = d3.slider()
        .axis(true)
        .min(minTime)
        .max(maxTime)
        .step(1)
        .on("slide", slide)
        .value(maxTime)

    d3.select("#slider")
        .style("width", 600 + 'px')
        .call(slider);

    _objects = _svg.append("svg")
        .classed("objects", true)
        .attr("width", width)
        .attr("height", height)

    var marks = _objects.selectAll(".dot")
        .data(_wpdata)
        .enter().append("circle")
        .classed("dot", true)
        .attr("transform", transform)
        .attr("r", 6)
        .attr("fill", "red");


    var rc = _objects.selectAll(".dot[rc]")


    d3.select("#sections").selectAll("input")
        .data(d3.set(_cdata.map(function(d) {
            return d.section;
        })).values())
        .enter()
        .append("label")
        .text(function(d) {
            return d;
        })
        .append("input")
        .attr("checked", true)
        .attr("type", "checkbox")
        .attr("value", function(d) {
            return d;
        })
        .on("change", inputSectionClick)

    updateClasses();
    updateBoats();
    updatePos();

}

function inputSectionClick() {
    updateClasses();
    updateBoats();
    updatePos();
}

function updateClasses()
{
    var checked = d3.select("#sections")
        .selectAll("input")[0] //0 because select keeps the structure and out inputs are within labels
        .filter(function(d) {
            return d.checked;
        })
        .map(function(d) {
            return d.value;
        })
                                           //find boats to be displayed from selected sections
     var boats = _cdata.filter(function(boat) {
         return checked.some(function(checkedVal) {
             return boat.section === checkedVal;
         })
     });

     var classes = d3.set(boats.map(function(boat) {
             return boat.clas;}))
         .values()

     var clasList = d3.select("#classes")
     clasList.selectAll("label").remove()
     clasList.selectAll("input")
     .data(classes)
     .enter()
     .append("label")
     .text(function(d) {
         return d;
     })
     .append("input")
     .attr("checked", true)
     .attr("type", "checkbox")
     .attr("value", function(d) {
         return d;
     })
     .on("change", inputClassClick)
}

function inputClassClick() {
    updateBoats();
    updatePos();
}

function slide(evt, posixTime) {
    _currMaxTime = posixTime
    updatePos();
}

function updateBoats() {
    //find selected sections
    var checked = d3.select("#classes")
        .selectAll("input")[0] //0 because select keeps the structure and out inputs are within labels
        .filter(function(d) {
            return d.checked;
        })
        .map(function(d) {
            return d.value;
        })

    //find boats to be displayed from selected sections
    var boats = _cdata.filter(function(boat) {
        return checked.some(function(checkedVal) {
            return boat.clas === checkedVal;
        })
    });

    //add selected boats and colors
    var blist = d3.select("#boats")
    blist.selectAll("div").remove()
    boats.forEach(function(boat) {
        var legend = blist.append("div")
            .attr("class", "legend")
        var legendSvg = legend.append("svg")
            .attr("width", 200)
            .attr("height", 20)
        legendSvg.append("rect")
            .attr("width", 20)
            .attr("height", 20)
            .style("fill", function(d) {
                var boatObj = boats.filter(function(bo) {
                    return bo.id === boat.id;
                })
                return boatObj[0].color;
            })
        legendSvg.append("text")
            .text(boat.name)
            .attr("x", 25)
            .attr("y", 17)
            .attr("font-family", "sans-serif")
            .attr("font-size", 13 + "px")
            .attr("fill", "#000000")
    })
}

function updatePos() {
    //remove all positions
    _objects.selectAll(".pos").remove();
    _objects.selectAll(".trace").remove();
    //find selected sections
    var checked = d3.select("#classes")
        .selectAll("input")[0] //0 because select keeps the structure and out inputs are within labels
        .filter(function(d) {
            return d.checked;
        })
        .map(function(d) {
            return d.value;
        })

    //find boats to be displayed from selected sections
    var boats = _cdata.filter(function(boat) {
        return checked.some(function(checkedVal) {
            return boat.clas === checkedVal;
        })
    });
    var boatsSel = boats.map(function(boat) {
        return boat.id
    });

    //add positions with time lower than given as parameter
    _rdata.forEach(function(race) {
        race.boats.filter(function(boat) {
                return boatsSel.some(function(boatID) {
                    return boat.id === boatID;
                })
            })
            .forEach(function(boat) {
                var trace = _objects.selectAll(".trace[boat=" + boat.id + "]")
                    .data([boat.positions.filter(function(d) {
                        return d.time <= _currMaxTime
                        })])
                    .enter()
                    .append("path")
                    .classed("trace", true)
                    .attr("d", line)
                    .attr("fill", "none")
                    .attr("stroke", function(d) {
                        var boatObj = boats.filter(function(bo) {
                            return bo.id === boat.id;
                        })
                        return boatObj[0].color;
                     })
                     .attr("stroke-width", 2)
                     .attr("marker-end", function(d) {
                         var boatObj = boats.filter(function(bo) {
                             return bo.id === boat.id;
                         })
                         return "url(#boat"+boatObj[0].color.replace("#","")+")";})
            })
    })
}

var line =  d3.svg.line()
        .x(function(d){return _x(d.lon);})
        .y(function(d){return _y(d.lat);})

//We use the same function to transform Marks and Boat positions
function transform(d) {
    return "translate(" + _x(d.lon) + "," + _y(d.lat) + ")";
}

function zoomed() {
    _svg.select(".x.axis").call(_xAxis);
    _svg.select(".y.axis").call(_yAxis);

    _objects.selectAll(".dot")
        .attr("transform", transform);

    _objects.selectAll("path")
            .attr("d", line);
}

function reset() {
    d3.transition().duration(750).tween("zoom", function() {
        var ix = d3.interpolate(_x.domain(), [-width / 2, width / 2]),
            iy = d3.interpolate(_y.domain(), [-height / 2, height / 2]);
        return function(t) {
            zoom.x(_x.domain(ix(t))).y(_y.domain(iy(t)));
            zoomed();
        };
    });
}
