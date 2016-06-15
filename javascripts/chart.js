/*
* Copyright (c) 2016, David Dieffenthaler.  All rights reserved.
* Copyrights licensed under the New BSD License.
* See the accompanying LICENSE file for terms.
*/

/* global tickFn */

function asyncCounter(numCalls, callback) {
    this.callback = callback;
    this.numCalls = numCalls;
    this.calls = 0;
}

asyncCounter.prototype.increment = function () {
    this.calls++;
    if (this.calls >= this.numCalls) {
        this.callback();
    }
};

var myAsyncCounter = new asyncCounter(2, draw);

var _cdata;
d3.xml("../../common/boats.xml", function (error, data) {
    if (error)
        throw error;
    // Convert the XML document to an array of objects.
    // Note that querySelectorAll returns a NodeList, not a proper Array,
    // so we must use map.call to invoke array methods.
    _cdata = [].map.call(data.querySelectorAll("boat"), function (boat) {
        return {
            id: boat.getAttribute("id"),
            name: boat.getAttribute("name"),
            color: boat.getAttribute("color"),
            section: boat.getAttribute("section"),
            clas: boat.getAttribute("class"),
            rating: boat.getAttribute("rating"),
            flag: boat.getAttribute("flag")
        };
    });
    myAsyncCounter.increment();
});

function parseBool(value) {
    return value.toLowerCase() == "true" ? true : false
}

var _rdata;
d3.xml("racedata.xml", function (error, data) {
    if (error)
        throw error;

    // Convert the XML document to an array of objects.
    // Note that querySelectorAll returns a NodeList, not a proper Array,
    // so we must use map.call to invoke array methods.
    _rdata = [].map.call(data.querySelectorAll("race"), function (race) {
        return {
            date: race.getAttribute("date"),
            couse: race.getAttribute("course"),
            lat: race.getAttribute("rclat"),
            lon: race.getAttribute("rclon"),
            course: [].map.call(race.querySelectorAll("course"), function (course) {
                return {
                    loop: parseBool(course.getAttribute("loop")),
                    ratio: parseFloat(course.getAttribute("ratio")),
                    marks: [].map.call(course.querySelectorAll("m"), function (mark) {
                        return {
                            id: mark.getAttribute("id"),
                            lat: parseFloat(mark.getAttribute("lat")),
                            lon: parseFloat(mark.getAttribute("lon"))
                        };
                    })
                }
            }),
            sections: [].map.call(race.querySelectorAll("section"), function (section) {
                return {
                    id: section.getAttribute("id"),
                    start: section.getAttribute("start"),
                    boats: [].map.call(section.querySelectorAll("boat"), function (boat) {
                        return {
                            id: boat.getAttribute("id"),
                            positions: [].map.call(boat.querySelectorAll("p"), function (p) {
                                return {
                                    time: p.getAttribute("t"),
                                    lat: parseFloat(p.getAttribute("l")),
                                    lon: parseFloat(p.getAttribute("o"))
                                };
                            })
                        };
                    })
                };
            })
        };
    });
    myAsyncCounter.increment();
});

var _sqSize = 600;//Math.floor(window.innerWidth/2);
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

_width = _sqSize - _margin.left - _margin.right,
        height = _sqSize - _margin.top - _margin.bottom;
var _currMaxTime = 0;


var boatMarkerData = [
    {x: 0, y: 0},
    {x: 0, y: 4},
    {x: 9, y: 2}
];

var boatMarkLine = d3.svg.line()
        .x(function (d) {
            return d.x;
        })
        .y(function (d) {
            return d.y;
        })
        .interpolate("cardinal-closed");

var _timerStep = 1;
var _timerEnabled = true;
var _slider;
var _zoom;

