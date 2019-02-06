// (function () {

///////////////////////////
//// SETUP ENVIRONMENT ////
//// (global bindings) ////
///////////////////////////

// MapboxGL

  // mapboxgl.accessToken = "pk.eyJ1Ijoia2FmdW5rIiwiYSI6ImNqYmc3dXJzczMzZWIzNHFmcmZuNjY3azMifQ.9i48EOQl4WCGZQqKRvuc_g";
  //
  // // initialize map centered on conterminous US // NOTE mapboxgl uses long,lat coordinates
  //   var map = new mapboxgl.Map({
  //     container: "map",
  //        style: "mapbox://styles/kafunk/cjpsvhamn7tvt2rploxnt5ak6",
  //     // style: "mapbox://styles/kafunk/cjhzu1ypk2nhj2sn6qkg8e3x2?optimize=true",
  //     // center: [-96.1,39.5],
  //     zoom: 3,
  //     minZoom: 2,
  //     maxZoom: 18,
  //     // maxBounds:([-140,20],[-50,59.5]),
  //     attributionControl: false
  //   });
  //
  // map.scrollZoom.disable()
  // map.addControl(new mapboxgl.NavigationControl())
  //    .addControl(new mapboxgl.AttributionControl({
  //         compact: true}));

// ASSORTED VARIABLE DECLARATION

  var dash0 = "0.8 1.6",
      dash1 = "0.1 0.4",
      dash2 = "0.05 0.1",
     rrDash = "0.1 0.2",
     wDash1 = "32 4",
     wDash2 = "64 4",
     wDash3 = "128 4",
     wDash4 = "256 4",
   origDash = "4 8 16 8",
          t = 12000;  // default

  var padX = 0,
      padY = 0;
      // marginX = 0,
      // marginY = 0;

  var initial = calcSize();

  console.log("initial height",initial.height)
  console.log("initial width",initial.width)

  var extent0 = [[-initial.width/2, -initial.height/2],[initial.width/2, initial.height/2]],
   translate0 = [(initial.width + padX)/2, (initial.height + padY)/2],
       scale0 = 0.9, // initial overview scale
       scale1 = 12;  // standard scale during animation (and maximum routeBounds)

  var tPause = 2400;      // standard pause/transition time

  let experience = { initiated: false, animating: false };

// SET UP SVG

  // d3.select("#map")
  //   .style("padding-bottom", (Math.ceil(initial.height/initial.width * 50) + "%"))

  var svg = d3.select("#map").append("svg")
    .attr("width", initial.width)
    .attr("height", initial.height)
    .attr("preserveAspectRatio", "xMidYMid slice") // xMinYMin, xMinYMid, meet
    .attr("viewBox", `0 0 ${initial.width} ${initial.height}`)
    // .classed("svg-content", true)

  // space to define elements for later <use></use>
  var defs = svg.append("defs");

  // all rendered/zoomable content
  var g = svg.append("g")
    .attr("id", "zoomable")

//// READY MAP

  // PROJECTION & GEOIDENTITY

  // EPSG 102008ish
  var projection = d3.geoConicEqualArea()
    .center([0,40])
    .rotate([96, 0])
    .parallels([20, 60])
  // assuming 256,256 'tile' size // proj:aea, unit:meters, datum:nad83
  // .center([x_0,lat_0])
  // .rotate([-lon_0,y_0])
  // .parallels([lat_1,lat_2])

  // declare geoIdentity function for transforming/aligning preprojected data
  var identity = d3.geoIdentity().reflectY(true)

  // PATH GENERATORS

  // null path generator (rawest)
  var nullPath = d3.geoPath().projection(null);

  // go-to path generator
  // var path = d3.geoPath().projection(projection);
  var projPath = d3.geoPath().projection(projection);

  // pre-projected path generator
  var ppPath = d3.geoPath().projection(identity);

  var line = d3.line().curve(d3.curveCardinal.tension(0));

// SET UP PAN/ZOOM BEHAVIOR

  var zoom0 = d3.zoomIdentity.translate(translate0[0],translate0[1]).scale(scale0)

  var active = d3.select(null);

  var zoom = d3.zoom()
    // .translateExtent(extent0)
    // .scaleExtent([scale0*0.5, scale0*64])
    .on("zoom", zoomed)

  var background = svg.append("rect")
    .attr("id", "background")
    .attr("width", initial.width)
    .attr("height", initial.height)
    .style("fill", "none")
    // .style("pointer-events", "all")
    .on("dblclick", resetZoom());

  svg.call(zoom.transform, zoom0) // keep this line first
     .call(zoom)

// SET UP CUSTOM DISPATCH BEHAVIOR

  let dispatch = d3.dispatch("ready","depart","move","encounter","arrive")
                   .on("depart.train", departed)
                   .on("move.train", trainMoved)
                   .on("encounter.trigger", encountered)
                   .on("arrive.train", arrived)

// DECLARE (BUT DON'T NECESSARILY DEFINE) CERTAIN VARIABLES FOR LATER ACCESS

  let tpm = 80;  // time per mile; hard-coded goal of animated ms per route mile (more == slower); eventually should be user-adjustable

  let timer, quadtree; // observer

  const cityState = d => { return d.city + ", " + d.state; }

// COLORS

  let riverBlues = d3.interpolate({colors: ["rosybrown","mediumaquamarine"]},{colors: ["cadetblue","darkcyan"]}),
       // riverBlue = riverBlues(Math.random());
       riverBlue = "cyan";

  var linearGradientScale = d3.scaleLinear()
    .range(["#2c7bb6", "#00a6ca","#00ccbc","#90eb9d","#ffff8c",
            "#f9d057","#f29e2e","#e76818","#d7191c"]);

  // gradients
  // append gradient elements to svg <defs> and give each a unique id
  var linearGradient = defs.append("linearGradient")
    .attr("id", "linear-gradient")
    .attr("x1", "30%")
    .attr("y1", "30%")
    .attr("x2", "70%")
    .attr("y2", "70%");

  // bind gradient stops to gradient elements
  linearGradient.selectAll("stop")
    .data(linearGradientScale.range())
    .enter().append("stop")
      .attr("offset", function(d,i) { return i/(linearGradientScale.range().length-1); })
      .attr("stop-color", d => { return d });

  // append radial color gradient to <defs> element
	var radialGradient = defs.append("radialGradient")
		.attr("id", "radial-gradient")
		.attr("cx", "50%")
		.attr("cy", "50%")
		.attr("r", "75%")

 	// define color scales
	var numColors = 9,
	radialGradientScale = d3.scaleLinear()
	   .domain([0,(numColors-1)/2,numColors-1])
	   .range(["lightyellow","goldenrod","darkgoldenrod"])

  // bind specific color stops to radialGradient
  radialGradient.selectAll("stop")
    .data(d3.range(numColors))
      .enter().append("stop")
      .attr("offset", function(d,i) { return i/(numColors-1)*50 + 40 + "%"; })
      .attr("stop-color", d => { return radialGradientScale(d) });

//// INITIATE DATA LOAD

  // Typical Mapshaper CLI transform:
    // mapshaper *filein*.geojson name=*objectunits* \
    //     -o quantization=1e5 format=topojson mapshaped/*fileout*.json
    // then simplified and cleaned in browser for visual

  // background/reference
  var initBounds = d3.json("data/final/bounding.json"),
          admin0 = d3.json("data/final/admin0.json"),
          admin1 = d3.json("data/final/admin1.json"),
         // terrain = d3.buffer("data/final/terrain.tif"),
       hydroBase = d3.json("data/final/hydro_base.json"),
       urbanBase = d3.json("data/final/urban_areas.json"), // add major roads?
  // rail
        railBase = d3.json("data/final/railways.json"),
        // passRail = d3.json("data/final/pass_railways.json"),
        // railStns = d3.json("data/final/na_main_rr_stns.json"),
        railStns = d3.json("data/final/na_rr_stns.json"),
       // prBuffers = d3.json("data/final/pass_rail_buffers.json");
  // merged enrich data
     // enrichPolys = d3.json("data/final/enrich_polys.json"),
     enrichPolys = d3.json("data/final/enrich_polys_slimmed.json"),
     enrichLines = d3.json("data/final/enrich_lines.json"),
       enrichPts = d3.json("data/final/enrich_pts.json");

//// PREPARE MAP LAYERS

  // SET BOUNDING BOX
  Promise.all([initBounds]).then(bindTo => {
      let gj, key, data = (Array.isArray(bindTo)) ? bindTo[0] : bindTo;
      if (data["type"] == "Topology") { key = Object.keys(data.objects)[0]; }
      gj = key ? topojson.feature(data, data.objects[key]) : data;
      // identity.fitExtent(extent0,gj)
      projection.fitExtent(extent0,gj)
    }, onError)

  // DRAW VECTOR BASE
  Promise.all([admin0,admin1,hydroBase,urbanBase,railBase,railStns]).then(drawBase, onError);

  function drawBase(data) {

    // CONVERT TJ'S TO GJ'S AS NECESSARY
    let sourceData = new Object();
    data.forEach(datum => {
      if (datum["type"] == "Topology") {
        let oKey = Object.keys(datum.objects)[0],  // object key
           sdKey = oKey;                           // sourceData key (to distinguish multiple TJ's with objects of same name)
        if (sourceData[sdKey]) { sdKey += "2" };
        sourceData[sdKey] = { tj: datum },
        sourceData[sdKey].gj = topojson.feature(sourceData[sdKey].tj, sourceData[sdKey].tj.objects[oKey]);
      } else {  // if not topojson, assume already geojson
        sourceData[datum.name] = { gj: datum };
      }
    });

    // MESH SELECT
    let lakeMesh = getMesh(sourceData.hydroLines,"hydroLines", (a,b) => { return a.properties.strokeweig === null }),
       urbanMesh = getMesh(sourceData.urbanAreas,"urbanAreas"),
   continentMesh = getMesh(sourceData.countries,"countries",outerlines()),
   countriesMesh = getMesh(sourceData.countries,"countries",innerlines()),
      statesMesh = getMesh(sourceData.states,"states",innerlines());

    console.log("* base data *")
    console.log(sourceData)

    // define svg groups
    var baselayers = g.append("g")
      .attr("class", "base basemap baselayers")
    var adminBase = baselayers.append("g")
      .attr("id", "admin-base")
      .style("opacity", 1)
    var hydroBase = baselayers.append("g")
      .attr("id", "hydro-base")
      .style("opacity", 1)
    var urbanBase = baselayers.append("g")
      .attr("id", "urban-base")
      .style("opacity", 1)
    var railBase = baselayers.append("g")
      .attr("id", "rail-base")
      .style("opacity", 1)

    // FILLED MESH
    adminBase.append("path")
      .attr("id", "continent-mesh")
      .attr("d", projPath(continentMesh))
      .style("stroke","darkslategray")
      .style("stroke-width",0.2)
      .style("stroke-opacity",0.8)
      .style("fill","dimgray")

    hydroBase.append("path")
      .attr("id", "lake-mesh")
      .attr("d", projPath(lakeMesh))
      .style("fill","cyan")
      .style("stroke","teal")
      .style("stroke-width",0.1)
      .style("opacity",0.6)
      .style("stroke-opacity",1)

    urbanBase.append("path")
      .attr("id", "urban-areas")
      .attr("d", projPath(urbanMesh))
      .attr("stroke","silver")
      .attr("fill","gainsboro")
      .style("stroke-width",0.1)
      .style("opacity",0.4)

    // STROKED MESH
    adminBase.append("path")
      .attr("id","country-borders")
      .attr("d", projPath(countriesMesh))
      .style("fill","none")
      .style("stroke","yellowgreen")
      .style("stroke-width",0.6)

    adminBase.append("path")
      .attr("id","state-borders")
      .attr("d", projPath(statesMesh))
      .style("fill","none")
      .style("stroke","magenta")
      .style("stroke-width",0.4)
      .style("stroke-dasharray", "0.2 0.4")

    // STROKED FEATURES
    hydroBase.append("g")
      .attr("id", "rivers")
      .selectAll("path")
      .data(sourceData.hydroLines.gj.features.filter(d => { return d.properties.strokeweig !== null }))
      .enter().append("path")
        .attr("d", projPath)
        .style("fill","none")
        .style("stroke","teal")
        .style("stroke-width", d => { return d.properties.strokeweig })

    railBase.append("g")
      .attr("id", "railways")
      .selectAll("path")
      .data(sourceData.railways.gj.features)
      .enter().append("path")
        .attr("d", projPath)
        .attr("stroke-width", d => { return (8/(d.properties.scalerank * 4)) }) // 10/(d.properties.scalerank ** 2)
        .attr("stroke","lightslategray")
        .style("fill", "none")
        .style("opacity",0.95)

    // POINT FEATURES
    railBase.append("g")
      .attr("id", "rail-stations")
      .selectAll("circle")
      .data(sourceData.stations.gj.features)
      .enter().append("circle")
        .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
        .attr("r", 0.4)
        .property("name", d => { return cityState(d.properties); })
        .style("fill", "lightsalmon")
        .style("stroke","indianred")
        .style("stroke-width",0.05)
        .on("mouseover", onMouseover)
        .on("mouseout", onMouseout)

    // // sort stations by city name
    // let sorted = sourceData.stations.gj.features.sort( (a,b) => {
    //   return a.properties.city > b.properties.city;
    // });

    let shuffled = shuffle(sourceData.stations.gj.features);

    // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    function shuffle(array) {
      let currentIndex = array.length, temporaryValue, randomIndex;
      while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
      }
      return array;
    }

    // create new allStations array by extracting sorted, slimmed railStns properties
    var allStations = /*sourceData.stations.gj.features*/shuffled.map( (d,i) => {
      let props = d.properties, // shorthand
        station = {
          id: i.toLocaleString().padStart(3,"0"),
          city: props.city,
          state: props.state ? props.state : props.province,
          country: props.country
        };
      return station;
    });

    populateOptions(allStations);

  }

//// ON INITIAL LOAD
  function initPrompt() {
    d3.select("#modal-plus").classed("none",false);
  }

  function populateOptions(allOptions) {

    // OPTION 0 == START, OPTION 1 == END

    // access specific dropdown elements from markup
    var options0 = d3.select("#option0Suggest"),  // options list
        options1 = d3.select("#option1Suggest"),
        getOption0 = d3.select("#getOption0"),   // form
        getOption1 = d3.select("#getOption1");

    // initially populate any options elements with all possibilities; listen for input on each, then dynamically adjust opposite list to filter out resulting non-options
    options0.selectAll("option")
      .data(allOptions)
      .enter().append("option")
        .text(cityState)
        .attr("value", cityState)
        .attr("id", d => { return d.id })
        .attr("class", d => { return Object.values(d).join(" ") })

    options1.selectAll("option")
      .data(allOptions)
      .enter().append("option")
        .text(cityState)
        .attr("value", cityState)
        .attr("id", d => { return d.id })
        .attr("class", d => { return Object.values(d).join(" ") })

    // listen for user input
    getOption0.on("focus", function() {

      // clear initial value text to make way for user input
      if (this.value === "Enter origin") {
        getOption0.attr("value", "");
      }

      // await blur following focus event
      getOption0.on("blur", onBlur())

    });

    getOption1.on("focus", function() {

      // clear initial value test to make way for user input
      if (this.value === "Enter destination") {
        getOption1.attr("value", "");
      }

      // await blur following focus event
      getOption1.on("blur", onBlur());

    });

    function onBlur() {

      let focused = event.target, // event undefined in Firefox
          blurred,
         received,
        selection;

      if (event.relatedTarget) {
        blurred = event.relatedTarget
        received = receiveOption(blurred.value)
        selection = d3.select(blurred)

        // validate and autocomplete if necessary
        // upon blur, highlight in red if value still empty or otherwise invalid
        if (blurred.value === "") {
          selection.style("border", "1px solid red")
        } else if (allOptions.includes(received)) {
          selection.style("border", "1px solid green")
        } else {
          selection.style("border", "1px solid purple")
        }

        // other index
        let i = focused.id.charAt(focused.id.length-1);

        // if opposite list value remains unfilled, update opposite list to account for inaccessible start/end pts corresponding to initial user input
        if (focused.value === "") {
          updateOptions(`option${i}`,received)
        }
      }
    }

    function receiveOption(entered) {
      // parse entered input
      let givenCity = entered.split(", ")[0],
         givenState = entered.split(", ")[1];
      let received = allOptions.find(function(station) {
        return (station.city == givenCity && station.state == givenState);
      });
      return received;
    }

    // inner function, allOptions variable remains accessible
    function updateOptions(which,givenInput) {

      let listToUpdate = d3.select(`#${which}Suggest`),
            nonOptions = getNonOptions(givenInput);

      // delete all nonOptions from updatedOptions list
      nonOptions.forEach(function(nonOption) {
        listToUpdate.selectAll("option").filter(d => { return d.id === nonOption.id }).remove(); // match instead of filter for fewer iterations?
      });

      // inner function, allOptions var remains accessible
      function getNonOptions(givenInput) {

        var nonOptions = [];

        // filter allOptions object in accordance with obvious limits of railway connectivity
        if (givenInput.state === "AK") {
          // nonOptions = all stations not in state of AK
          nonOptions = allOptions.filter(station => station.state !== "AK");
        } else if (givenInput.country === "MEX") {
          // nonOptions = all stations not in country of MEX
          nonOptions = allOptions.filter(station => station.country !== "MEX");
        } else {
          // nonOptions = all stations in AK or MEX
          nonOptions = allOptions.filter(station => station.country === "MEX" || station.state === "AK");
        }

        // start/end cannot be identical, so givenInput is automatic nonOption
        nonOptions.push(givenInput);

        return nonOptions;

      }

    }

  }

  function onSubmit(opt0,opt1) {

    // opt0 == from, opt1 == to

    // Rome2Rio doesn't recognize CHI as state; remove as relevant
    let testOpt0 = opt0.split(', '),  // note space after comma
        testOpt1 = opt1.split(', ');
    if (testOpt0[testOpt0.length-1] === 'CHI') {
      opt0 = testOpt0.slice(0, testOpt0.length-1).join(" ");        }
    if (testOpt1[testOpt1.length-1] === 'CHI') {
      opt1 = testOpt1.slice(0, testOpt1.length-1).join(" ");
    }

    let selection = queryAPI(opt0,opt1);

    Promise.all([selection]).then(function(returned) {

      // if no rail-only routes found, reprompt user;
      // otherwise, proceed with drawing/zooming to chosen route
      if (returned[0] == null) {
        d3.select("#submit-btn-load").classed("none",true);
        d3.select("#submit-btn-txt").classed("none",false);
        initPrompt()
      } else {
        toggleLoading();
        let processed = processReceived(returned[0]);
        Promise.all([processed]).then(function(newData) {
          if (!experience.initiated) {
            initExp(newData[0])
          }
          // } else {
          //   updateMap(newData[0])
          // }

        }, onError);

      }

    }, onError);

  }

  // provide user feedback that map content is loading
  function toggleLoading() {
    d3.select("#modal-plus").classed("none", true);
    d3.select("#map-init-load").classed("none", false);
  }