function draw() {

    var minTime = Infinity;
    var maxTime = -Infinity;
    var minLat = Infinity;
    var maxLat = -Infinity;
    var minLon = Infinity;
    var maxLon = -Infinity;

    _rdata[0].sections.forEach(function (section) {
        section.boats.forEach(function (boat) {
            boat.positions.forEach(function (position) {
                minTime = Math.min(minTime, position.time);
                maxTime = Math.max(maxTime, position.time);
                minLat = Math.min(minLat, position.lat);
                maxLat = Math.max(maxLat, position.lat);
                minLon = Math.min(minLon, position.lon);
                maxLon = Math.max(maxLon, position.lon);
            });
        });
    });
    _rdata[0].course[0].marks.forEach(function (wp) {
        minLat = Math.min(minLat, wp.lat);
        maxLat = Math.max(maxLat, wp.lat);
        minLon = Math.min(minLon, wp.lon);
        maxLon = Math.max(maxLon, wp.lon);
    });

    //calculates the lat lon min and max to make a display appproximately squared rgarding distances displayed horizontally and vertically using the local approximation ratio
    deltaLon = maxLon-minLon;
    halfLon = deltaLon/2;
    midLon = halfLon + minLon;
    deltaLat = maxLat-minLat;
    halfLat = deltaLat/2;
    midLat = halfLat + minLat;
    ratio = deltaLon/deltaLat;
    if(ratio > _rdata[0].course[0].ratio)
    {//widen lat
        deltaLat = deltaLon/_rdata[0].course[0].ratio;
        halfLat = deltaLat/2;
    }
    else
    {//strech lon
        deltaLon = deltaLat*_rdata[0].course[0].ratio;
        halfLon = deltaLon/2;
    }

    minLat = midLat - halfLat;
    maxLat = midLat + halfLat;
    minLon = midLon - halfLon;
    maxLon = midLon + halfLon;

    _currMaxTime = maxTime;

    _x = d3.scale.linear()
            .domain([minLon, maxLon])
            .range([0, _width]);

    _y = d3.scale.linear()
            .domain([minLat, maxLat])
            .range([height, 0]);

    _xAxis = d3.svg.axis()
            .scale(_x)
            .orient("bottom")
            .tickSize(-height);

    _yAxis = d3.svg.axis()
            .scale(_y)
            .orient("left")
            .ticks(5)
            .tickSize(-_width);

    _zoom = d3.behavior.zoom()
            .x(_x)
            .y(_y)
            .scaleExtent([0.1, 100])
            .on("zoom", zoomed);

    _svg = d3.select("#chart").append("svg")
            .attr("width", _width + _margin.left + _margin.right)
            .attr("height", height + _margin.top + _margin.bottom)
            .append("g")
            .attr("transform", "translate(" + _margin.left + "," + _margin.top + ")")
            .call(_zoom);

    var defs = _svg.append("defs");
    d3.set(
            _cdata.map(function (d) {
                return d.color;
            })
            ).values().forEach(function (color)
    {
        defs.append("marker")
                .attr("id", "boat" + color.replace("#", ""))
                .attr("markerWidth", 10)
                .attr("markerHeight", 10)
                .attr("refX", 0)
                .attr("refY", 2)
                .attr("orient", "auto")
                .attr("markerUnits", "strokeWidth")
                .append("path")
                .data([boatMarkerData])
                .attr("d", function (d) {
                    return boatMarkLine(d) + "Z";
                })
                .attr("fill", color)
                .attr("stroke", color)
                .attr("strokeWidth", 2);
    });

    _svg.append("rect")
            .attr("width", _width)
            .attr("height", height);

    _svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(_xAxis);

    _svg.append("g")
            .attr("class", "y axis")
            .call(_yAxis);

    _slider = d3.slider()
            .axis(true)
            .min(minTime)
            .max(maxTime)
            .step(1)
            .on("slide", slide)
            .value(minTime);

    d3.select("#slider")
            .style("width", _sqSize + 200 + 'px')
            .call(_slider);

    _objects = _svg.append("svg")
            .classed("objects", true)
            .attr("width", _width)
            .attr("height", height);

    var marks = _objects.selectAll(".dot")
            .data(_rdata[0].course[0].marks)
            .enter().append("circle")
            .classed("dot", true)
            .attr("transform", transform)
            .attr("r", 6)
            .attr("fill", "red")
            .append("svg:title")
            .text(function (d) {
                return d.id;
            });

    var rc = _objects.selectAll(".dot[rc]")
            .data(_rdata)
            .enter().append("circle")
            .classed("dot", true)
            .attr("transform", transform)
            .attr("r", 6)
            .attr("fill", "orange")
            .append("svg:title")
            .text("Race Committee");

    d3.select("#sections").selectAll("input")
            .data(d3.set(_rdata[0].sections.map(function (d) {
                return d.id;
            })).values())
            .enter()
            .append("label")
            .text(function (d) {
                return d;
            })
            .append("input")
            .attr("checked", true)
            .attr("type", "checkbox")
            .attr("value", function (d) {
                return d;
            })
            .on("change", inputSectionClick);

    updateClasses();
    updateBoats();
    //updatePos();

    setInterval(tickFn, 100); //100 ms interval
    _timerStep = (maxTime-minTime)/600; //600 * 100ms interval = 1 min total replay time
    _timerEnabled = true;
    d3.select("#startbtn").text("Pause");
}