//// API / DATA-PROCESSING RELATED
  function queryAPI(opt0,opt1) {

    // save and parse user input
    var a = replaceCommas(opt0),
        b = replaceCommas(opt1);

    // define Rome2Rio API query string
    let apiCall = `https://free.rome2rio.com/api/1.4/json/Search?key=V8yzAiCK&oName=${a}&dName=${b}&oKind=station&dKind=station&noAir&noAirLeg&noBus&noFerry&noCar&noBikeshare&noRideshare&noTowncar&noMinorStart&noMinorEnd&noPrice`

    let received = d3.json(apiCall).then(validate,onError);

    return received;

  }

  function validate(data) {

    // IF NO GOOD DATA RETURNED
    if (data.routes.length === 0) {

      // alert user
      window.alert(`No rail-only route found between ${data.places[0].shortName} and ${data.places[1].shortName}. Please try another combination!`)

      return null;

    }

    // OTHERWISE
    return data;

  }

  function processReceived(data) {
    var parsed = parseReceived(data),
      enriched = enrichRoute(parsed);
    return enriched;
  }

  function parseReceived(raw) {

    let route = raw.routes[0],
       places = raw.places,
     agencies = raw.agencies,
           gj = newFeatureCollection(route.segments),
     mergedGJ = makeFeature(merge(gj.features),"LineString");

    let thisRoute = {
      from: places[0],
      to: places[1],
      totalDistance: route.distance, // in miles,
      totalTime: route.totalTransitDuration, // not including transfers
      lineString: mergedGJ,
      segments: [],
      allStops: [],
      overallBearing: turf.bearing([places[0].lng,places[0].lat],[places[1].lng,places[1].lat]),
      gj: gj,
      getArcPts(steps = 500) {
        let breaks = getBreaks(thisRoute.lineString,thisRoute.totalDistance,steps);
        return [...breaks].map(point => projection(point));
      },
      getMileMarkers() {
        let miles = Math.floor(this.totalDistance);
        return [...getBreaks(this.lineString,this.totalDistance,miles)].map(point => projection(point));
      }
    }

    // is there a better way to do this? trying to allow for access to mileMarkers value as either property or method (recalculated on the fly)
    thisRoute.mileMarkers = thisRoute.getMileMarkers(),
         thisRoute.arcPts = thisRoute.getArcPts()

    if (!route.segments) { // debugging, temporary
      console.log("no route segments?")
      console.log("route",route)
    }
    // ALL STOPS
    route.segments.forEach(segment => {
      let stops = [];
      segment.stops.forEach(stop => {
        stops.push(places[stop.place]);
      });
      thisRoute.allStops = thisRoute.allStops.concat(stops);
    });

    // PER RETURNED R2R (MEANINGFUL) SEGMENT
    for (var i = 0; i < route.segments.length; i++) {
      thisRoute.segments[i] = {
          agency: agencies[route.segments[i].agencies[0].agency],
        lineName: route.segments[i].agencies[0].lineNames[0],
      lineString: polyline.toGeoJSON(route.segments[i].path),
        distance: route.segments[i].distance,
           stops: route.segments[i].stops,
       departing: places[route.segments[i].depPlace],
        arriving: places[route.segments[i].arrPlace]
      }
    }

    // // ALL TICKS
    // for (var i = 0; i < thisRoute.arcPts.length; i++) {
    //   thisRoute.ticks[i] = {
    //     point: thisRoute.arcPts[i],
    //     // coords: projection.invert(thisRoute.arcPts[i]),
    //     getPrevPt() { return thisRoute.arcPts[i-1] || this.point },
    //     // getPrevCoords() { return projection.invert(this.getPrevPt()) },
    //     getNextPt() { return thisRoute.arcPts[i+1] || this.point },
    //     // getNextCoords() { return projection.invert(this.getNextPt()) },
    //     // getBearing() {
    //     //   return turf.bearing(this.getPrevCoords(),this.getNextCoords());
    //     // },
    //     // getOrientation() // cardinal
    //     // getElevation()
    //   }
    // }

    return thisRoute;

  }

  // Relate route waypts/nodes/links to spatially intersecting (given buffer) data for interesting and illuminating route experience
  function enrichRoute(chosen) {

    // keeps radius consistent with filtered pool of enrichData
    let bufferedRoute = turf.buffer(chosen.lineString, 0.5, {units: "degrees", steps: 12}); // ? re: steps (default much more)

    g.append("path")
      .attr("id","route-buffer")
      .attr("d", line(bufferedRoute.geometry.coordinates[0].map(d => projection(d))))
      .attr("fill","none")
      .attr("stroke","none")
      // .attr("fill","slateblue")
      // .attr("stroke","black")

    // filterAndJoin returns enriched route object
    let enriched = Promise.all([enrichPolys,enrichLines,enrichPts]).then(filterAndJoin,onError);

    return enriched;

    function filterAndJoin(data) {

      // *USE A QUADTREE HERE?*

      let allPolys = topojson.feature(data[0], data[0].objects.enrichPolys),
          allLines = topojson.feature(data[1], data[1].objects.enrichLines),
            allPts = topojson.feature(data[2], data[2].objects.enrichPts);

      // POINTS
      let filteredPts = uniqueOn(allPts.features.filter(d => {
        return turf.booleanPointInPolygon(d.geometry,bufferedRoute);
      }));

      // LINES
      let singleLines = allLines.features.filter(d => {
        return d.geometry.type === "LineString" && turf.booleanCrosses(d.geometry,bufferedRoute);
      });

      let multiLines = allLines.features.filter(d => {
        return d.geometry.type === "MultiLineString"
        // 'multilines not supported'
        // && turf.booleanCrosses(d.geometry,bufferedRoute);
      });

      // explode multilinestrings
      let explodedLines = emptyFeatureCollection();

      // enter each multiline feature
      for (var i = 0; i < multiLines.length; i++) {
        // for each coordinate array / line segment within multiline
        for (var j = 0; j < multiLines[i].geometry.coordinates.length; j++) {
          // separate parts into individual features
          let segment = turf.lineString(multiLines[i].geometry.coordinates[j],multiLines[i].properties);

          explodedLines.features.push(segment);
        }
      }

      // then filter exploded multilines
      let moreLines = explodedLines.features.filter(d => {
        return turf.booleanCrosses(d.geometry,bufferedRoute);
      });

      // combine all intersecting initial lines and intersecting multiline segments
      let filteredLines = uniqueOn(singleLines.concat(moreLines));

      // POLYGONS
      // let singlePolys = allPolys.features.filter(d => {
      //   console.log(d)
      //   return d.geometry !== null && d.geometry.type === "Polygon" && turf.booleanOverlap(d.geometry,bufferedRoute);
      // });
      //
      // console.log(singlePolys)

      // let multiPolys = allPolys.features.filter(d => {
      //   return d.geometry !== null && d.geometry.type === "MultiPolygon";
      //   // 'features must be of the same type'
      //   // && turf.booleanOverlap(d.geometry,bufferedRoute);
      // });
      //
      // // explode multiPolys
      // let explodedPolys = newFeatureCollection();
      //
      // // enter each multipoly feature
      // for (var i = 0; i < multiPolys.length; i++) {
      //   // for each coordinate array / polygon within multipoly
      //   for (var j = 0; j < multiPolys[i].geometry.coordinates.length; j++) {
      //   // separate parts into individual feature
      //     let polygon = makeFeature(multiPolys[i].geometry.coordinates[j], "Polygon");
      //     polygon.properties = multiPolys[i].properties; // transfer props, too
      //     explodedPolys.features.push(polygon);
      //   }
      // }
      //
      // // then filter exploded multipolys
      // let morePolys = explodedPolys.features.filter(d => {
      //   return turf.booleanOverlap(d.geometry,bufferedRoute);
      // });
      // console.log(singlePolys[16].geometry)
      // console.log(morePolys[3])
      //
      // // combine all intersecting initial polys and intersecting multipoly parts
      // let filteredPolys = singlePolys.concat(morePolys);

      // // FOR NOW
      // let filteredPolys = singlePolys;
      // console.log("filtered polys:",filteredPolys)

      // NARROW FULL GEOMETRIES DOWN TO SPECIFIC TRIGGER/INTERSECTION PTS FOR SPATIAL SEARCH ALGORITHM
      // let triggerData = getTriggerData(filteredPts,filteredLines,filteredPolys,chosen.lineString,bufferedRoute)
      // points and lines only:
      let triggerData = getTriggerData(filteredPts,filteredLines,chosen.lineString,bufferedRoute)

      // UPDATE ENRICH GJ'S AS NEEDED
      let replaceStack = triggerData.replaceStack,
            replaceIds = new Set();
      for (var i = 0; i < replaceStack.length; i++) {
        let d = replaceStack[i].properties.id, // shorthand
          dashIndex = d.indexOf("-");
        if (dashIndex > 0) { replaceIds.add(d.substring(0,dashIndex)); }
      }
      let updatedLines = filteredLines.map(feature => {
        if ([...replaceIds].includes(feature.properties.id)) {
          let replaceWith = [];
          replaceWith.push(replaceStack.filter(replacement => {
            return replacement.properties.oid === feature.properties.id;
          }));
          return replaceWith.flat();
        } else {
          return feature;
        }
      }).flat();

      // console.log(filteredLines)
      // console.log(replaceStack.map(d => d.properties.id))
      // console.log([...replaceIds].sort())
      // console.log(updatedLines)

      // ADD ALL FILTERED AND UPDATED ENRICH DATA TO DOM
      // include full geometry, relevant properties, and type-spec id for triggerPt crosswalk
      bindFiltered(filteredPts,updatedLines) //,filteredPolys)

      // ADD ENRICH DATA TO CHOSEN ROUTE OBJ & RETURN
      chosen.enrichData = {
        triggerPts: triggerData.triggerPts,
      withinBuffer: bufferedRoute
      }

      return chosen;

    }

    // append overlay data
    function bindFiltered(pts,lines) { // ,polys) {

      // let begin = performance.now();

      var enrichLayer = g.append("g")
        .attr("id","enrich-layer")

      // const enrichPolys = enrichLayer.append("g")
      //   .attr("id", "enrich-polygons")
      //   .selectAll(".enrich-poly")
      //   .data(polys)
      //   .enter().append("path")
      //     .classed("enrich-poly polygon waiting", true)
      //     .attr("d", projPath)
      //     .attr("id", d => { return d.properties.id })
      //     .property("name", d => { return d.properties.NAME })
      //     .property("category", d => { return d.properties.CATEGORY })
      //     .property("level", d => { return d.properties.LEVEL})
      //     .property("more-info", d => { return d.properties.MORE_INFO })
      //     .property("description", d => { return d.properties.DESCRIPTION })
      //     .style("fill", d => { return d3.interpolateSinebow(Math.random()); })
      //     .style("stroke", "none")

      let colorAssignments = { };
      let oceanIds = [...new Set(lines.filter(d => { return d.properties.CATEGORY === "Watershed" && d.properties.LEVEL === "II" }).map(d => { return d.properties.OCEAN_ID }))],
          // baseHues = chroma.cubehelix()
          //                    .start(200)
          //                    .rotations(-0.25)
          //                    // .gamma(0.7)
          //                    .lightness([0.2, 0.5])
          //                  .scale()  // convert to chroma.scale
          //                    // .correctLightness()
          //                    .colors(oceanIds.length);
          baseHues = chroma.scale('Spectral').colors(oceanIds.length);

      // oceanIds.forEach((oceanId,i) => {
      //   colorAssignments[oceanId] = {
      //     "I": baseHues.shift()
      //   }
      // })

      function getColor(level,oceanId) { // ,subId) {
        if (!colorAssignments[oceanId]) {
          colorAssignments[oceanId] = {
            "II": baseHues.shift()
          }
        }
        if (!colorAssignments[oceanId][level]) {
          // deriveColor as brighter level I color assignment
          colorAssignments[oceanId][level] = chroma(colorAssignments[oceanId]["II"]).brighten(unromanize(level))
        }
        return colorAssignments[oceanId][level];
      }

      function unromanize(romanNum) {
        // for now
        let unromanized = {
          "I": 1,
          "II": 2,
          "III": 3,
          "IV": 4
        };
        return unromanized[romanNum];
      }

      function getPath(d) {
        // reverse certain line paths for purposes of later tweenDash directionality
        if (d.properties.CATEGORY === "Watershed") {
          return reverseSVGPath(projPath(d));
        } else {
          return projPath(d);
        }
      }

      const levelStyles = {
        "I": {
          dash: wDash1,
          width: 0.15,
          zIndex: 4
        },
        "II": {
          dash: wDash2,
          width: 0.2,
          zIndex: 3
        },
        "III": {
          dash: wDash3,
          width: 0.25,
          zIndex: 2
        },
        "IV": {
          dash: wDash4,
          width: 0.3,
          zIndex: 1
        }
      }

      const getDashArray = function(d) {
        let dashArray;
        if (d.properties.CATEGORY === "Watershed") {
          dashArray = levelStyles[d.properties.LEVEL].dash
        } else {
          dashArray = "4 4";
        }
        return dashArray;
      }

      const getStrokeWidth = function(d) {
        let width = 0.1,           // default
            props = d.properties;  // shorthand
        if (props.STROKEWIDTH) {
          width = props.STROKEWIDTH;
        } else if (props.LEVEL) {
          width = levelStyles[props.LEVEL].width;
        }
        return width;
      }

      const getZIndex = function(d) {
        let zIndex,
            props = d.properties;  // shorthand
        if (props.LEVEL) {
          zIndex = levelStyles[props.LEVEL].zIndex;
        }
        return zIndex;
      }

      const getStroke = function(d) {
        let props = d.properties; // shorthand
        if (props.CATEGORY === "Watershed") {
          return getColor(props.LEVEL,props.OCEAN_ID);
        } else { // if (props.CATEGORY === "River") {
          return riverBlue;
        }
      }

      const enrichLines = enrichLayer.append("g")
        .attr("id", "enrich-lines")
        .selectAll(".enrich-line")
        .data(lines)
        .enter().append("path")
          .classed("enrich-line line waiting", true)
          .attr("d", getPath)
          .attr("id", d => d.properties.id)
          .property("name", d => d.properties.NAME)
          .property("category", d => d.properties.CATEGORY)
          .property("level", d => d.properties.LEVEL)
          .property("tDistance", d => d.properties.tDistance)
          .style("fill", "none")
          .style("stroke", getStroke)
          .style("stroke-width", getStrokeWidth)
          .style("stroke-dasharray", getDashArray)
          .style("stroke-linecap", "round")
          .style("z-index",getZIndex)
          .style("opacity", 0)

      const enrichPoints = enrichLayer.append("g")
        .attr("id", "enrich-pts")
        .selectAll(".enrich-pt")
        .data(pts)
        .enter().append("circle")
          .classed("enrich-pt point waiting", true)
          .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
          .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
          .attr("id", d => { return d.properties.id })
          .property("name", d => { return d.properties.NAME })
          .property("category", d => { return d.properties.CATEGORY })
          .property("description", d => { return d.properties.DESCRIPTION })
          .property("more-info", d => { return d.properties.MORE_INFO })
          .style("fill", d => { return d3.interpolateSpectral(Math.random()); })
          .style("stroke", "whitesmoke")
          .style("stroke-width", "0.1px")
          .attr("r", 0)
          .style("opacity", 0.6)

      // let done = performance.now();

    }

    function getTriggerData(pts,lines,/*polys,*/route,buffer) {
      // and their associated intersection0,intersection1 pairs;
      // split line geometries into two or more segments as necessary (one trigger pt per segment; occasionally, same trigger pt triggers multiple segments)
      // add relevant propesrties:
        // flag as partial geometry (tell log not to add to counts, etc)
        // flag as multi trigger
        // store distance from i0 to i1
        // reference counterparts/group

      let replaceStack = [];  // should be lines/linegons only
      // keep track of features that come in whole and were segmented, such that associated full GJ's can be replaced with multiple parts before binding to domain
      // keep all ids and geoms consistent between triggerPts and triggered features to ensure easy styling/transitions later on

    //// POLYGONS
      // query for actual polygon intersect pts (should be 2+ (even numbers) or none at all)
        // if 0, return single nearestPointOnLine (i.e. any of buffer intersect pts) as trigger pt
          // calculate t dynamically based on polygon area
        // if somehow only 1: use this pt as i0 and proceed as with 0
        // if 2 or more intersect points:
          // store first encountered as i0, last encountered as i1 (i.e. if route enters/exits polygon 3 different time, save only first enter and last exit)

      // let polyIntersectPts = polys.map((d,i) => {
      //   // get first interesect pt in direction of travel + type-spec id
      //   console.log(d)
      //   let pt = {
      //     id: d.properties.id,
      //     triggers: "polygon",
      //     coordinates: turf.lineIntersect(d.geometry,route) || getAlmostPts()
      //   };
      //   return pt;
      // })

    //// LINES

      // separate out LINEGONS (aka a polygon I want to style as a line, eg watersheds; pronounced liney-gons; not to be confused with polylines):
      let linegons = [],
        regularLines = [];
      for (let i = 0; i < lines.length; i++) {
        let coords = lines[i].geometry.coordinates  // shorthand
        if (coords[0][0] === coords[coords.length-1][0] && coords[0][1] === coords[coords.length-1][1]) {  // if line === closed
          linegons.push(lines[i])
        } else {
          regularLines.push(lines[i])
        }
      }

      // LINEGONS
      let linegonTriggerPts = linegons.map(d => {

        let segmentTriggers = [];

        let i0, i1,
            index0, // of d
            index1; // of shifted d

        let origId = d.properties.id.slice();

        // query for actual route intersect pt(s) (should be 2+ (even numbers) or none at all)
        let routeIntersectPts = turf.lineIntersect(d,route);

        // if 2 or more intersect points:
        if (routeIntersectPts.features.length > 1) {

          // store first encountered as i0, last encountered as i1 (i.e. if route enters/exits linegon 3 different time, save only first enter and last exit)
          i0 = turf.nearestPointOnLine(d,routeIntersectPts.features[0],{units:"miles"}),
          i1 = turf.nearestPointOnLine(d,routeIntersectPts.features[routeIntersectPts.features.length-1],{units:"miles"});

          // console.log("i0,i1 route intersections:",i0,i1)

        } else {

          // if somehow only 1 actual route intersect, use this pt as i0 and proceed as with 0 for finding i1
          if (routeIntersectPts.features.length === 1) {
            i0 =  turf.nearestPointOnLine(d,routeIntersectPts.features[0],{units:"miles"});
          } else {  // buffer intersection only
            // save single nearestPointOnLine (i.e. any of buffer intersect pts) as i0
            i0 = turf.nearestPointOnLine(d,turf.lineIntersect(d,buffer).features[turf.lineIntersect(d,buffer).features.length/2],{units:"miles"});
          }

        }

        index0 = turf.nearestPointOnLine(d,i0,{units:"miles"}).properties.index;

        // shift line geometry to start (and end) at i0
        let shifted = turf.lineString(d.geometry.coordinates.slice(index0).concat(d.geometry.coordinates.slice(0,index0+1)));

        if (!i1) {
          // calculate approx midpt on closed line (i0-i0) and save as i1
          // as mid-coordinates:
          index1 = Math.floor(shifted.geometry.coordinates.length/2),
              i1 = shifted.geometry.coordinates[index1];
        } else {
          index1 = turf.nearestPointOnLine(shifted,i1,{units:"miles"}).properties.index;
          if (index1 === 0) { // shouldn't be happening; FIXME
            // i0.geom.coords are near identicial to i1.geom.coords, so turf.nearestPointOnLine is returning same point for both;

            console.log("index1 === 0")
            console.log("pt i0", i0.geometry.coordinates)
            console.log("pt i1", i1.geometry.coordinates)
            console.log("d at index0",shifted.geometry.coordinates[index0])
            console.log("shifted at index1",shifted.geometry.coordinates[index1])
            console.log("orig geom; why so short? should be linegon?",shifted.geometry.coordinates)
            console.log("orig length",turf.length(shifted,{units:"miles"}))

            console.log("route intersect pts",routeIntersectPts)
            // two route intersect points were basically next to each other; treat as one, throw error to catch @ around line 1102

            // for now
            index1++;
          }
        }

        // create new geoJSON feature for the associated line segment
        let gjA = turf.lineString(shifted.geometry.coordinates.slice(0,index1+1)),
            gjB = turf.lineString(shifted.geometry.coordinates.slice(index1).reverse());

        let onRouteTrigger = turf.nearestPointOnLine(route,i0,{units:"miles"});

        // return one trigger pt representing both i0i1 segments
        segmentTriggers.push(turf.point(onRouteTrigger.geometry.coordinates,{
          oid: origId,
          id: origId + "-1",
          i0: turf.point(d.geometry.coordinates[index0]),
          i1: turf.point(shifted.geometry.coordinates[index1]),
          triggers: "linegon",
          multiTrigger: true
        }));

        // save properties to repspective GJs and push to outer function's replaceStack to ensure alignment between triggering and triggered
        // let segmentsColor = (d.properties.CATEGORY === "River") ? riverBlues(Math.random()) : d3.interpolateSpectral(Math.random()),
        let tDistance = turf.length(turf.lineSlice(turf.nearestPointOnLine(route,i0,{units:"miles"}),turf.nearestPointOnLine(route,i1,{units:"miles"}),route));

        let gjs = [gjA,gjB];  // unclear why but this averts errors
        gjs.forEach((gj,i) => {

          let newId = `${origId}-${(i+1)}`;

          gj.properties = Object.assign({},d.properties),
          gj.properties.oid = origId,
          gj.properties.id = newId,
          gj.properties.tDistance = tDistance;
          // gj.properties.stroke = segmentsColor;

          if (i > 0) gj.properties.segmentFlag = true;

          replaceStack.push(gj);

        })

        return segmentTriggers;

      });

      // REMAINING (REGULAR) LINES
      let lineTriggerPts = regularLines.map(d => {

        let intersectPts,
          segmentTriggers = [];

        let origId = d.properties.id.slice();

        // query for actual route intersect pt(s)
        let routeIntersectPts = turf.lineIntersect(d,route);

        if (routeIntersectPts.features.length > 0) {
          intersectPts = routeIntersectPts.features;
        } else {

          // if no actual route intersect pts, use every other buffer intersect pt (only enters, not exits!) starting @ index 0
            // confirm this works in both directions (how are turf results ordered? how to ensure sort by order encountered?
            // backup plan: allow middle-ish of buffer intersections to trigger animation
              // let index = Math.floor(bufferIntersectPts.length/2), i0 = bufferIntersectPts[index];

          let bufferIntersectPts = turf.lineIntersect(d,buffer);

          intersectPts = bufferIntersectPts.features.filter((d,i) => { return i % 2 === 0; });

        }

        // invariably add one segmentTrigger representing first intersectPt to line begin
        let i0First = intersectPts[0],
          index0First = turf.nearestPointOnLine(d,i0First,{units:"miles"}).properties.index,
          onRouteTriggerFirst = turf.nearestPointOnLine(route,i0First,{units:"miles"});
        segmentTriggers.push(turf.point(onRouteTriggerFirst.geometry.coordinates,{
          i0: turf.point(d.geometry.coordinates[index0First]),
          i1: turf.point(d.geometry.coordinates[d.geometry.coordinates.length-1]),
          // i1: turf.point(d.geometry.coordinates[0]), // i1 of first segmentTrigger: first coord or last? FIXME?
          vectorFlag: true
        }));

        // iterate through remaining intersect points, creating i0,i1 pairs for every segment; that is, while intersect pts remaining, last ending becomes new beginning in next i0,i1 pair
        let prevEnd, prevIndex1;
        while (intersectPts.length > 1) {
          let i0 = prevEnd || intersectPts.shift(),
            i1 = intersectPts.shift(),
            index0 = prevIndex1 || turf.nearestPointOnLine(d,i0,{units:"miles"}).properties.index,
            index1 = turf.nearestPointOnLine(d,i1,{units:"miles"}).properties.index,
            onRouteTrigger = turf.nearestPointOnLine(route,i0,{units:"miles"});
          segmentTriggers.push(turf.point(onRouteTrigger.geometry.coordinates,{
            i0: turf.point(d.geometry.coordinates[index0]),
            i1: turf.point(d.geometry.coordinates[index1])
          }));
          prevEnd = i1, prevIndex1 = index1;
        }

        // create final segmentTrigger representing prevEnd or original i0 -> line.coords[coords.length-1]
        let i0Last = prevEnd || intersectPts.shift(),
          index0Last = turf.nearestPointOnLine(d,i0Last,{units:"miles"}).properties.index,
          onRouteTriggerLast = turf.nearestPointOnLine(route,i0Last,{units:"miles"});
        segmentTriggers.push(turf.point(onRouteTriggerLast.geometry.coordinates,{
          i0: turf.point(d.geometry.coordinates[index0Last]),
          i1: turf.point(d.geometry.coordinates[0]),
          // i1: turf.point(d.geometry.coordinates[d.geometry.coordinates.length-1]), // i1 of last segmentTrigger: first coord or last? FIXME?
          vectorFlag: true
        }));

        // save properties to repspective GJs and push to outer function's replaceStack to ensure alignment between triggering and triggered
        // let segmentsColor = (d.properties.CATEGORY === "River") ? riverBlues(Math.random()) : d3.interpolateSpectral(Math.random()),
        let segmentDistance;

        if (segmentTriggers.length > 2) segmentDistance = getSegmentDistance();

        segmentTriggers.forEach((trigger,i) => {

          let newId = `${origId}-${(i+1)}`;

          // create new geoJSON feature for the associated line segment and push into outer function's 'replaceStack' array. transfer properties and update id to align with triggerPt id (while saving former id as origId).
          let gj = turf.lineSlice(trigger.properties.i0,trigger.properties.i1,d.geometry);

          gj.properties = Object.assign({},d.properties),
          gj.properties.oid = origId,
          gj.properties.id = newId,
          gj.properties.tDistance = getTDistance();
          // gj.properties.stroke = segmentsColor;

          if (i > 0) gj.properties.segmentFlag = true;

          // this shouldn't be happening.. temporary fix
          if (gj.properties.tDistance === 0) {
            // console.log("GJ.PROPS.TDISTANCE === 0")
            // console.log("segmentDistance",segmentDistance)
            // console.log("gj length",turf.length(gj,{units:"miles"}))
            // console.log("enrich line length / segmentTriggers num",turf.length(d,{units:"miles"})/segmentTriggers.length)
            gj.properties.tDistance = Math.pow(turf.length(d,{units:"miles"})/segmentTriggers.length,2) * tpm/10 // very approximate replacement
            // console.log("squared * tpm/10",gj.properties.tDistance)
          }

          replaceStack.push(gj);

          function getTDistance() {
            if (segmentDistance) {
              // where multiple route intersect points, return tDistance based on length of route itself from i0 to i1 (such that t can be calculated using tpm global)
              return segmentDistance; // i.e., along route
            } else {
              // otherwise, return tDistance based on enrichLine distance (should only be used for i0First => lineStart and i0Last => lineEnd)
              return turf.length(gj,{units:"miles"})
            }
          }

          trigger.properties.id = newId;
          trigger.properties.oid = origId;
          trigger.properties.triggers = "line";

        })

        if (i0First === i0Last) {
          segmentTriggers.forEach(trigger => {
            trigger.properties.multiTrigger = true;
          })
          segmentTriggers = [segmentTriggers[0]]; // after both gjs made, pass one i0 only as multitriggering pt
        }

        return segmentTriggers;

        function getRefreshed(i0,i1) {}

        function getSegmentDistance() {
          let gj = turf.lineSlice(turf.nearestPointOnLine(route,i0First,{units:"miles"}),turf.nearestPointOnLine(route,i0Last,{units:"miles"}),route),
            totalDistance = turf.length(gj,{units:"miles"}),
            segmentNum = segmentTriggers.length - 2;
          return totalDistance/segmentNum;
        }

      });

    //// POINTS
      let ptTriggerPts = pts.map(d => {
        let nearest = turf.nearestPointOnLine(route,d,{units:"miles"});
        d.properties.tDistance = Math.floor(nearest.properties.dist);
        nearest.properties = {...nearest.properties, ...d.properties};
        return nearest;
      })

      // CONCATENATE AND RETURN ALL
      // let allTriggerPts = polyTriggerPts.concat(linegonTriggerPts.flat()).concat(lineTriggerPts.flat()).concat(ptTriggerPts.flat());

      let allTriggerPts = linegonTriggerPts.flat().concat(lineTriggerPts.flat().concat(ptTriggerPts.flat()));

      return {
        triggerPts: allTriggerPts,
        replaceStack: replaceStack
      };

    }

  }

//// INITIATE EXPERIENCE
  function initExp(chosen) {

    experience.initiated = true;

    // zoom to bounds of chosen route
    let routeBounds = getIdentity(getTransform(projPath.bounds(chosen.lineString)));

    // if routeBounds overly zoomed in
    if (routeBounds.k > scale1) {
      let simpRoute = getSimpRoute(chosen.lineString),
         simpLength = Math.floor(turf.length(simpRoute, {units: "miles"})),
              midPt = turf.along(simpRoute,simpLength/2,{ units: "miles" }).geometry.coordinates.map(d => +d.toFixed(2));
      routeBounds = getIdentity(centerTransform(projection(midPt),scale1));
    }

    // control timing with transition start/end events
    svg.transition().duration(tPause*2).ease(d3.easeCubicIn)
      .call(zoom.transform, routeBounds)
      .on("start", () => {
        drawRoute(chosen, tPause);
        prepareEnvironment();
      })
      .on("end", () => {
        // confirm g transform where it should be
        g.attr("transform", routeBounds.toString())
        // pause to prepareUser, then initiate animation (incl zoom to firstFrame)
        prepareUser();
        d3.timeout(() => {
          initAnimation(chosen,routeBounds);
        }, tPause);
      })

    function prepareEnvironment() {
      // setup dashboard including legend
        // store initial orienting data:
          // total length (leg length sum?)
          // full travel time(basetime?)
          // remainTime, remainDistance
      // setup Tooltips
      // setup / initiate select event listeners
        // use remoteControl.js for button functionality
      // activate newly relevant buttons
    }

    function prepareUser() {
      // provide feedback via overview of selected route
      // introduce dashboard and journey log
      // prompt for readiness or provide countdown?

      // e.g. 'You have chosen to travel from {ptA} to {ptB} on {railCompany}'s {lineName} line. IRL, this route would take you about {travelTime} to complete, but we are going to move a little more quickly. Keep your eye on the dashboard and journey log for more details as the journey unfolds in {countdown?... until data loads?}'
    }
  }

  function drawRoute(received,sT) {

    d3.select("#veil").transition()
      .duration(sT)
      .style("opacity", 0)
      .on("end", noneClass)

    d3.select("#map-init-load").transition()
      .delay(sT/2)
      .duration(sT/2 - 200)
      .style("opacity", 0)
      .on("end", noneClass)

    d3.select("#dash").classed("disappear-down", false)
    d3.select("#dash-collapse").classed("none",false)
          // ??
          // d3.select("#about-up-btn").classed("h24",false)
          // d3.select("#about-up").classed("mt-neg6",false)

d3.select("#map").classed("mb0-mxl", false) // mb-neg6?
                 .classed("mb-neg6-mxl", true) // mb-neg30?

    // draw faint stroke along returned route
    var journey = g.append("g")
      // .classed("experience current", true)
      .attr("id", "journey")

    var places = journey.append("g")
      .classed("places points encountered", true)
      .attr("id", "places")

    var route = journey.append("g")
      // .classed("route line rail railway", true)
      .attr("id", "route")

    // fade background railways
    g.select("#railways").transition().delay(sT/2).duration(sT/2)
      .attr("opacity",0.2)

    // keep relevant station points
    // segment start/ends only; could easily be changed to include more
    let stnsEnRoute = new Set();
    received.segments.forEach(segment => {
      stnsEnRoute.add(segment.departing);
      stnsEnRoute.add(segment.arriving);
    });
    let relevantStns = places.selectAll("circle")
      .data([...stnsEnRoute])
      .enter().append("circle")
        .attr("cx", d => { return projection([d.lng,d.lat])[0]; })
        .attr("cy", d => { return projection([d.lng,d.lat])[1]; })
        .attr("r", 0)
        .style("fill","salmon")
        .style("stroke","darksalmon")
        .style("stroke-width",0.1)

    // remove non-chosen station points
    let allStns = g.select("#rail-stations").selectAll("circle");
    allStns.transition().duration(sT)
        .attr("r", 0)
        .on("start", () => {
          relevantStns.transition().duration(sT)
            .attr("r", 0.7)
        })
        .on("end", () => {
          allStns.data([]);
          relevantStns.merge(allStns);
          allStns.exit().remove();
        })

    let arcPts = received.arcPts;

    // LINE/ROUTE
    // faint underlying solid
    route.append("path")
      .datum(arcPts)
      .attr("d", line)
      .style("fill","none")
      .style("stroke","honeydew")
      .style("opacity",0.6)
      .style("stroke-width",0.4)

    // setup path for dashed stroked interpolation
    var fullRoute = route.append("path")
      .attr("id", "full-route")
      .datum(arcPts)
      .attr("d", line)
      .style("fill", "none")
      .style("stroke", "darksalmon") // fiddle/improve
      .style("stroke-width", 0.3)
      .style("opacity",0)
      .style("stroke-dasharray", dash0)
      .style("stroke-linecap", "round")

    // semiSimp path for headlights/eventual compass to follow
    let fullGj = turf.lineString(arcPts),
      semiSimp = getSimpRoute(fullGj,0.5),
    simpCoords = semiSimp.geometry.coordinates; // shorthand

    // bind (and optionally render) semiSimp line (currently using for later DOM access to path nodes within bearWithMe())
    journey.append("path")
      .attr("id", "semi-simp")
      .attr("d", line(simpCoords))
      .style("fill","none")
      // .style("stroke","slateblue")
      // .style("stroke-width","1px")

    // make headlights!
    let azimuth0 = getAzimuth(semiSimp.geometry.coordinates[0],semiSimp.geometry.coordinates[1]),
        radians0 = 0,            // start with unrotated arc
             tau = 2 * Math.PI,  // 100% of a circle
         arcSpan = 0.16 * tau,   // hardcode as desired (in radians)
          radius = 6,            // will otherwise default to 10 if not hardcoded here
         sector0 = getSector(radians0,arcSpan,6);

    // add headlights as DOM node (opacity transitions in from 0)
    var headlights = g.select("#route").append("path")
      .attr("id", "headlights")
      .attr("d", sector0)
      .attr("transform", "translate(" + arcPts[0] + ") rotate(" + azimuth0 +")")
      .style("fill","lightyellow") // linearGradient fading outward?
      .style("opacity", 0)
      .property("azimuth0", azimuth0)

    // BIG GUY: TRAIN POINT IN MOTION
    var point = journey.append("circle")
      .attr("id","train-point")
      .attr("r", 1.6)
      .style("fill","url(#radial-gradient)")
    	.style("stroke-width", 0.4)
      .style("stroke","brown")
      .style("stroke-opacity",0.6)
      .style("stroke-dasharray",dash2)
      .attr("transform", "translate(" + arcPts[0] + ")")

    // UNDERLYING TICKS/TIES
    let rrTies = route.append("g")
      .attr("id","rr-ties")
      .append("path")
      .attr("d", line(arcPts))
      .style("fill", "none")
      .style("stroke","gainsboro")
      .style("stroke-width",0.6)
      .style("stroke-dasharray", rrDash)

    // // SIMP TICKS
    // let simpTicks = route.append("g")
    //   .attr("id","simp-ticks")
    //   .append("path")
    //   .attr("d", line(simpCoords))
    //   .style("fill", "none")
    //   .style("stroke", "cyan")
    //   .style("stroke-width",1.6)
    //   .style("stroke-dasharray", dash1)

  }

  function initAnimation(routeObj,routeBounds) {

    // get zoomFollow object including simplified zoomArc, pace, and first/last zoom frames
    let zoomFollow = getZoomFollow();  // pass routeObj, optional focus int (default = 100)

    // bind zoomArc to DOM for tracking only (not visible)
    let zoomArc = g.append("path")
      .attr("id", "zoom-arc")
      .datum(zoomFollow.arc.map(d => projection(d)))
      .attr("d", line)
      .style("fill","none")
      .style("stroke","none")
      // uncomment below for visual of zoomArc
        // .style("stroke", "rebeccapurple")
        // .style("stroke-width",1)

    // final user prompt/countdown??
    // if (confirm("Ready?")) {
      experience.animating = true;  // global flag that experience in process
      goTrain(zoomFollow,zoomArc,routeObj.enrichData,routeBounds); // initiate movement!
    // }

    function getZoomFollow(int = 100) { // also requires access to routeObj
                                        // int = miles in/out to focus view, start/stop zoomFollow

      let zoomFollow = {
        necessary: true, // default
        arc: [],
        firstThree: [],
        lastThree: [],
        pace: {
          tpsm() {  // based on tpm, calculated per simplified miles
            let result = tpm * Math.floor(routeObj.totalDistance) / this.simpLength;
            this.tpsm = result;
            return result;
          }
        },
        simpSlice: [],
        fullSimp: getSimpRoute(routeObj.lineString),
        simpLength() {
          let result = Math.floor(turf.length(this.fullSimp, {units: "miles"}));
          this.simpLength = result;
          return result;
        }
      }

      if (zoomFollow.simpLength() > 300) {

        let firstLast = getFirstLast(zoomFollow.fullSimp,int);

        zoomFollow.firstThree = firstLast[0],
         zoomFollow.lastThree = firstLast[1],
         zoomFollow.simpSlice = turf.lineSlice(zoomFollow.firstThree[1],zoomFollow.lastThree[1],zoomFollow.fullSimp).geometry.coordinates;

        // update firstLast with exact 100in/100out focus coordinates (prevents stutter at moment of zoomAlong "takeoff")
        zoomFollow.firstThree[1] = zoomFollow.simpSlice[0],
         zoomFollow.lastThree[1] = zoomFollow.simpSlice[zoomFollow.simpSlice.length-1];

        zoomFollow.arc = zoomFollow.simpSlice;

      } else {

        // console.log("short route (< 300 miles -- specifically, " + zoomFollow.simpLength + ". first/last frames identical; no zoomAlong necessary.")

        zoomFollow.necessary = false,
              zoomFollow.arc = zoomFollow.fullSimp.geometry.coordinates.slice();

        // save start, mid, and end points as onlyThree
        let onlyThree = [zoomFollow.fullSimp.geometry.coordinates[0],turf.along(zoomFollow.fullSimp,zoomFollow.simpLength/2,{ units: "miles" }).geometry.coordinates.map(d => +d.toFixed(2)),zoomFollow.fullSimp.geometry.coordinates[zoomFollow.fullSimp.geometry.coordinates.length - 1]];

        zoomFollow.firstThree = onlyThree,
         zoomFollow.lastThree = onlyThree;

      }

      // console.log(zoomFollow)

      return zoomFollow;

      function getFirstLast(fullLine,int) {

        // turf.js returning same three coordinates at distance minus 200, distance minus 100, & distance; reversing instead
        let fullLineReversed = makeFeature(fullLine.geometry.coordinates.slice().reverse(), "LineString");

        let firstThree = threePts(fullLine,int),
             lastThree = threePts(fullLineReversed,int).reverse();

        return [firstThree,lastThree];

        // returns three points along route; origin | trailing corner, zoom focus, leading corner | destination
        function threePts(fullLine,int,i = 0) {

          let miles = { units: 'miles' }; // turf unit options
          let pt0 = turf.along(fullLine,int*i,miles).geometry.coordinates,
              pt1 = turf.along(fullLine,int*i+int,miles).geometry.coordinates,
              pt2 = turf.along(fullLine,int*i+2*int,miles).geometry.coordinates;

          // toFixed() rounds... truncate instead?
          return [pt0.map(d => +d.toFixed(5)),pt1.map(d => +d.toFixed(5)),pt2.map(d => +d.toFixed(5))];

        }

      }

    }

  }