function ToogleTimer()
{
    _timerEnabled = !_timerEnabled;
    if(_timerEnabled){
        if(_slider.value() === _slider.max()){
            _slider.value(_slider.min());
        }
        d3.select("#startbtn").text("Pause");
    }
    else{
        d3.select("#startbtn").text("Start");
    }
}


function SlowSpeed()
{
    _timerStep = _timerStep / 1.1;
}

function AccelerateSpeed()
{
    _timerStep = _timerStep * 1.1;
}

function tickFn()
{
    if(_timerEnabled){
        var time = Math.min(_slider.value()+_timerStep, _slider.max());
        if(_currMaxTime != time){//to save CPU from redrawing un-necessarly
            _currMaxTime = time;
            _slider.value(time);
            updatePos();
        }
        if(_slider.value() === _slider.max()){
            ToogleTimer();
        }
    }

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
            .filter(function (d) {
                return d.checked;
            })
            .map(function (d) {
                return d.value;
            });
    var classes = [];
    _rdata[0].sections.forEach(function(section){
        if(checked.some(function(d){return d === section.id}))
        {//the section is selected
            section.boats.forEach(function(boat){

              _cdata.forEach(function (boatData) {
                    if(boatData.id === boat.id)
                    {
                        classes = classes.concat([boatData.clas]);
                    }
                });
            });
        }
    });
    classes = d3.set(classes).values();//keep only unique records
    var clasList = d3.select("#classes")
    clasList.selectAll("label").remove()
    clasList.selectAll("input")
            .data(classes)
            .enter()
            .append("label")
            .text(function (d) {
                return d;
            })
            .append("input")
            .attr("checked", true)
            .attr("type", "checkbox")
            .attr("value", function (d) {
                return d;
            })
            .on("change", inputClassClick);
}

function inputClassClick() {
    updateBoats();
    updatePos();
}

function slide(evt, posixTime) {
    if(_timerEnabled){
        ToogleTimer();
    }
    _currMaxTime = posixTime;
    updatePos();
}

var _checkedClasses;
var _selectedBoats;
var _selectedBoatIDs;

function updateBoats() {
    //find selected sections
    _checkedClasses = d3.select("#classes")
            .selectAll("input")[0] //0 because select keeps the structure and out inputs are within labels
            .filter(function (d) {
                return d.checked;
            })
            .map(function (d) {
                return d.value;
            });
     //find boats to be displayed from selected sections
    _selectedBoats = _cdata.filter(function (boat) {
        return _checkedClasses.some(function (checkedVal) {
            return boat.clas === checkedVal;
        });
    });
    _selectedBoatIDs = _selectedBoats.map(function (boat) {
        return boat.id;
    });

    var checkedSections = d3.select("#sections")
            .selectAll("input")[0] //0 because select keeps the structure and out inputs are within labels
            .filter(function (d) {
                return d.checked;
            })
            .map(function (d) {
                return d.value;
            });

    var boats = [];
    _rdata[0].sections.forEach(function(section){
        if(checkedSections.some(function(d){return d === section.id}))
        {//the section is selected
            section.boats.forEach(function(boat){

                 _cdata.forEach(function (boatData) {
                    if(_checkedClasses.some(function(d){return d === boatData.clas})
                            && boat.id === boatData.id)
                    {
                        boats = boats.concat([boatData]);
                    }
                });
            });
        }
    });

    //add selected boats and colors
    var blist = d3.select("#boats")
    blist.selectAll("div").remove()
    boats.forEach(function (boat) {
        var legend = blist.append("div")
                .attr("class", "legend")
        var legendSvg = legend.append("svg")
                .attr("width", 200)
                .attr("height", 20)
        legendSvg.append("rect")
                .attr("width", 20)
                .attr("height", 20)
                .style("fill", function (d) {
                    var boatObj = boats.filter(function (bo) {
                        return bo.id === boat.id;
                    })
                    return boatObj[0].color;
                });
        legendSvg.append("text")
                .text(boat.name)
                .attr("x", 25)
                .attr("y", 17)
                .attr("font-family", "sans-serif")
                .attr("font-size", 13 + "px")
                .attr("fill", "#000000")
    });
}