////////////////////////////////////////////////
///// EVENT LISTENERS & VISUAL AFFORDANCES /////
////////////////////////////////////////////////

// CLICK EVENTS
  // Default Prevention
  d3.select("#submit-btn").on("click", function() {
    d3.event.preventDefault();
    d3.select("#submit-btn-txt").classed("none",true);
    d3.select("#submit-btn-load").classed("none",false);
  })

  // Custom Buttons
  // d3.select("#play-pause").on("click", remoteControl.playPause(e))

  // General Visibility Mgmt
  // d3.selectAll(".expand-trigger").on("click", e=> {
  //   expand(e.target.for); // controls?
  //   noneClass(e.target);       // hide the icon that prompted expansion, once expansion is attained
  // });
  // d3.selectAll(".hide-trigger").on("click", e => {
  //   noneClass(e.target.for); // controls? (for as attribute containing id of element to hide)
  //   // with the exception of the modal hide-trigger (and all submit buttons)
  //   if (e.target.type != "submit") {
  //     // expand something else? (expand-trigger icon?)
  //   }
  // });

// LOAD EVENTS
  d3.select(window).on("load", function () {
    // if (!('optionsReceived' in localStorage)) {
      initPrompt();
    // }
  });
  // d3.select(window).on("reload", *)

// RESIZE EVENTS
  d3.select(window).on("resize.map", resize)
  d3.select("#about-expand").on("click", resize)
  d3.select("#about-collapse").on("click", resize)
  // svg.on("move", rerender);
  // svg.on("viewreset", rerender);

// FORMS & FIELDS
  d3.select("#getInitOptions").on("focus", function (e) { e.target.style.background = "palegoldenrod" })
                                .on("blur", function (e) { e.target.style.background = "#fafafa" })


//////////////////////////
///// MORE FUNCTIONS /////
//////////////////////////

//// LAYOUT

  function resize() {

    // get updated dimensions
    let updated = calcSize();

    // apply as new svg attributes
    svg.attr("width", updated.width)
       .attr("height", updated.height)

    // console.log("resized height", updated.height)
    // console.log("resized width", updated.width)

  }

  function rerender(content = "map") {
    // for now..
    resize()
  }

  function calcSize() {

    let calculated = {};

    // if screen mxl, account for #aside on right vs bottom
    if (window.innerWidth >= 1200) {

      if (!d3.select("#aside").classed("mxl")) {

        // if #aside wasn't previously flagged (either entering @mxl screen or first resize on initial load @ mxl), flag as such now
        d3.select("#aside").classed("mxl", true)

        // if #about was hidden on smaller window size
        if (d3.select("#about").classed("disappear-down")) {
          // *keep* collapsed, but change disappear-direction
          d3.select("#about").classed("disappear-right",true)
                             .classed("disappear-down",false)
          // if about closed on small then moved to mxl, remove relative from section
          d3.select("#section-wrapper").classed("relative",false)
          // OR re-expand element from right (unless modal open)
          // if (d3.select("#modal-plus").classed("none")) {
          //  expand("about","left");
          // }
        }

        // ensure dash tags in alignment if #dash closed
        if (d3.select("#dash").classed("disappear-down")) {
          d3.select("#dash-up").classed("mt-neg6", true);
          d3.select("#dash-up").classed("mt-neg18", false);
          d3.select("#dash-expand-btn").classed("h24", true)
          d3.select("#dash-expand-btn").classed("h18", false)
        }
      }

      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#footer").node().clientHeight,  //  - marginY*2,

      calculated.width = window.innerWidth - d3.select("#aside").node().clientWidth;  // - marginX*2;

      // update #about-wrapper to align with full map height
      d3.select("#about-wrapper").style("height", calculated.height + "px");

    } else {

      // if screen sizing downward from 1200+
      if (d3.select("#aside").classed("mxl")) {
        // remove mxl flag, then reset a variety of styles
        (d3.select("#aside").classed("mxl", false))
        // reset #about-wrapper height
        d3.select("#about-wrapper").style("height", null);
        // if #about was manually collapsed on screen mxl
        if (d3.select("#about").classed("disappear-right")) {
          // // *keep* #about collapsed, but change class to disappear-down so transitions/placement correct if #about re-expanded from smaller window position
          // d3.select("#about").classed("disappear-down",true).classed("disappear-right",false)
          // replace previously-removed "relative" class in #section-wrapper
          d3.select("#section-wrapper").classed("relative", true);
          // attribution mr24 is false
          d3.select("#attribution").classed("mr24", false)
          // if dash was ALSO closed
          if (d3.select("#dash").classed("disappear-down")) {
            d3.select("#dash-expand-btn").classed("h24", true);
            d3.select("#dash-expand-btn").classed("h18", false);
            d3.select("#dash-up").classed("mt-neg6", true);
            d3.select("#dash-up").classed("mt-neg18", false);
          }
        }
        // below not happening right now because about always closed automatically on move from large to smaller screen
        // else if (d3.select("#dash").classed("disappear-down")) {
        //   // about open, dash closed
        //   d3.select("#dash-expand-btn").classed("h24", false);
        //   d3.select("#dash-expand-btn").classed("h18", true);
        //   d3.select("#dash-up").classed("mt-neg6", false);
        //   d3.select("#dash-up").classed("mt-neg18", true);
        // }
        // collapse #about (regardless of whether collapsed on mxl; too jarring to have it open upon return to smaller screen)
        d3.select("#about").classed("disappear-right", false)
        collapse("about","down")
      }

      // if window too short to show #about content, collapse automatically
      if (window.innerHeight < 500) collapse("about","down");

      // map height calculation includes #aside
      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#aside").node().clientHeight - d3.select("#footer").node().clientHeight // - marginY*2;

      calculated.width = d3.select("#about-plus").node().clientWidth

    }

    return calculated;

  }

//// PROJECTIONS & PATHS

  // function getScaleAtZoomLevel(zoomLevel, tileSize = 256) {
  //   return tileSize * 0.5 / Math.PI * Math.pow(2, zoomLevel);
  // }

//// GEOJSON + TOPOJSON HELPERS

  function innerlines() {
    return function(a,b) { return a !== b; }
  }

  function outerlines() {
    return function(a,b) { return a === b; }
  }

  function getMesh(source,key,meshFx) {
    if (meshFx) {
      return topojson.mesh(source.tj, source.tj.objects[key], meshFx);
    } else if (key) {
      return topojson.mesh(source.tj, source.tj.objects[key]);
    } else {
      return topojson.mesh(source.tj);
    }
  }

  // COMBAK don't rely on polyline.js
  function newFeatureCollection(data) {
    let gj = {
      "type": "FeatureCollection",
      "features": data ? populateFeatures(data) : []  // ONLY IN THIS CONTEXT / CALLS ON POLYLINE.JS (FIXME)
    }
    return gj;
  }

  function emptyFeatureCollection() {
    return {
      "type": "FeatureCollection",
      "features": []
    }
  }

  // newData and existingFeatures (if applicable) should be typeOf Array
  function populateFeatures(segments,existingFeatures = null) {
    let features = existingFeatures || [];
    segments.forEach(function(segment) {
      features.push({
        "type": "Feature",
        // use mapbox polyline.js function to decode received path string as geoJSON
        "geometry": polyline.toGeoJSON(segment.path),
        "properties": { }
      });
    });
    return features;
  }

  function makeFeature(coords, type = "Point") {
    return {
      "type": "Feature",
      "geometry": {
        "type": type,
        "coordinates": coords
      }
    }
  }

  function merge(iterable,spec = ["geometry","coordinates"]) {
    let merged = [];
    for (var i = 0; i < iterable.length; i++) {
      let latest = iterable[i],
         specDup = spec.slice();    // preserve original spec for remaining iterations
      while (specDup.length > 0) {
        var key = specDup.shift();
        latest = latest[key.toLocaleString()];
      }
      merged = merged.concat(latest);
    }
    return merged;
  }

//// TURF/GEO ON-THE-FLY

  function getBreaks(lineString,distance,steps) {
    let breaks = new Set();
    if (lineString.geometry.coordinates.length > 0) {
      for (var i = 0; i < distance; i += distance / steps) {
        breaks.add(turf.along(lineString, i, { units: "miles" }).geometry.coordinates);
      }
    }
    return breaks;
  }

  function getAzimuth(p0,p1,isInitial = false) {  // returns getRotate(p0,p1)
    let rotate = getRotate(p0,p1,isInitial);
    return rotate;
  }

  function getRotate(p0,p1,isInitial = false) {
    let slope, y0, y1;
    // adjust slope calculation to account for reflectedY!
    if (p0.x) {   // assume two svg pts
      slope = (-p1.y-(-p0.y))/(p1.x-p0.x);
      y0 = p0.y,
      y1 = p1.y;
    } else {      // assume two coordinate pairs
      slope = (-p1[1]-(-p0[1]))/(p1[0]-p0[0]),
      y0 = p0[1],
      y1 = p1[1];
    }

    let quadrant, range;
    // again, y1:y0 relationships account for reflected Y values
    if (Math.sign(slope) === -1) {  // slope negative
      if (y1 < y0) {                // heading north
        quadrant = "NW",
        range = [270,360];
      } else {                      // heading south
        quadrant = "SE",
        range = [90,180];
      }
    } else {                        // slope positive
      if (y1 < y0) {                // heading north
        quadrant = "NE",
        range = [0,90];
      } else {                      // heading south
        quadrant = "SW",
        range = [180,270];
      }
    }

    let angle = Math.atan(slope),            // inverse-tanget = angle in radians
      degrees = turf.radiansToDegrees(angle) // translate to degrees for SVG rotate

    let rotate;
    if (["NE","SE"].includes(quadrant)) {
      rotate = 90 - degrees;
    } else {
      rotate = -90 - degrees;
    }

    // console.log("quadrant",quadrant)
    // console.log("rotate",rotate)

    // // below necessary? what does svg do with neg degrees or degrees above 360?
    // // what will happen in transition if a jump from 359 to 2? or, more likely, -178 to 179? (any way to insist on direction of movement to avoid jolting circles all the way around?)

    // if (Math.sign(rotate) === -1) {  // too low
    //   rotate += 360; // 180?
    //   // rotate += 180;
    //   console.log("negative rotate! recalculated:", rotate)
    // }
    // if (rotate > 360) { // too high
    //   rotate -= 360;
    //   console.log("rotate over 360! recalculated:", rotate)
    // }

    return rotate;

  }

  function getSector(radians,arcSpan,r1 = 10, r0 = 0) {
    return d3.arc()
      .innerRadius(r0)
      .outerRadius(r1)
      .cornerRadius(r1/10)
      .startAngle(radians - arcSpan/2)
      .endAngle(radians + arcSpan/2);
  }

  function getSimpRoute(full,tolerance = 1) {
    let options = {tolerance: tolerance, highQuality: false, mutate: false};
    return turf.simplify(full, options);
  }

//// ZOOM BEHAVIOR

  function zoomed() {

    var transform = d3.zoomTransform(this) // .scale(0.8);

    let k = transform.k,
       tx = transform.x,
       ty = transform.y;

    // let abs = v => { return Math.abs(v) },
    //   clipExtent = [[-abs(tx), -abs(ty)], [abs(tx), abs(ty)]];

    // let clipExtent = [[-(tx ** 2), -(ty ** 2)], [tx ** 2, ty ** 2]]; // extended for leeway around edges
    //
    // identity.clipExtent(clipExtent)
    // projection.clipExtent(clipExtent)

    g.style("stroke-width", 1 / (k*k) + "px");

    g.attr("transform", "translate(" + tx + "," + ty + ") scale(" + k + ")");

  }

  function zoomTo(d,i) {

    if (active.node() === this) return resetZoom();

    if (d3.event.defaultPrevented) return; // panning, not zooming

    active.classed("active", false);

    active = d3.select(this).classed("active", true);

    let transform = getTransform(path.bounds(d));

    let zoom1 = d3.zoomIdentity
      .translate(transform.x,transform.y)
      .scale(transform.k)

    svg.transition().duration(750)
      .call(zoom.transform, zoom1)

  }

  function getTransform(bounds, extent = extent0, padding = 0.1) {

    // COMBAK rework double default parameters;

    let b0,b1;

    // accept bbox, projPath.bounds(), or SVG bbox
    if (bounds.length === 4) {
      b0 = [bounds[0],bounds[1]],
      b1 = [bounds[2],bounds[3]]
    } else {
      b0 = bounds[0] || [bounds.x,bounds.y],
      b1 = bounds[1] || [bounds.width,bounds.height]
    }

    let dx = b1[0] - b0[0],                // domain x (input)
        dy = b1[1] - b0[1],                // domain y (input)
     width = extent[1][0] - extent[0][0],  // range x (output)
    height = extent[1][1] - extent[0][1];  // range y (output)

    let k = (1 - padding) / Math.max(dx / width, dy / height),
                           // aka the m in y = mx + b
                           // Math.max() determines which dimension will serve as best anchor to provide closest view of this data while maintaining aspect ratio
                           // 0.9 provides 10% built-in padding
        x = b1[0] + b0[0], // xMax (b1[0]) + xOffset (b0[0])
        y = b1[1] + b0[1];  // yMax (b1[1]) + yOffset (b0[1])

    // calculate translate necessary to center data within extent
    let tx = (width - k * x) / 2,
        ty = (height - k * y) / 2;

    let transform = { k: k, x: tx, y: ty };

    return transform;

  }

  function getIdentity(atTransform,k) {
    let identity = d3.zoomIdentity
      .translate(atTransform.x,atTransform.y)
      .scale(k || atTransform.k)  // if (k), k || (keep k constant?)
    return identity;
  }

  function centerTransform(pt,scale) {
    let tx = -scale * pt[0] + initial.width/2,  // adjust to 'current'?
        ty = -scale * pt[1] + initial.height/2;
    return {x: tx, y: ty, k: scale};
  }

  function resetZoom() {
    active.classed("active", false);
    active = d3.select(null);

    svg.transition().duration(3000).ease(d3.easeLinear)
      .call(zoom.transform, zoom0)

    svg.call(zoom)
  }

  function nozoom() {
    d3.event.preventDefault();
  }


//// QUADTREE / DATA / INTERSECT QUERIES

  function makeQuadtree(triggerData,bufferedRoute) {
    // search and nodes functions taken from https://bl.ocks.org/mbostock/4343214

    // get projected bounding box of chosen route
    let pathBox = projPath.bounds(bufferedRoute),
             x0 = pathBox[0][0], // xmin
             y0 = pathBox[0][1], // ymin
             x1 = pathBox[1][0], // xmax
             y1 = pathBox[1][1]; // ymax

    // initiate quadtree with specified x and y functions
    const projectX = d => { return projection(d.geometry.coordinates)[0] },
          projectY = d => { return projection(d.geometry.coordinates)[1] };

    quadtree = d3.quadtree(triggerData,projectX,projectY)
                 .extent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])

    // projection.clipExtent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])
    // identity.clipExtent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])

    ///// QUADTREE / TRIGGER NODES ADDED TO DOM
    let grid = g.append("g")
                .attr("id","quadtree")

    grid.selectAll(".quadnode")
        .data(nodes(quadtree))
        .enter().append("rect")
          .classed("quadnode", true)
          .attr("x", function(d) { return d.x0; })
          .attr("y", function(d) { return d.y0; })
          .attr("width", function(d) { return d.y1 - d.y0; })
          .attr("height", function(d) { return d.x1 - d.x0; })
          .style("fill","none")
          // uncomment for visual of grid
            // .style("fill","tomato")
            // .style("stroke","whitesmoke")
            // .style("stroke-width","0.2px")
            // .style("opacity","0.4")

    let triggerPts = g.append("g")
                      .attr("id","trigger-pts")

    triggerPts.selectAll(".trigger-pt")
              .data(triggerData)
              .enter().append("circle")
                .classed("trigger-pt", true)
                .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
                .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
                .property("id", d => {return d.properties.id; })
                .property("name", d => { return d.properties.NAME; })
                .property("category", d => { return d.properties.CATEGORY; })
                .property("subtype", d => { return d.properties.TYPE; })
                .property("details", d => { return d.properties.MORE_INFO; })
                // .style("fill","none")
                // temporary visual (all triggerPts)
                .attr("r", 0.2)
                .style("fill","lightgreen")
                .style("stroke","goldenrod")
                .style("stroke-width","0.1px")
                .style("opacity", 0.8)
                .on("mouseover", onMouseover)
                .on("mouseout", onMouseout)

    // Collapse the quadtree into an array of rectangles.
    function nodes(quadtree) {
      var nodes = [];
      quadtree.visit(function(node, x0, y0, x1, y1) {
        node.x0 = x0, node.y0 = y0;
        node.x1 = x1, node.y1 = y1;
        nodes.push(node);
      });
      return nodes;
    }

    return quadtree;
  }

  function lookAhead(searchExtent) {

    let newlyEncountered = searchQuadtree(quadtree, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1]);

    if (newlyEncountered.length) {
      // REMOVE NEWLY SELECTED TRIGGER PTS FROM QUADTREE POOL
      quadtree.removeAll(newlyEncountered)
    }

  }

  function searchQuadtree(quadtree, x0, y0, x3, y3) {

    let selected = [];

    quadtree.visit(function(node, x1, y1, x2, y2) {

      if (!node.length) { // if node is not an array of nodes (i.e. has content)
        do {
          let d = node.data;
          let d0 = projection(d.geometry.coordinates)[0],
              d1 = projection(d.geometry.coordinates)[1];
          d.selected = (d0 >= x0) && (d0 < x3) && (d1 >= y0) && (d1 < y3);
          if (d.selected) {
            // console.log("found match in quadtree at " + performance.now())

            // save d id as triggerId
              // for lines only, recognize multiTrigger flag and pass both ids together as pair
            let triggerId = (d.properties.multiTrigger) ? [d.properties.oid + "-1", d.properties.oid + "-2"] : d.properties.id;

            dispatch.call("encounter", triggerId);

            selected.push(d)
          }
        } while (node = node.next);
      }
      return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
    });

    return selected;

  }