function orderedTimeFilter(array, currMaxTime, xDomain, yDomain) {
    var visiblePaths = [];
  var results = [];
  var item;
  var step = Math.max(1,Math.ceil((1-10)/(30-0.1)*(_zoom.scale()-0.1)+10))
  var i;
  var prevOut = false;
  var prev;
  for(i = 0, len = array.length; i < len-1; i+=step)
  {
      item = array[i];
      var currVis = isPosVisible(item, xDomain, yDomain);
      if (prevOut && !currVis) {
          if(results.length > 0){
          visiblePaths.push(results);
          results = [];}
          prev=item;
          continue;
      }
      if(prevOut && currVis){
      results.push(prev);}
      if(!currVis){prevOut = true;}
      else {prevOut = false}

      if (item.time < currMaxTime) results.push(item);
      else break;
      prev=item;
  }
  if(results.length > 2)
  {
  //if we have elements, we remove the last two and insert precisely defined gps points
    results.length = results.length-2;
    for(i = i-(2*step), len = array.length; i < len; i++) {
      item = array[i];
      if (item.time < currMaxTime) results.push(item);
      else break;
    }
  }
  else
  {
  //if we do not have at least two elements, we inserts the last elements anyways which should 
  //contain the last known position of the boat
    for(i = i-(2*step), len = array.length; i < len; i++) {
      item = array[i];
      if(item != null){
      if (item.time < currMaxTime) results.push(item);
      else break;}
    }
  }
  if(results.length >0){
  visiblePaths.push(results);}
  return visiblePaths;
}

function isPosVisible(pos, xDomain, yDomain) {
    return xDomain[0] <= pos.lon && xDomain[1] >= pos.lon && yDomain[0] <= pos.lat && yDomain[1] >= pos.lat;
}

function updatePos() {
    //remove all positions
    //_objects.selectAll(".pos").remove();
    //_objects.selectAll(".trace").remove();

    //add positions with time lower than given as parameter
    _rdata[0].sections.forEach(function (section) {
        section.boats.filter(function (boat) {
                if(_selectedBoatIDs.some(function (boatID) { return boat.id === boatID; }))
                {
                     var boatObj = _selectedBoats.filter(function (bo) {
                        return bo.id === boat.id;
                    });
                    var positionsSelected = orderedTimeFilter(boat.positions, _currMaxTime, _x.domain(), _y.domain());//selects the positions where time is below the slider time
                    var numPaths = positionsSelected.length;
                   if (numPaths > 0)
                    {
                        var lastPath = positionsSelected[positionsSelected.length - 1];
                        var points = _objects.selectAll(".posboat" + boat.id)
                                .data([lastPath[lastPath.length - 1]])
                            points.enter()
                                .append("circle")
                                .classed("posboat" + boat.id, true)
                                .attr("transform", transform)
                                .attr("r", 10)
                                .style("opacity", 0)
                                .append("svg:title")
                                .text(boatObj[0].name);
                            points.exit().remove();
                            points.attr("transform", transform);
            
                        var trace = _objects.selectAll(".traceboat" + boat.id)
                                .data(positionsSelected)
                            trace.enter()
                                .append("path")
                                .classed("traceboat" + boat.id, true)
                                .attr("d", line)
                                .attr("fill", "none")
                                .attr("stroke", boatObj[0].color)
                                .attr("stroke-width", 2);
                            trace.exit().remove();
                            trace.attr("d", line);

                        var lastTrace = _objects.selectAll(".traceboat" + boat.id);
                        lastTrace = lastTrace[lastTrace.length-1][0];
                        lastTrace.attr("marker-end", function (d) {
                                  return "url(#boat" + boatObj[0].id + ")";
                              })
                    }
                }
        });
    });
}

var line = d3.svg.line()
        .x(returnTransformedLon)
        .y(returnTransformedLat);
        
function returnTransformedLon(d)
{
    return _x(d.lon);
}
function returnTransformedLat(d)
{
    return _y(d.lat);
}

//We use the same function to transform Marks and Boat positions
function transform(d) {
    return "translate(" + _x(d.lon) + "," + _y(d.lat) + ")";
}

function zoomed() {
    _svg.select(".x.axis").call(_xAxis);
    _svg.select(".y.axis").call(_yAxis);

    _objects.selectAll(".dot")
            .attr("transform", transform);

    _objects.selectAll(".pos")
            .attr("transform", transform);

    //_objects.selectAll("path")
    //        .attr("d", line);
    updatePos();
}

function reset() {
    d3.transition().duration(750).tween("zoom", function () {
        var ix = d3.interpolate(_x.domain(), [-_width / 2, _width / 2]),
                iy = d3.interpolate(_y.domain(), [-height / 2, height / 2]);
        return function (t) {
            zoom.x(_x.domain(ix(t))).y(_y.domain(iy(t)));
            zoomed();
        };
    });
}