//// ANIMATION

  function goTrain(zoomFollow,zoomArc,enrichData,routeBounds) {

    let tDelay,tMid;

    let simpDistance = Math.floor(turf.length(zoomFollow.fullSimp, {units: "miles"})),
               scale = g.node().transform.animVal[1].matrix.a;  // default to current

    // tFull is based on ms/simplified mile for later tDelay calc reasons
    let tFull = Math.max(tpm * simpDistance, tPause) // effective ms per simp mile * simp miles, or tPause value if former less than latter
         tEnd = 0;                  // default 0 in case no difference between routeBounds and firstFrame

    let headlights = g.select("#headlights"),
          semiSimp = g.select("#semi-simp"),
             point = g.select("#train-point"),
          fullPath = g.select("#full-route"),
          azimuth0 = headlights.property("azimuth0");

    if (!zoomFollow.necessary) {

      // no more zooming; make quadtree at this point since view/data pts will remain consistent here on in
      quadtree =
      makeQuadtree(enrichData.triggerPts,enrichData.withinBuffer);
      // pause, then start train movement
      d3.timeout(() => {
        // if (confirm("Ready?")) {
          // d3.timerFlush() // necessary?
          // disable free zooming
          svg.on('.zoom',null)
          // call initial point transition
          goOnNow(scale,routeBounds) // pass routeBounds as lastIdentity
        // }
      }, tPause)

    } else {  // calculate transforms and timing from firstFrame to lastFrame

      // pass hard coded scale that seems to be widely appropriate given constant bufferExtent
      scale = scale1;

      let firstIdentity = getIdentity(centerTransform(projection(zoomFollow.firstThree[1]),scale)),
           lastIdentity = getIdentity(centerTransform(projection(zoomFollow.lastThree[1]),scale));

      tDelay = (simpDistance > 300) ? tpm * 100 : tpm * 0,      // delay zoomFollow until train hits mm 100 (of fullSimp) IF route long enough
        tMid = tFull - (tDelay*2),  // tDelay doubled to account for stopping 100m from end
        tEnd = tPause;              // arbitrary time to zoom to start frame

      // helpful??
      // let x0 = firstFrame[0][0], // xmin
      //     y0 = firstFrame[0][1], // ymin
      //     x1 = firstFrame[1][0], // xmax
      //     y1 = firstFrame[1][1]; // ymax
      // projection.clipExtent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])
      // identity.clipExtent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])

      // zoom to First frame
      svg.transition().duration(tEnd*2) // .ease(d3.easeBounceIn)
        .call(zoom.transform, firstIdentity)
          .on("end", () => {
            // confirm g exactly in alignment for next transition
            g.attr("transform",firstIdentity.toString())
            // make quadtree (now that view/data pts will remain consistent)
            quadtree =
            makeQuadtree(enrichData.triggerPts,enrichData.withinBuffer);
            // dim background
            dimBackground()
            // turn on headlights
            headlights.transition().duration(tEnd*2)
              .style("opacity",0.6)
              .on("start", () => {
                d3.timeout(() => {
                  // if (confirm("Ready?")) {
                    // d3.timerFlush() // necessary?
                    // disable free zooming
                    svg.on('.zoom',null)
                    // call initial point transition, passing simplified path
                    goOnNow(scale,lastIdentity,zoomArc)
                  // }
                }, tEnd)
              })
          })

    }

    function dimBackground() {
      // temporarily dim background, admin, rail, urban during animation (to focus visualization / ease problem solving and reduce load until performance improved)
      let toDim = [d3.select("#admin-base"),d3.select("#hydro-base"),d3.select("#urban-base"),d3.select("#rail-base")];
      toDim.forEach(selection => {
        let currentOpacity = selection.style("opacity")
        selection // .selectAll("*")
          .transition().duration(2400)
          .style("opacity", currentOpacity * 0.4)
          // .on("end", () => {
          //   selection.selectAll("*").remove();
          // })
        });

      // // partial dim #admin-base elements
      // [d3.select("#continent-mesh"), d3.select("#country-borders"), d3.select("#state-borders")].forEach(selection => {
      //   let currentFill = selection.style("fill"),
      //       currentStroke = selection.style("stroke");
      //   if ((currentFill) && (currentFill !== "none")) {
      //     selection.transition().duration(2400)
      //       .style("fill", chroma(currentFill).darken(3))
      //       .style("opacity",0.4)
      //   }
      //   if ((currentStroke) && (currentStroke !== "none")) {
      //     selection.transition().duration(2400)
      //       .style("stroke", chroma(currentStroke).darken(3))
      //       .style("opacity",0.4)
      //   }
      // });
    }

    function goOnNow(scale,lastIdentity,simpPath) {
      dispatch.call("depart", this)
      // transition train along entire route
    	point.transition().delay(tEnd).duration(tFull).ease(d3.easeSinInOut)
  		  .attrTween("transform", translateAlong(fullPath))
        // point transition triggers additional elements
        .on("start", () => {
          // kick off global timer!
          timer = d3.timer(animate)
          // keep headlights on, allowing lookAhead() for triggerPts
          headlights.transition().duration(tFull).ease(d3.easeSinInOut)
            .attrTween("transform", bearWithMe(semiSimp,azimuth0))
          // illuminate path traversed as train progresses
          fullPath.style("opacity", 1)
            .transition().duration(tFull).ease(d3.easeSinInOut)
              .styleTween("stroke-dasharray",tweenDash)
          // zoomFollow if necessary
          if (simpPath) { // (firstThree[1] !== lastThree[1]) {
            g.transition().delay(tDelay).duration(tMid).ease(d3.easeSinInOut)
              .attrTween("transform", zoomAlong(simpPath,scale))
          }
        })
       .on("end", () => {
         // ensure final alignment
         g.attr("transform",lastIdentity.toString())
         // dispatch custom "arrive" event
         dispatch.call("arrive", this)
         // inform d3 zoom behavior of final transform value and reenable free zooming
         svg.call(zoom.transform, lastIdentity)
         svg.call(zoom)
       });
    }

    function animate(elapsed) {
      // dispatch another move event
      dispatch.call("move", point)
    }

  }

  let prevLocation, prevExtent, searchExtent, transformString;
  let extentVis, rhombusVis; // temporary visualizations
  function trainMoved() {

    let trainTransform = this.node().transform.animVal[0].matrix,
       currentLocation = [trainTransform.e, trainTransform.f],
            headlights = g.select("#headlights");

    if (!searchExtent) {  // get first time only

      let sectorBBox = headlights.node().getBBox(),
            arcWidth = sectorBBox.width,
           arcHeight = sectorBBox.height;

      // MAKE RHOMBUS AROUND ARC FOR EXTENT VISUALIZATION

      // ** can adjust rhombusHeight such that furthermost point is far enough to counteract lag in triggerPt/fullGeom visualization **
      let rhombusHeight = (arcHeight * 4/5) // * 2;

      let origin = [0,0], // use SVG transforms to position
       reflected = [origin[0], origin[1] - rhombusHeight],  // subtracts height to account for SVG reflection
      clockwise0 = [reflected[0] - arcWidth/2, reflected[1] + rhombusHeight/2],
      clockwise1 = [reflected[0] + arcWidth/2, reflected[1] + rhombusHeight/2];

      let rhombus = turf.convex(turf.featureCollection([
        turf.point(origin),
        turf.point(clockwise0),
        turf.point(reflected),
        turf.point(clockwise1),
        turf.point(origin)
      ]));

      let rhombusExtent = [[-arcWidth/2,-rhombusHeight],[arcWidth/2,0]]

      // CALCULATE SEARCH EXTENT FOR QUADTREE
      // theoretically min x,y, max x,y
        // due to SVG y reflection, must switch min/max y's for numeric comparison within quadtree
      // searchExtent = [[currentLocation[0] - arcWidth/2, currentLocation[1] - rhombusHeight],[currentLocation[0] + arcWidth/2, currentLocation[1]]]

      // TRYING MUCH SMALLER EXTENT SINCE ALL TRIGGER PTS NOW ON ROUTE
      let x = 2,
          y = 2;
      searchExtent = [[currentLocation[0] - x, currentLocation[1] - y],[currentLocation[0] + x, currentLocation[1] + y]]

      // VISUALIZE TRANSFORMED SEARCH EXTENT AND RHOMBUS
      let rotate0 = headlights.property("azimuth0");

      transform0 = "translate(" + currentLocation[0] + "," + currentLocation[1] + ") rotate(" + rotate0 + ")";

      // extentVis = g.select("#route").append("rect")
      //   .datum(rhombusExtent)
      //   .attr("id","extent-vis")
      //   .attr("x", d => { return d[0][0]; })
      //   .attr("y", d => { return d[0][1]; })
      //   .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
      //   .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
      //   .attr("transform",transform0)
      //   .style("fill","steelblue")
      //   .style("stroke","whitesmoke")
      //   .style("stroke-width","0.3px")
      //   .style("stroke-dash-array",origDash)
      //   .style("opacity",0.2)
      // rhombusVis = g.select("#route").append("path")
      //   .datum(rhombus)
      //   .attr("d",nullPath) // y is already reflected
      //   .attr("transform",transform0)
      //   .style("fill","tomato")
      //   .style("stroke","silver")
      //   .style("stroke-width","0.3px")
      //   .style("stroke-dash-array",origDash)
      //   .style("opacity",0.4)

      // upon train arrival, schedule fade/remove of headlights + each extentVis node
      dispatch.on("arrive", () => {
        // extentVis.transition().duration(tPause)
        //          .style("opacity",0)
        //          .on("end", () => {
        //            extentVis.classed("none",true)
        //            extentVis.remove()
        //          })
        // rhombusVis.transition().duration(tPause)
        //           .style("opacity",0)
        //           .on("end", () => {
        //             rhombusVis.classed("none",true)
        //             rhombusVis.remove()
        //           })
        headlights.transition().duration(tPause)
                  .style("opacity",0)
                  .on("end", () => {
                    headlights.classed("none",true)
                    headlights.remove()
                  })
      })

      headlights.raise() // keep headlights on top of extent visualizations

      this.raise(); // keep train on top of extentVis

    } else {  // get adjusted transformString and searchExtent on each trainMove

      let rotate = headlights.node().transform.animVal[1].angle,
              dx = currentLocation[0] - prevLocation[0],
              dy = currentLocation[1] - prevLocation[1],
              tx = currentLocation[0] + dx,
              ty = currentLocation[1] + dy;

      let translatedExtent = translateExtent(prevExtent,dx,dy);
      searchExtent = translatedExtent;  // works but lags and too narrow

      // let rotatedExtent = rotateExtent(prevExtent,rotate),
      //   rotatedThenTranslated = translateExtent(rotatedExtent,dx,dy)
      // searchExtent = rotatedThenTranslated;  // BEST? though rotate still not exact

      // ALT OPTION:
      // scrap quadtree and boolean search for triggerPt in rhombus polygon (how much slower?)
        // or will this run into same issues? *** how to rotate individual pts?? or otherwise calculate new coordinates of transformed svg element? ***

      // // individual extent visualizations (TEMPORARY)
      // let tempVis = g.select("#route").append("rect")
      //   .datum(searchExtent)
      //   .attr("x", d => { return d[0][0]; })
      //   .attr("y", d => { return d[0][1]; })
      //   .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
      //   .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
      //   .style("fill","magenta")
      //   .style("stroke","whitesmoke")
      //   .style("stroke-width","0.3px")
      //   .style("opacity",0.6)
      //
      // d3.timeout(() => {
      //   tempVis.transition().duration(600)
      //          .style("opacity",0)
      //          .on("end", () => {
      //            tempVis.classed("none",true)
      //            tempVis.remove()
      //          })
      // }, 600);

      function translateExtent(extent,dx,dy) {
        return extent.map(d => { return [d[0]+dx, d[1]+dy] });
      }
      function rotateExtent(extent,degrees) {

        let angle = turf.degreesToRadians(degrees),
            width = extent[1][0]-extent[0][0],
           height = Math.abs(extent[1][1]-extent[0][1]),
              // pt0 = extent[0],
              // pt1 = extent[1],
            midPt = [extent[0][0]+width/2,extent[0][1]+height/2];

        let point = midPt,
            pivot = currentLocation;
        let rotatedPt = rotatePt(point,angle,pivot);

        // get differences relative to midPt
        let deltaX = rotatedPt[0]-point[0],
            deltaY = rotatedPt[1]-point[1];

        // adjust extent pts accordingly // DEFINITELY NOT EXACT
        let rotatedExtent = extent.map(d => { return [d[0]+deltaX,d[1]+deltaY] });

        // let point0 = pt0,
        //     point1 = pt1;
        // pivot = midPt;
        //
        // // rotate point around pivot
        // let rotatedPt0 = rotatePt(point0,angle,pivot),
        //     rotatedPt1 = rotatePt(point1,angle,pivot);
        //
        // let rotatedExtent2 = [rotatedPt0,rotatedPt1]
        //
        // return rotatedExtent2;

        return rotatedExtent;

        // adapted from stackoverflow answer https://stackoverflow.com/questions/2259476/rotating-a-point-about-another-point-2d
        function rotatePt(point,angle,pivot = [0,0]) {  // angle in radians

          // translate point back to origin
          let origin = [point[0] - pivot[0], point[1] - pivot[1]],
                 sin = Math.sin(angle),
                 cos = Math.cos(angle);

          // rotate point
          let x = origin[0] * cos - origin[1] * sin,
              y = origin[0] * sin + origin[1] * cos;

          // translate back to pivot pt
          let rotated = [x + pivot[0], y + pivot[1]]

          return rotated;

        }

      }

      transformString = "translate(" + tx + "," + ty + ") rotate(" + rotate +")"

    }

    lookAhead(searchExtent); // initiate quadtree search

    // save newly determined values as previous values
    prevLocation = currentLocation,
      prevExtent = searchExtent;

    // // update transform of extentVis
    // extentVis.attr("transform",transformString)
    // rhombusVis.attr("transform",transformString)

  }

  function departed() {
    console.log("train departing @ " + performance.now())
    d3.timerFlush() // necessary?
  }

  function arrived() {
    console.log("train arrived @ " + performance.now())
    timer.stop()
    // observer.disconnect()
  }


//// TRANSITIONS AND TWEENS

  function tweenDash() {
    var l = this.getTotalLength(),
        i = d3.interpolateString("0," + l, l + "," + l);
    return function(t) { return i(t); };
  }

  // function dashBack() {
  //   var l = this.getTotalLength(),
  //       i = d3.interpolateString(l + ",0", "0," + l);
  //   return function(t) { return i(t); };
  // }

  function drawDashed() {
    var l = this.getTotalLength();
    var i = d3.interpolateString(-l,"0"); // results in 0=>dashed in wrong direction
    return function(t) { return i(t); };
  }

  // TRANSLATE ONLY
  function zoomAlong(path,k = currentView.scale) {
    var l = path.node().getTotalLength();
    return function(d, i, a) {
      return function(t) {
        // KEEP NODE P IN CENTER OF FRAME
        var p = path.node().getPointAtLength(t * l);
        // calculate translate necessary to center data within extent
        let tx = -k * p.x + initial.width/2,  // what if window resized during animation??
            ty = -k * p.y + initial.height/2;

        // // ????
        // // clip projected data to minimize shift/render calculations?
        // let clipExtent = [[-(tx ** 2), -(ty ** 2)], [tx ** 2, ty ** 2]]; // extend for leeway around edges?
        // identity.clipExtent(clipExtent)
        // projection.clipExtent(clipExtent)

        return "translate(" + tx + "," + ty + ") scale(" + k + ")";
      }
    }
  }

  // function returns value for translating point along path
  function translateAlong(path) {
    var l = path.node().getTotalLength(); // orig 'this'
    return function(d, i, a) {
      return function(t) {
      	var p = path.node().getPointAtLength(t * l);
        return "translate(" + p.x + "," + p.y + ")";
			}
    }
  }

  function bearWithMe(path,azimuth0) {
    var l = path.node().getTotalLength();
    return function(d, i, a) {
      let rotate = azimuth0,
             pt0 = path.node().getPointAtLength(0);
      // additional rotate interpolator for smoother transitions?
      // address any jumps between, eg., -179 and 179
      return function(t) {
        let pt1 = path.node().getPointAtLength(t * l);  // svg pt
        if (!(pt0.x === pt1.x)) rotate = getRotate(pt0,pt1);
        pt0 = pt1;  // shift pt values pt0 >> pt1
        return transform = "translate(" + pt1.x + "," + pt1.y + ") rotate(" + rotate + ")";
      }
    }
  }

  function reverseSVGPath(pathStr) {
    return ["M",pathStr.split('M')[1].split('L').reverse().join('L')].join('');
  }

  function getDashStr(along,length,dash = dash1) {
    let dashSum = dash.split(" ").map(x => +x)
                     .reduce((accumulator, currentVal) =>
                       accumulator + currentVal, 0
                     ),
      dashTimes = Math.ceil(length/dashSum),
       dashFill = new Array(dashTimes + 1).join(dash + ' '),
        dashStr = dashFill + ", " + length;
    return dashStr;
  }

  // function animateDashed(along,t) {
  //
  //   // see https://bl.ocks.org/kafunk/91f7b870b79c2f104f1ebacf4197c9dc for more commentary
  //
  //   let reversedAlong = along.clone(),
  //              length = reversedAlong.node().getTotalLength();
  //
  //   let dashStr = getDashStr(reversedAlong,length,dash1);
  //
  //   // REVERSE PATH for proper direction
  //   let reversedPath = reverseSVGPath(reversedAlong.attr("d"));
  //
  //   reversedAlong.attr("d", reversedPath)
  //                .attr("id", "full-route-reversed")
  //
  //   // dashed path initially blank
  //   reversedAlong.style("stroke-dasharray", dashStr)
  //                .style("stroke-dashoffset", -length)
  //                .style("opacity", 0.6)
  //
  //   reversedAlong.transition()
  //                .duration(t)
  //                .styleTween("stroke-dashoffset",drawDashed)
  //
  // }

//// REVEAL ENCOUNTERED

  function encountered() {

    // console.log("reached encountered() at " + performance.now())

    let defaultT = tpm * 10, id = this, id1, encountered1;

    if (Array.isArray(this)) {
      id = this[0],
      id1 = this[1],
      encountered1 = g.select(`#${id1}`);
      encountered1.classed("waiting",false);
    }

    // FIND full feature(s) by id
    let encountered = g.select(`#${id}`);
    // remove waiting class upon intersect
    encountered.classed("waiting",false);

    // DETERMINE TYPE, CALCULATE T, VISUALIZE
    if (id.startsWith('ln')) {  // line feature
      let t, tFactor = tpm, tFactor1 = tpm, vectorAdjust = 0.5 // ??
      // where possible, t calculated based on route distance (travel time) from triggerPt => triggerPt
      if (encountered1) {
        // even if multiple segments starting from i0 (linegons), keep t equal for both lines (so they arrive together at i1)
        if (encountered.vectorFlag) {
          tFactor *= vectorAdjust;
        } else if (encountered1.vectorFlag) {
          tFactor1 *= vectorAdjust;
        }
        // for linegons with same pair of route-intersecting start/end pts, these should work out to be the same
        t0 = encountered.datum().properties.tDistance * tFactor,
        t1 = encountered1.datum().properties.tDistance * tFactor1,
        t = [t0,t1],
        encountered = [encountered,encountered1];
      } else {
        if (encountered.vectorFlag) tFactor *= vectorAdjust;
        t = encountered.datum().properties.tDistance * tFactor;
      }
      if (t === 0) {
        // console.log("t === 0")
        // console.log(encountered[0].node().getTotalLength())
        t = Math.pow(encountered[0].node().getTotalLength(),2);
      } else if (Array.isArray(t) && t.includes(0)) {
        // console.log("initial t includes(0)")
        t[0] = Math.pow(encountered[0].node().getTotalLength(),2)
        t[1] = Math.pow(encountered[1].node().getTotalLength(),2)
        // console.log("new t",t)
      }
      reveal(encountered,"line",t)
    } else if (id.startsWith('py')) { // polygon feature
      // if no i1, calculate t dynamically based on polygon area
      // otherwise, calc t based on time train will need to travel from i0 to i1 (use tpm global)
      let t;
      reveal(encountered,"polygon",t)
    } else {  // point feature
      // let tFactor = tpm/2,
      //   t = Math.pow(encountered.datum().properties.tDistance,2) * tFactor;
      reveal(encountered,"point",defaultT * 2)
    }

    output(encountered[0] || encountered)

  }

  function reveal(encountered,type,t = tPause) {

    // all styling basics should already be in place;
    // just need to trigger appropriate transitions based on type

    if (type === "line") {
      // watersheds: animateDashed within varying dashArrays and thickness; higher levels thinner and with more intricate/subtle patterns
      // rivers and streams: animatedSolid in both directions with continual branching outward (will be necessarily limited by data pool, filtered to certain level of watershed)
      // FOR NOW
      if (Array.isArray(encountered)) { // multiTrigger
        if (encountered[0].property("category") === "Watershed") {

          // console.log(encountered[0].node())
          // console.log(encountered[1].node())
          // console.log(encountered[0].style("stroke-dasharray"))
          // console.log(encountered[1].style("stroke-dasharray"))

          // TODO attune dashArrays (get/pass current?)

          let length0 = encountered[0].node().getTotalLength(),
              length1 = encountered[1].node().getTotalLength(),
             dashStr0 = getDashStr(encountered[0], length0),
             dashStr1 = getDashStr(encountered[1], length1)

          encountered[0].style("stroke-dasharray", dashStr0)
                        .style("stroke-dashoffset", -length0)
                        .style("opacity", 0.6)
                        .transition().duration(t[0]).ease(d3.easeLinear)
                        .styleTween("stroke-dashoffset",drawDashed)
                        .on("start", () => {
                          encountered[1].style("stroke-dasharray", dashStr1)
                            .style("stroke-dashoffset", -length1)
                            .style("opacity", 0.6)
                            .transition().duration(t[1]).ease(d3.easeLinear)
                            .styleTween("stroke-dashoffset",drawDashed)
                        })
        } else {
          encountered[0].style("opacity",0.8)
            .transition().duration(t[0]).ease(d3.easeLinear)
            .styleTween("stroke-dasharray",tweenDash)
            .on("start", () => {
              encountered[1].style("opacity",0.8)
                .transition().duration(t[1]).ease(d3.easeLinear)
                .styleTween("stroke-dasharray",tweenDash)
            })
        }
      } else {
        encountered.style("opacity",0.8)
          .transition().duration(t).ease(d3.easeLinear)
          .styleTween("stroke-dasharray",tweenDash)
      }
    } else if (type === "polygon") {
      // FOR NOW
      encountered.transition().duration(t).ease(d3.easeLinear)
        .style("opacity", 1)
      // animate radial gradient outward from i0
    } else {  // type === "point"
      encountered.transition().duration(t).ease(d3.easeLinear)
          .attr("r",1)
          .style("opacity", 1)  // initial glow effect?
        .transition().duration(t)
          .style("opacity",0.8)
    }

  }

//// OUTPUT AND ALERT incl DASHBOARD

  function output(encountered) {

    // current
    if ((!encountered.datum().properties.segmentFlag) && (encountered.property("name"))) {
      let output = encountered.property("name");
      if (encountered.property("category") === "Watershed") {
        output += `, Level ${encountered.property("level")} Watershed`
      } else if (["Lake Centerline","River (Intermittent)"].includes(encountered.property("category"))) {
        // do nothing
      } else {
        output += ` ${encountered.property("category")}`
      }
      console.log(`now passing ${output}`);
    }

    // future
      // temp popups/tooltips fade in/out
        // points:
          // flash tiny offset tooltip with basic info (name, category)
          // animate cursive writing?
      // legend-log populated
      // dashboard/trackers updated

  }

  function dashUpdate(current) {
    // update dashboard elements: compass visual?, mileage tracker, elevation?
    // time limited, automatic tooltip raises as new points and layers encountered (taken care of through event listeners?)
    log()
  }

  function log(encounter) {
    // initial element type/symbol, plus counter +=1 on each subsequent
    // subsequent encounters
      // add 1 to log count
  }

//// HTML/CSS VISIBILITY MANAGEMENT

  // function feature(element) {
  //   // passed 'about'
  //   // have sidebar content expand upward (from about text at bottom of screen) into modal
  // }
  // function unfeature(element) {
  //   // passed 'about'
  //   // collapse sidebar content downward
  // }

  function noneClass() {
    d3.select(this).classed("none", true)
  }
  function expand(elementStr,direction = ["up"]) {

    // if window too short to reasonably fit more content, expand modal instead
    if (window.innerHeight < 500) {

      oOpen("modal-plus",elementStr)

    } else {

      d3.select(`#${elementStr}`).classed(`disappear-${opposite(direction)}`, false)
      d3.select(`#${elementStr}-collapse`).classed("none", false);
      d3.select(`#${elementStr}-expand`).classed("none", true);

      // size- and element-specific toggles upon expand/collapse of various elements
      if (elementStr === "about") {
        if (window.innerWidth > 1200) {
          d3.select("#section-wrapper").classed("relative", true);
          d3.select("#attribution").classed("mr24", false);
        } else {
          d3.select("#dash-up").classed("mt-neg6", false);
          d3.select("#dash-up").classed("mt-neg18", true);
          d3.select("#dash-expand-btn").classed("h24", false)
          // d3.select("#dash-expand-btn").classed("h18", true)
        }
      } else if (elementStr === "dash") {
        d3.select("#attribution").classed("mt-neg24", false)
        // d3.select("#attribution").classed("mt-neg6",true)
        if (window.innerWidth > 1200) {
          d3.select("#dash-expand-btn").classed("h24", false)
          d3.select("#dash-expand-btn").classed("h18", true)
        }
      }

      function opposite(direction) {
        const opposites = {
          up: "down",
          down: "up",
          right: "left",
          left: "right"
        };
        return opposites[direction];
      }

    }
  }

  function collapse(elementStr, direction = "down") {

    d3.select(`#${elementStr}`).classed(`disappear-${direction}`, true);
    d3.select(`#${elementStr}-expand`).classed("none", false);
    d3.select(`#${elementStr}-collapse`).classed("none", true);

    // allow `disappear-${direction}` transition to complete before adding "none" class
    // d3.timeout(() => {
    //   d3.select(`#${elementStr}`).classed("none", true)
    // }, 600);

    // size- and element-specific toggles upon expand/collapse of various elements
    if (elementStr === "about") {
      if (window.innerWidth > 1200) {
        d3.select("#section-wrapper").classed("relative", false);
        d3.select("#attribution").classed("mr24", true);
      } else {
        d3.select("#dash-up").classed("mt-neg6", true); // prev mt-neg12
        d3.select("#dash-up").classed("mt-neg18", false);
        d3.select("#dash-expand-btn").classed("h24", true)
        // d3.select("#dash-expand-btn").classed("h18", false)
      }
    } else if (elementStr === "dash") {
      d3.select("#attribution").classed("mt-neg24", true)
      // d3.select("#attribution").classed("mt-neg6", false)
      if (window.innerWidth > 1200) {
        d3.select("#dash-expand-btn").classed("h24", true)
        // d3.select("#dash-expand-btn").classed("h18", false)
      }
    }

  }

  function oOpen(elementStr, subContent) {

    if (subContent) {
      d3.select(`#${subContent}`).classed("none", false);
      if (elementStr === "modal-plus") {
        // TOGGLE form/about modal content
        if (subContent === "modal-about") {
          collapse("about","down");
          d3.select("#getInitOptions").classed("none", true)
        } else if (subContent === "getInitOptions") {
          d3.select("#modal-about").classed("none", true)
        }
      }
      // doesn't register as a resize event but map may need adjustments following subContent collapse
      resize()
    }

    d3.select(`#${elementStr}`).classed("none", false);

  }

  function xClose(elementStr) {
    d3.select(`#${elementStr}`).classed("none", true);
  }

//// BUTTONS & FUNCTIONAL ICONS

  // use remoteControl.js for most

  function selectNew() {
    // if mid-animation, pause and confirm user intent
    if (experience.animating) {
      // pauseAnimation() // remoteControl.pause()
      let confirmed = confirm('Do you wish to select a new route?');
      if (!confirmed) {
        // resumeAnimation(); // remoteControl.play()
        return;
      }
    }
    // if animation finished/canceled or select new confirmed
    // perform variety of resets
    d3.select("#submit-btn-txt").classed("none",false);
    d3.select("#submit-btn-load").classed("none",true);
    experience.initiated = false;
    // resetZoom();
    // open selection form
    oOpen('modal');
  }

//// PIZAZZ

  // TOOLTIPS
  function onMouseover(d) {

    // visual affordance for element itself
    // d3.select(d).classed("hover", true).raise();

    // make/bind/style tooltip, positioned relative to location of mouse event (offset 10,-30)
    let tooltip = d3.select("#map").append("div") // ("body").append("div")
      // .datum(d)
      .attr("class","tooltip")
      .html(getTooltipContent(d3.select(this)))
      .style("left", (d3.event.layerX + 10) + "px")
      .style("top", (d3.event.layerY - 30) + "px")
      // .style("left", (d3.event.pageX + 10) + "px")
      // .style("top", (d3.event.pageY - 30) + "px")
      .style("fill", "honeydew")
      .style("stroke", "dimgray")
      .style("opacity", 0) // initially

    // bring tooltip into full opacity
    tooltip.transition().duration(300)
      .style("opacity", 1)

    function getTooltipContent(d) {
      let content = `<span>${d.property("name")}</span>` // for now
      // let content = `
      //   <span class="category">Facility Name: </span>
      //   <span class="align-r">${titleCase(d.Facility_Name)}</span>
      //   <br />
      //   <span class="category">Location: </span>
      //   <span class="align-r">${titleCase(d.City)}, ${d.State}</span>
      //   <br />
      //   <span class="category">2018 Percent Voter Turnout: </span>
      //   <span class="align-r">${Math.floor(d.Total).toLocaleString()} metric tons</span>
      // `
      return content;
    }
  }

  function onMouseout(d) {

    // d3.select("#current-hover").remove();

    // console.log(d) // gj
    // console.log(d3.event) // event
    // console.log(d3.select(`#${d.properties.id}`).node()) // circle
    // console.log(d3.select("body").selectAll(".tooltip").node()) // tooltip
    // console.log(d3.select("body").selectAll(".tooltip").nodes()) // array of all tooltips

    // reset visual affordances
    // node.classed("hover", false)

    // access existing
    let tooltip = d3.select("body").selectAll(".tooltip") //.datum(d => { return d.properties.id; }) // key function? match by id

    // transition tooltip away
    tooltip.transition().duration(600)
      .style("opacity", 0)

    // remove tooltip from DOM?
    tooltip.exit().remove();
  }

  // COLOR

  // TRANSITIONS


//// OTHER HELPER FUNCTIONS

  // CLEANING UP
  function clearDOM() { }

  function endall(transition,callback) {
    var n = 0;
    transition.each(function() { ++n; })
              .each("end", function() { if (!--n) callback.apply(this, arguments); });
  }

  // function dynamicallySimplify() {
  //   minZ = 1 / scale * scale;
  //   // minZi, minZp
  // }


  // THE PARSING OF THINGS
  function replaceCommas(string){
    let commaFree = string.replace(/\s*,\s*|\s+,/g, '%2C');
    return commaFree;
  }

  function titleCase(str) {
    return str.toLowerCase().split(' ').map(function(word) {
      // TODO create titleCase exceptions for LLCs, US, initials, words in paretheses
      if (word == 'llc' || word == 'us' || /(\.[a-z]\.)/.test(word)) {
        return word.toUpperCase();
      } else if (['(',')','-',':','/'].includes(word[0])) {
        return (' ' + word.charAt(0) + word.charAt(1).toUpperCase() + word.slice(2));
      } else {
        return capitalize(word);
      }
    }).join(' ');
  }

  function capitalize(word) {
      return (word.charAt(0).toUpperCase() + word.slice(1));
    }

  // BROADLY APPLICABLE OR NOT AT ALL
  function uniqueOn(array,prop = "properties",subProp = "id") {
    // largely from https://reactgo.com/removeduplicateobjects/
    let unique = array.map(d => d[prop][subProp])
                      .map((d, i, final) => final.indexOf(d) === i && i)         // store the keys of the unique objects
                      .filter(d => array[d])  // eliminate the dead keys
                      .map(d => array[d])     // restore unique objects
    return unique;
  }
  // prevent window reprompt on apps with lots of moving parts
  // function localStore() {
  //   // add somewhere to prevent reprompt
  //   localStorage.optionsReceived = true;
  //   ////
  //   // let bigVVal = capitalize(val);
  //   // var element = d3.select(`#get${bigVVal}`);
  //   // localStorage.setItem(val, element.value); // sessionStorage?
  //   // var stored = localStorage.getItem(val);
  //   // return stored;
  // }

  // function perfCheck(fx,params) {
  //   let t0 = performance.now();
  //   fx(params)
  //   let t1 = performance.now();
  //   let elapsed = t1 - t0;
  //   console.log(`${fx}-ing to ${params} took ${elapsed} milliseconds`)
  // }

  // ERRORS
  function onError(error) {
      console.log(error);
    }

// })


// TODO
// remove stns: shriver LA,  sault ste marie on, barachois qc, labrador city lb, Kitimat-Stikine BC, saratoga springs?, clemson sc?
// remove excess route saving data etc
// use quadtree for initial filtering search
// restructure triggering (bc triggerPts now all on route itself)
  // i0 = w/in trainMove window
// problem solve directionality:
  // which paths need to be reversed? what is rule?
    // drawDashed
    // north/right of line?
// problem solve GJ.tdistance === 0
// fix watershed color scale (stable shades of silver/light grey?)
// improve dashArrays
// max river strokewidth => smaller
// triangle symbols on getRoute form, @media screen small => bigger
///
// on @media screen up to ml, #about collapsed with icon?
// change onclick functions to toggle structure https://developer.mozilla.org/en-US/docs/Web/Events/toggle
// add functionality to info icon, which appears only on small screens
///
// many more interspersed COMBAKs, FIXMEs, TODOs
// lots of other things
///

// d3.select("#map"), adjust neg margins?
// close #about on trainmove
// open #dash on trainmove 
