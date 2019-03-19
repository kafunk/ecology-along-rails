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
        railStns = d3.json("data/final/na_rr_stns.json"),
  // merged enrich data
     enrichPolys = d3.json("data/final/enrich_polys_plus.json"),
     enrichLines = d3.json("data/final/enrich_lines_plus.json"),
       enrichPts = d3.json("data/final/enrich_pts_plus.json"),
  // quadtree ready
    quadtreeReps = d3.json("data/final/quadtree_search_reps.json");


//// ASSORTED VARIABLE DECLARATION

  // FOR EASY ACCESS/ADJUSTMENT:
  var arcSteps = 500 // how fine tuned SVG path animation
    headlightRadius = 6,
    tpm = 80,  // time per mile; hard-coded goal of animated ms per route mile (more == slower); eventually should be user-adjustable via slider
    minT = tpm * 10,
    tPause = 2400,  // standard delay time for certain transitions
    viewFocusInt = 100, // miles in/out to initially focus view, start/stop
    zoomFollowScale = 14, // hard coded scale seems to be widely appropriate given constant bufferExtent; ~12-18 good
    zoomDuration = tPause *2,
    zoomEase = d3.easeCubicIn,
    zoomAlongOptions = {padBottom: 1 + zoomFollowScale/10},
    relativeDim = 0.2, // dimBackground level
    maxOutput = 30;  // max cells of narration text output during animation

  // default options
  let quadtreeDefaultOpts = {
    // bounding: ,
    projectX: d => projection(d.geometry.coordinates)[0],
    projectY: d => projection(d.geometry.coordinates)[1]
  }

  var padX = 0,
      padY = -18;
      // marginX = 0,
      // marginY = 0;

  // SVG SIZING
  var initial = calcSize();

  // console.log("initial height",initial.height)
  // console.log("initial width",initial.width)

  var extent0 = [[-initial.width/2, -initial.height/2],[initial.width/2, initial.height/2]],
   translate0 = [(initial.width + padX)/2, (initial.height + padY)/2],
       scale0 = 0.9; // initial overview scale

  // CURRENT STATE (NOT IDEAL)
  let experience = { initiated: false, animating: false };

// SET UP SVG

  var svg = d3.select("#map").append("svg")
    .attr("width", initial.width)
    .attr("height", initial.height)
    .attr("preserveAspectRatio", "xMidYMid meet") // slice")
    .attr("viewBox", `0 0 ${initial.width} ${initial.height}`)
    // .classed("svg-content", true)

  // space to define elements for later <use></use>
  var defs = svg.append("defs");

  var background = svg.append("rect")
    .attr("id", "background")
    .attr("width", initial.width)
    .attr("height", initial.height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .on("dblclick", function() {
      resetZoom() // having this inside wrapper function avoids error from not yet having declared `active`
    })

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

  svg.call(zoom.transform, zoom0) // keep this line first
     .call(zoom)
     .on("dblclick.zoom", null) // for now; at least while modal is open

// SET UP CUSTOM DISPATCH BEHAVIOR

  let dispatch = d3.dispatch("depart","move","encounter","arrive","force")
    .on("depart.train", departed)
    .on("move.train", trainMoved)
    .on("encounter.trigger", encountered)
    .on("arrive.train", arrived)
    .on("force.tick", updateLabelPositions)

// DECLARE (BUT DON'T NECESSARILY DEFINE) CERTAIN VARIABLES FOR LATER ACCESS

  let timer, routeQuadtree; // observer

  var labels = [];

  var labelLayout = d3.forceSimulation(labels)
    // .force('collision', rectCollide().size(d => [d.label.length, 1])) // size is relative estimate based on number of letters long (x constant letters high)
    // .force('collision', d3.forceCollide().radius(1))
    .force('x', d3.forceX().x(d => d.x0).strength(100))
    .force('y', d3.forceY().y(d => d.y0).strength(100))
    // .on('tick', updateLabelPositions)
    .stop()  // will control ticks manually as labels are added

  let encounteredPts = new Set(), // [],
    encounteredLines = new Set(), // [],
    encounteredPolys = new Set(), // [],
    uniqueEncounters = new Set(),
       allEncounters = [];

  let enterAlign = "left",
       exitAlign = "right";

  let togglesOff = {
    info: false,
    select: false
  }
  let assocBtns = {
    // contentId: btn
    "modal-about": "info",
    "get-options": "select"
  }
  let oppContent = {
    "modal-about": "get-options",
    "get-options": "modal-about"
  }

  let defaultOptions = {
    extent: extent0,
    scalePad: 0.1,
    padTop: 0,
    padRight: 0,
    padBottom: 0,
    padLeft: 0
  }

  const cityState = d => { return d.city + ", " + d.state; }

  let prevLocation, prevRotate, prevExtent, searchExtent;

  let mm = 0, accumReset = 0, geoMM;

  let totalMiles;

// COLORS

  const palette = ['#94417f','#CD5C5C','#fa8253','#ec934a','#c7993f','#dbd99f']

  const paletteScale = chroma.scale(palette).domain([1,0]).mode('lch') //.correctLightness();

  const riverBlue = "aquamarine",
         lakeBlue = "teal";

  let colorAssignments = {
    watersheds: {
      // oceanId: { base: baseColor }
      10: { base: "#F0F8FF" },
      20: { base: "#a1d7df" },
      30: { base: "#87CEEB" },
      40: { base: "#20B2AA" },
      50: { base: "#2F4F4F" }
    },
    ecoregions: {
      // ecozone: { base: baseColor }
      // originally based on https://www.epa.gov/eco-research/ecoregions-north-america#pane-1
      // blues adjusted to retain contrast between ecoregions and lakes, rivers, and watershed boundaries
      1: { base: "#800080" },
      2: { base: "#7B68EE" }, // "#8c99cd" },
      3: { base: "#587dbe" }, // "#80b8e4" },
      4: { base: "#3ea3b1" },
      5: { base: "#DDA0DD" }, // "#a1d7df" },
      6: { base: "#50b244" },
      7: { base: "#46b5b0" },
      8: { base: "#b1d57b" },
      9: { base: "#f3c28a" },
      10: { base: "#f7d758" }, // '#b5be6a','#9dc579','#8bc188'
      11: { base: "#c9e1a9" },
      12: { base: "#d3cd80" },
      13: { base: "#b1d57b" },
      14: { base: "#e96c53" },
      15: { base: "#b75b9f" }
    }
  };

  var linearGradientScale = d3.scaleLinear().range(palette);

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
    // this one used for current train point only
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

// TEXTURES
  let tWaves = textures.paths()
    .d("waves")
    .background(lakeBlue)
    .stroke("mediumseagreen")
    .thicker(18)
    .lighter(12)
    .shapeRendering("crispEdges")
  let tCrosses = textures.paths()
    .d("crosses")
    .thicker(18)
    .lighter(12)
    .shapeRendering("crispEdges")
  let tNylon = textures.paths()
    .d("nylon")
    .lighter(12)
    .thicker(18)
    .shapeRendering("crispEdges")
  let tLines = textures.lines()
    // .size(0.5)
    .thicker(18)
    .lighter(12)
    .orientation("diagonal")
  let tCircles = textures.circles()
    .complement()
    .thicker(18)
    .lighter(12)
    .fill(paletteScale(random()))
  let tHexagons = textures.paths()
    .d("hexagons")
    .thicker(24)
    .lighter(18)
    .shapeRendering("crispEdges")
    .fill("transparent")

  svg.call(tWaves)

  let textureOpts = [tCircles,tHexagons,tNylon,tCrosses,tLines]

  textureOpts.forEach(d => {
    d.stroke(paletteScale(random()))
  })


//// PREPARE MAP LAYERS

  // SET BOUNDING BOX
  initBounds.then(data => {
    projection.fitExtent(extent0,topojson.feature(data,data.objects.bounds))
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
    let lakeMesh = getMesh(sourceData.hydroUnits,"hydroUnits", (a,b) => { return a.properties.strokeweig === null }),
       urbanMesh = getMesh(sourceData.urbanAreas,"urbanAreas"),
   continentMesh = getMesh(sourceData.countries,"countries",outerlines()),
   countriesMesh = getMesh(sourceData.countries,"countries",innerlines()),
      statesMesh = getMesh(sourceData.states,"states",innerlines());

    // console.log("* base data *",sourceData)

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
      .data(sourceData.hydroUnits.gj.features.filter(d => { return d.properties.strokeweig !== null }))
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
        .attr("r", 0.4)
        .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
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
    d3.select("#modal-plus").classed("none",false)
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

      let focused = event.target, // COMBAK event undefined in Firefox
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
        }, onError);

      }

    }, onError);

  }

  // provide user feedback that map content is loading
  function toggleLoading() {

    toggleModal()

    d3.select("#veil")
      .transition().duration(600)
        .style("opacity", 0)
        .on("end", function() {
          d3.select(this).classed("none", true)
        })

    d3.select("#map-init-load").style("opacity",0).classed("none", false)
      .transition().duration(300)
        .style("opacity", 1)

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

    function parseReceived(raw) {

      let route = raw.routes[0],
       mergedGJ = turf.lineString(route.segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat()),
        inMiles = kmToMi(route.distance);

      let thisRoute = {
        from: raw.places[0],
        to: raw.places[1],
        totalDistance: inMiles,
        totalTime: route.totalTransitDuration, // not including transfers
        lineString: mergedGJ,
        segments: route.segments.map(storeSegmentDetails),
        allStops: raw.places,
        overallBearing: turf.bearing([raw.places[0].lng,raw.places[0].lat],[raw.places[1].lng,raw.places[1].lat]),
        arcPts: truncatedProject(getSteps(arcSteps)),
        geoMM: getSteps(Math.round(inMiles))
      }

      // store unprojected milemarkers as globally accessible coord array
      geoMM = thisRoute.geoMM;

      // easily access to/from coords
      let getCoords = function() {
        this.coords = [this.lng,this.lat]
        return this.coords
      }
      thisRoute.to.coords = getCoords
      thisRoute.from.coords = getCoords

      function getSteps(steps = 500) {  // controlled simplification of route; returns one coord for every (inMiles/steps) miles

        let chunkLength = Math.max(1,Math.round(inMiles/steps)),  // must be at least 1 to avoid errors (happens when getting arcPts on very short routes) but Math.ceil too frequently results in double-length milemarker segments
          lineChunks = turf.lineChunk(mergedGJ,chunkLength,{units:"miles"}).features,
          firstCoords = lineChunks.map(d=>d.geometry.coordinates[0]),
          lastChunk = lineChunks[lineChunks.length-1].geometry.coordinates,
          lastCoord = lastChunk[lastChunk.length-1];

        return firstCoords.concat([lastCoord]);

      }

      function truncatedProject(coords) {

        let projected = coords.map(d => projection(turf.truncate(turf.point(d),{precision:5,mutate:true}).geometry.coordinates));

        return projected;

      }

      // likely will not need all this information
      function storeSegmentDetails(segment) {

        return {
            agency: raw.agencies[segment.agencies[0].agency],
          lineName: segment.agencies[0].lineNames[0],
        lineString: polyline.toGeoJSON(segment.path),
          distance: kmToMi(segment.distance),
             stops: segment.stops,
         departing: raw.places[segment.depPlace],
          arriving: raw.places[segment.arrPlace]
        }

      }

      return thisRoute;

    }

    // Relate route waypts/nodes/links to spatially intersecting (given buffer) data for interesting and illuminating route experience
    function enrichRoute(chosen) {

      let headlightDegrees = 1.5; // was 0.5; play around with approximate conversion of degrees -> pixels given projPath? (some combo of projPath.measure() and projection.invert()?)

      // keep radius consistent with filtered pool of enrichData
      chosen.bufferedRoute = turf.buffer(chosen.lineString, headlightDegrees, {units: "degrees", steps: 12});

      // // optional buffer viz
      // g.append("path")
      //  .attr("id","route-buffer")
      //  .attr("d", line(chosen.bufferedRoute.geometry.coordinates[0].map(d => projection(d))))
      //  .attr("fill","slateblue")
      //  .attr("stroke","black")

      let likelyEnrich = Promise.all([quadtreeReps,initBounds]).then(getIntersected,onError);

      // bind all trigger points to the DOM for en route intersection
      likelyEnrich.then(data => {

        const withinBuffer = d => {
          let point = [d.properties.trigger_x,d.properties.trigger_y]
          return turf.booleanPointInPolygon(point,chosen.bufferedRoute);
        }

        let quadPts = data.pts.filter(withinBuffer),
          quadLines = data.lines.filter(withinBuffer),
          quadPolys = data.polys.filter(withinBuffer);

        let quadData = quadPts.concat(quadLines).concat(quadPolys);

        let options = {
          bounding: chosen.bufferedRoute,
          projectX: d =>  projection([d.properties.trigger_x,d.properties.trigger_y])[0],
          projectY: d => projection([d.properties.trigger_x,d.properties.trigger_y])[1]
        }

        routeQuadtree = makeQuadtree(quadData,options)

        // // optional grid visualization:
        // visualizeGrid(routeQuadtree)

        // non-optional quadtree binding; optional visualization (within function):
        bindQuadtreeData(routeQuadtree,true) // triggerPtFlag === true

      },onError)

      return chosen;

      function getIntersected([quadReps,quadBounds]) {

        // FIRST make a quadtree of all representative enrich data pts draped over North America

        let quadtreeData = topojson.feature(quadReps,quadReps.objects.searchReps).features.filter(d => d.geometry),
              dataExtent = topojson.feature(quadBounds,quadBounds.objects.bounds).features[0]

        let begin = performance.now();

        let quadtree = makeQuadtree(quadtreeData,{bounding:dataExtent})

        // // optional data viz
        // visualizeGrid(quadtree);
        // bindQuadtreeData(quadtree);

        let searchExtent = padExtent(projPath.bounds(chosen.bufferedRoute))  // add x padding to initial quadtree searchExtent to ensure initial filter sufficiently broad; uncomment below for visual

        // g.append("rect")
        //   .datum(searchExtent)
        //   .attr("x", d => { return d[0][0]; })
        //   .attr("y", d => { return d[0][1]; })
        //   .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
        //   .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
        //   .style("fill","orange")
        //   .style("stroke","whitesmoke")
        //   .style("stroke-width","0.3px")
        //   .style("opacity",0.4)
        //
        // g.append("rect")
        //   .datum(projPath.bounds(chosen.bufferedRoute))
        //   .attr("x", d => { return d[0][0]; })
        //   .attr("y", d => { return d[0][1]; })
        //   .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
        //   .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
        //   .style("fill","lightyellow")
        //   .style("stroke","whitesmoke")
        //   .style("stroke-width","0.3px")
        //   .style("opacity",0.4)

        let filteredEnrich = searchQuadtree(quadtree, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1])

        let end = performance.now();
        console.log("quadtree construction + search took", Math.floor(end-begin), "ms")

        console.log("total filtered from pool by quadtree #1:",filteredEnrich.length)

        let possibleFeatures = [...new Set(filteredEnrich.map(d => d.properties.id))];

        console.log("unique possibleFeatures by id:",possibleFeatures.length)

        let likelyEnrich =
        Promise.all([enrichPts,enrichLines,enrichPolys]).then(([pts,lines,polys]) => {

          let likelyEnrich = {
            pts: topojson.feature(pts, pts.objects.enrichPts).features.filter(d => { return possibleFeatures.includes(d.properties.id) }),
            lines: topojson.feature(lines, lines.objects.enrichLines).features.filter(d => { return possibleFeatures.includes(d.properties.id) }),
            polys: topojson.feature(polys, polys.objects.enrichPolys).features.filter(d => { return possibleFeatures.includes(d.properties.id) })
          };

          return likelyEnrich;

        });

        return likelyEnrich;

      }

    }

  }


//// INITIATE EXPERIENCE

  function initExp(chosen) {

    experience.initiated = true;

    let bounds = projPath.bounds(chosen.lineString),
      boundsTransform = getTransform(bounds),  // first iteration used to get scale @ framed full route (k then used to calculate padding below)
      padB1 = 1 + boundsTransform.k / 4,
      options1 = { padBottom: padB1 };

    let screenTarget = (window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#footer").node().clientHeight - d3.select("#about-up-btn").node().clientHeight - d3.select("#dash").node().clientHeight)/2,
      height = bounds[1][1] - bounds[0][1],
      padB2 = screenTarget / height,
      options2 = { padBottom: padB2 };

    // zoom to bounds of chosen route
    // let routeTransform1 = getTransform(bounds,options1), // get transform again, this time with bottom padding (making way for dashboard)
    let routeTransform2 = getTransform(bounds,options2), // get transform again, this time with bottom padding (making way for dashboard)
      boundsScale0 = getBoundsScale(boundsTransform.k),
      // boundsScale1 = getBoundsScale(routeTransform1.k), // don't zoom in beyond set zoomFollowScale
      boundsScale2 = getBoundsScale(routeTransform2.k),
      // routeBoundsIdentity = getIdentity(routeTransform1,boundsScale1),
      routeBoundsIdentity2 = getIdentity(routeTransform2,boundsScale2)//,
      // routeBoundsIdentity3 = getIdentity(routeTransform1,boundsScale2),
      // routeBoundsIdentity4 = getIdentity(routeTransform2,boundsScale1);

    let centroidTransform = centerTransform(projPath.centroid(chosen.lineString),boundsScale0,options1),
    // centroidTransform2 = centerTransform(projPath.centroid(chosen.lineString),boundsScale0,options2)
      centroidBoundsIdentity = getIdentity(centroidTransform,boundsScale0);
      // ,
      // centroidBoundsIdentity2 = getIdentity(centroidTransform2,boundsScale0);

    // console.log(routeBoundsIdentity)
    console.log(routeBoundsIdentity2)//**
    // console.log(routeBoundsIdentity3)
    // console.log(routeBoundsIdentity4)
    console.log(centroidBoundsIdentity)//**
    // console.log(centroidBoundsIdentity2)

    function getBoundsScale(k) {
      if (zoomFollowScale < k) console.log("USING DEFAULT SCALE")
      return Math.min(k,zoomFollowScale)
    }

    // control timing with transition start/end events
    svg.transition().duration(zoomDuration).ease(zoomEase)
      .call(zoom.transform, routeBoundsIdentity2)
      // .call(zoom.transform, centroidBoundsIdentity)
      .on("start", () => {
        prepEnvironment();  // now includes collapse("#about") & drawRoute()
      })
      .on("end", () => {
        // confirm g transform where it should be
        g.attr("transform", routeBoundsIdentity2.toString())
        // g.attr("transform", centroidBoundsIdentity.toString())
        // pause to prepareUser, then initiate animation (incl zoom to firstFrame)
        prepareUser();
        d3.timeout(() => {
          initAnimation(chosen,routeBoundsIdentity2);
          // initAnimation(chosen,centroidBoundsIdentity);
        }, tPause);
      })

    function prepEnvironment() {

      setupDash(chosen)

      // collapse about pane
      collapse("about", collapseDirection(window.innerWidth))
      resize()

      setupEnrichLayer()

      drawRoute(chosen, tPause);

      // depending on direction of train, change #encounters div classes:
        // generally moving west: keep as is
        // generally moving east: use flex-parent--row-reverse / flex-parent--column-reverse; also switch enterAlign => "right", exitAlign => "left"

      // setup dashboard including legend
        // store initial orienting data:
          // total length (leg length sum?)
          // full travel time(basetime?)
          // remainTime, remainDistance
      // setup Tooltips
      // setup / initiate select event listeners
        // use remoteControl.js for button functionality
      // activate newly relevant buttons

      function setupDash(chosen) {

        // ROUTE SUMMARY
        // agency names & lines
        let agencies = [...new Set(chosen.segments.map(d => {
          let lineName = exRedundant(d.lineName,d.agency.name);
          let fullText = (lineName) ? `'s ${lineName} Line` : '';
          return `<a target="_blank" href="${d.agency.url}">${d.agency.name}${fullText}</a>`
        }))]

        function exRedundant(lineName,agencyName){
          let regex = new RegExp(`${agencyName}\\s*`)
          return lineName.replace(regex,'')
        }

        let agencyHtml = `<span>via</span><br>`
        if (agencies.length > 2) {

          agencies.splice((agencies.length - 1),0,"& ");

          // imma stickler for the oxford comma
          agencyHtml += agencies.slice(0,agencies.length-1).join(", ") + agencies[agencies.length-1];

        } else if (agencies.length === 2) {
          agencyHtml += agencies.join(" <span>&</span> ")
        } else {
          agencyHtml += agencies[0];
        }

        // origin & destination
        d3.select("#from").append("span") // after deprat icon
          .text(chosen.from.shortName)
        d3.select("#to").insert("span") // before arrive icon
          .text(chosen.to.shortName)
        d3.select("#via").insert("div")
          .html(agencyHtml)
          .style("stroke","dimgray")

        // WIDGETS
        initElevation()
        initOdometer()
        initSpeedometer()
        initCompass()

        function initElevation() {

          let initCoords = [chosen.from.lng,chosen.from.lat];

          getElevation(initCoords).then(elevation => {

            let test = d3.select("#elevation").append("span")
              .attr("id","current-feet")
              .classed("flex-child txt-s txt-m-mxl txt-mono",true)
              .text(elevation)

            d3.select("#elevation").append("span")
              .classed("flex-child txt-compact txt-xs txt-s-mxl",true)
              .html(`feet above<br> sea level`)

          })

        }

        function initOdometer() {

          totalMiles = Math.round(chosen.totalDistance);

          d3.select("#odometer").append("span")
            .attr("id","current-miles")
            .classed("flex-child txt-s txt-m-mxl txt-mono",true)
            .text("0")

          d3.select("#odometer").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl",true)
            .html(`of ${totalMiles} miles<br> elapsed`)

        }

        function initSpeedometer() {

          d3.select("#speedometer").append("span")
            .attr("id","current-pace")
            .classed("flex-child txt-s txt-m-mxl txt-mono",true)
            .text(getPace())

          d3.select("#speedometer").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl",true)
            .html(`milliseconds<br> per mile`)

        }

        function initCompass() {

          d3.select("#compass").append("span")
            .attr("id","current-bearing")
            .classed("flex-child txt-s txt-m-mxl txt-mono",true)
            .text(getAzimuth(0))

          d3.select("#compass").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl",true)
            .text("degrees")

        }

        // chosen.totalTime
        // chosen.overallBearing
        // stopping in [...new Set(chosen.allStops.map(d=>d.shortName))] where name is not from/to

        // NARRATION
        // remove placeholder text from #encounters
        d3.select("#encounters").selectAll(".placeholder")
          .remove()

        // JOURNEY LOG

      }

      function setupEnrichLayer() {

        // enrich content groups
        const enrichLayer = g.append("g").attr("id","enrich-layer");

        enrichLayer.append("g").attr("id","enrich-polygons")
        enrichLayer.append("g").attr("id","enrich-lines")
        enrichLayer.append("g").attr("id","enrich-pts")

        enrichLayer.append("g").attr("id", "label-nodes")

      }

      function drawRoute(received,t) {

        d3.select("#map-init-load").transition()
          .delay(t/2)
          .duration(t/2 - 200)
          .style("opacity", 0)
          .on("end", function() {
            d3.select(this).classed("none", true)
          })

        // draw faint stroke along returned route
        var journey = g.append("g")
          .attr("id", "journey")

        var places = journey.append("g")
          .attr("id", "places")

        var route = journey.append("g")
          .attr("id", "route")

        // fade background railways
        g.select("#railways").transition().delay(t/2).duration(t/2)
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
            .attr("r", 0)
            .attr("cx", d => { return projection([d.lng,d.lat])[0]; })
            .attr("cy", d => { return projection([d.lng,d.lat])[1]; })
            .style("fill","salmon")
            .style("stroke","darksalmon")
            .style("stroke-width",0.1)

        // remove non-chosen station points
        let allStns = g.select("#rail-stations").selectAll("circle");
        allStns.transition().duration(t)
            .attr("r", 0)
            .on("start", () => {
              relevantStns.transition().duration(t)
                .attr("r", 0.4)
            })
            .on("end", () => {
              allStns.data([]);
              relevantStns.merge(allStns);
              allStns.remove();
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
          .style("stroke", "#333") // fiddle/improve
          .style("stroke-width", 0.3)
          .style("opacity",0)
          .style("stroke-dasharray", "0.8 1.6")
          // .style("stroke-linecap", "round")

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
        let azimuth0 = getRotate(semiSimp.geometry.coordinates[0],semiSimp.geometry.coordinates[1]),
            radians0 = 0,            // start with unrotated arc
                 tau = 2 * Math.PI,  // 100% of a circle
             arcSpan = 0.16 * tau,   // hardcode as desired (in radians)
             sector0 = getSector(radians0,arcSpan,headlightRadius);

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
          .style("stroke-dasharray","0.05 0.1")
          .attr("transform", "translate(" + arcPts[0] + ")")

        // UNDERLYING TICKS/TIES
        let rrTies = route.append("g")
          .attr("id","rr-ties")
          .append("path")
          .attr("d", line(arcPts))
          .style("fill", "none")
          .style("stroke","gainsboro")
          .style("stroke-width",0.6)
          .style("stroke-dasharray", "0.1 0.2")

        // // SIMP TICKS
        // let simpTicks = route.append("g")
        //   .attr("id","simp-ticks")
        //   .append("path")
        //   .attr("d", line(simpCoords))
        //   .style("fill", "none")
        //   .style("stroke", "cyan")
        //   .style("stroke-width",1.6)
        //   .style("stroke-dasharray", "0.1 0.4")

        // // MM TEST
        // let milemarkers = route.append("g").selectAll(".mm")
        //   .attr("id","milemarkers")
        //   .data(received.geoMM) // geoMM
        //   .enter().append("circle")
        //     .classed("mm",true)
        //     .attr("r", 0.05)
        //     .attr("cx", d => { return projection(d)[0]; })
        //     .attr("cy", d => { return projection(d)[1]; })
        //     .style("fill", "darkmagenta")
        //     .style("stroke","gainsboro")
        //     .style("stroke-width",0.005)

      }

    }

    function prepareUser() {
      // provide feedback via overview of selected route
      // introduce dashboard and journey log
      // prompt for readiness or provide countdown?

      // e.g. 'You have chosen to travel from {ptA} to {ptB} on {railCompany}'s {lineName} line. IRL, this route would take you about {travelTime} to complete, but we are going to move a little more quickly. Keep your eye on the dashboard and journey log for more details as the journey unfolds in {countdown?... until data loads?}'
    }

  }

  function initAnimation(routeObj,routeBoundsIdentity) {

    // get zoomFollow object including simplified zoomArc, pace, and first/last zoom frames
    let zoomFollow = getZoomFollow();

    // bind zoomArc to DOM for tracking only (not visible)
    let zoomArc = g.append("path")
      .attr("id", "zoom-arc")
      .datum(zoomFollow.arc.map(d => projection(d)))
      .attr("d", line)
      .style("fill","none")
      // toggle below for visual of zoomArc
      // .style("stroke","none")
      // .style("stroke", "rebeccapurple")
      // .style("stroke-width",1)

    // final user prompt/countdown??
    // if (confirm("Ready?")) {
      experience.animating = true;  // global flag that experience == in process
      goTrain(zoomFollow,zoomArc,routeBoundsIdentity,routeObj.totalDistance); // initiate movement!
    // }

    function getZoomFollow() { // requires access to routeObj

      let zoomFollow = {
        necessary: true, // default
        focus: viewFocusInt,
        limit: viewFocusInt * 2,
        scale: zoomFollowScale,
        arc: [],
        firstThree: [],
        lastThree: [],
        // get tpsm() {  // based on tpm, calculated per simplified miles
        //   return tpm * Math.round(routeObj.totalDistance) / this.simpLength;
        // },
        simpSlice: [],
        fullSimp: getSimpRoute(routeObj.lineString),
        get simpLength() { return Math.round(turf.length(this.fullSimp, {units: "miles"})); }
      }

      if (zoomFollow.simpLength > zoomFollow.limit) {

        let firstLast = getFirstLast(zoomFollow.fullSimp,zoomFollow.focus);

        zoomFollow.firstThree = firstLast[0],
         zoomFollow.lastThree = firstLast[1],
         zoomFollow.simpSlice = turf.lineSlice(zoomFollow.firstThree[1],zoomFollow.lastThree[1],zoomFollow.fullSimp).geometry.coordinates;

        // update firstLast with exact in/out focus coordinates (prevents stutter at moment of zoomAlong "takeoff")
        zoomFollow.firstThree[1] = zoomFollow.simpSlice[0],
         zoomFollow.lastThree[1] = zoomFollow.simpSlice[zoomFollow.simpSlice.length-1];

        zoomFollow.arc = zoomFollow.simpSlice;

      } else {

        // short route, first/last frames identical; no zoomAlong necessary

        zoomFollow.necessary = false,
        zoomFollow.arc = zoomFollow.fullSimp.geometry.coordinates.slice();

        // save start, mid, and end points as onlyThree
        let onlyThree = [zoomFollow.fullSimp.geometry.coordinates[0],turf.along(zoomFollow.fullSimp,zoomFollow.simpLength/2,{ units: "miles" }).geometry.coordinates.map(d => +d.toFixed(2)),zoomFollow.fullSimp.geometry.coordinates[zoomFollow.fullSimp.geometry.coordinates.length - 1]];

        zoomFollow.firstThree = onlyThree,
         zoomFollow.lastThree = onlyThree;

      }

      return zoomFollow;

      function getFirstLast(fullLine,focusInt = 100) {

        // turf.js returning same three coordinates at distance minus int * 2, distance minus int, & distance; reversing instead
        let fullLineReversed = turf.lineString(fullLine.geometry.coordinates.slice().reverse());

        let firstThree = threePts(fullLine,focusInt),
             lastThree = threePts(fullLineReversed,focusInt).reverse();

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

  function goTrain(zoomFollow,zoomArc,routeBoundsIdentity,fullDist) {

    let t = 0,
      tFull = Math.max(tpm * fullDist, tPause),
      tDelay, tMid, firstIdentity, lastIdentity;

    // let simpDistance = Math.round(turf.length(zoomFollow.fullSimp, {units: "miles"})),
    //   tFull = Math.max(tpm * simpDistance, tPause);  // based on ms per simplified mile so tDelay calculation is accurate; NOT DOING SO, ZOOMFOLLOW OCCASSIONALLY OVERSHOOTS DESTINATION

    // console.log("tfull",tFull)
    // console.log("tpsm",zoomFollow.tpsm)
    // console.log("wouldbe",Math.max(zoomFollow.tpsm * simpDistance, tPause))

    let headlights = g.select("#headlights"),
          semiSimp = g.select("#semi-simp"),
             point = g.select("#train-point"),
          fullPath = g.select("#full-route"),
          azimuth0 = headlights.property("azimuth0");

    if (zoomFollow.necessary) {  // calculate transforms and timing from firstFrame to lastFrame

      firstIdentity = getIdentity(centerTransform(projection(zoomFollow.firstThree[1]),zoomFollowScale,zoomAlongOptions))

      lastIdentity = getIdentity(centerTransform(projection(zoomFollow.lastThree[1]),zoomFollowScale,zoomAlongOptions))

      t = zoomDuration,
      tDelay = (fullDist > zoomFollow.limit) ? tpm * zoomFollow.focus : tpm * 0,      // delay zoomFollow until train hits mm <zoomFollow.focus> IF route long enough; NOTE: WAS simpDistance
      tMid = tFull - (tDelay*2);  // tDelay doubled to account for stopping <zoomFollow.focus> miles from end

    } else {
      firstIdentity = routeBoundsIdentity,
       lastIdentity = routeBoundsIdentity;
    }

    // coordinate zoom to first frame, turning on headlights, dimming background, expanding dash, and ultimately (for real!) initiating train and route animation
    svg.transition().duration(t).ease(zoomEase)
      .call(zoom.transform, firstIdentity)
      .on("start", () => {
        // dim background layers
        dimBackground(t/2)
        // turn on headlights
        headlights.transition().delay(t/2).duration(t/2).style("opacity",0.6)
        // expand dash automatically
        expand("dash","up")
        // disable free zooming
        svg.on('.zoom',null)
      })
      .on("end", () => {
        // confirm g exactly in alignment for next transition
        g.attr("transform",firstIdentity.toString())
        // call initial point transition, passing simplified path
        goOnNow(zoomArc,zoomFollow.scale,lastIdentity)
      })

    function dimBackground(t) {

      let toDim = [d3.select("#admin-base"),d3.select("#hydro-base"),d3.select("#urban-base"),d3.select("#rail-base")];

      toDim.forEach(selection => {
        let currentOpacity = selection.style("opacity")
        selection.transition().duration(t)
          .style("opacity", currentOpacity * relativeDim)
        });

    }

    function goOnNow(simpPath,scale,lastIdentity) {
      dispatch.call("depart", this)
      // transition train along entire route
    	point.transition().delay(tPause).duration(tFull).ease(d3.easeSinInOut)
  		  .attrTween("transform", translateAlong(fullPath))
        // point transition triggers additional elements
        .on("start", () => {
          // kick off global timer!
          timer = d3.timer(animate)
          // keep headlights on, simulating search for triggerPts
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
          // inform d3 zoom behavior of final transform value
          svg.call(zoom.transform, lastIdentity)
          // reenable free zooming
          svg.call(zoom)
        });
    }

    function animate(elapsed) {
      // dispatch another move event
      dispatch.call("move", point)
      trackerUpdate(getMM(elapsed))
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
  d3.select("#about-down").on("click", function() {
    d3.select(this).classed("manual-close",true);
  })

  // setup event listener on modal open
  d3.select(window).on("dblclick", function() {
    // if modal is open and click target is NOT within modal
    if (!(d3.select("#modal").classed("none")) && !d3.event.target.closest("#modal")) {
      toggleModal()  // toggle close
    }
  })

  // Custom Buttons
  // d3.select("#play-pause").on("click", remoteControl.playPause(e))

// LOAD EVENTS
  d3.select(window).on("load", function () {
    // if (!('optionsReceived' in localStorage)) {
      initPrompt()
    // }
  });
  // d3.select(window).on("reload", *)

// RESIZE EVENTS
  d3.select(window).on("resize.map", resize)
  d3.select("#about-expand").on("click", resize)
  d3.select("#about-collapse").on("click", resize)

// FORMS & FIELDS
  d3.select("#get-options").on("focus", function (e) { e.target.style.background = "palegoldenrod" })
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

  function calcSize() {

    let calculated = {};

    // if screen mxl, account for #aside on right vs bottom
    if (window.innerWidth >= 1200) {

      if (!d3.select("#aside").classed("mxl")) {

        // if #aside wasn't previously flagged (either entering @mxl screen or first resize on initial load @ mxl), flag as such now
        d3.select("#aside").classed("mxl", true)

        // if #about was hidden on smaller window size
        if (d3.select("#about").classed("disappear-down")) {
          // change disappear-direction for aligment in case of reopen
          d3.select("#about").classed("disappear-right",true)
                             .classed("disappear-down",false)
          // make sure section-wrapper not "relative"
          d3.select("#section-wrapper").classed("relative",false)
          // adjust dash padding so long as #about collapsed on mxl
          d3.select("#dash-content").classed("mx30-mxl",true)
          // if #about was *manually* hidden on smaller window
          if (d3.select("#about").classed("manual-close")) {
            // keep collapsed; do nothing
          } else if (d3.select("#modal-about").classed("none")) {
            // if #about not manually closed && modal-about not open
            expand("about","left");
          }
        }

      }

      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#footer").node().clientHeight,  //  - marginY*2,

      calculated.width = window.innerWidth - d3.select("#aside").node().clientWidth;  // - marginX*2;

      // update #about-wrapper to align with full map height
      d3.select("#about-wrapper").style("height", calculated.height + "px");

    } else {  // < 1200

      // if screen sizing downward from 1200+
      if (d3.select("#aside").classed("mxl")) {
        // remove mxl flag, then reset a variety of styles
        (d3.select("#aside").classed("mxl", false))
        // reset #about-wrapper height
        d3.select("#about-wrapper").style("height", null);
        // if #about was manually collapsed on screen mxl
        if (d3.select("#about").classed("disappear-right")) {
          // // *keep* #about collapsed, but change class to disappear-down so transitions/placement correct if #about re-expanded from smaller window position
          d3.select("#about").classed("disappear-down",true)
                             .classed("disappear-right",false)
          // replace previously-removed "relative" class in #section-wrapper
          d3.select("#section-wrapper").classed("relative", true);
          // reset dash and attribution margins
          d3.select("#attribution").classed("mr24-mxl", false)
          d3.select("#dash-content").classed("mx30-mxl",false)
        }
        // collapse #about (regardless of whether collapsed on mxl; too jarring to have it open upon return to smaller screen)
        d3.select("#about").classed("disappear-right", false)
        collapse("about", "down")
      }

      // if window too short to show #about content, collapse automatically
      if (window.innerHeight < 500) collapse("about","down");

      // map height calculation includes #aside
      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#aside").node().clientHeight - d3.select("#footer").node().clientHeight // - marginY*2;

      calculated.width = d3.select("#about-plus").node().clientWidth

    }

    return calculated;

  }

  function collapseDirection(width) {
    return (width > 1200) ? "right" : "down";
  }

//// PROJECTIONS & PATHS


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

  function emptyFeatureCollection() {
    return {
      "type": "FeatureCollection",
      "features": []
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

  // function getBoundsFromTransform(transform,extent = extent0) { // functionality questionable
  //
  //   let width = extent[1][0] - extent[0][0],  // range x
  //      height = extent[1][1] - extent[0][1];  // range y
  //
  //   let x = (width - transform.x * 2)/transform.k,
  //       y = (height - transform.y * 2)/transform.k
  //
  //   let b0 = [x, y],
  //       b1 = [x+width, y+height];
  //
  //   return [b0,b1];
  //
  // }

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

    var transform = d3.zoomTransform(this);

    let k = transform.k,
       tx = transform.x,
       ty = transform.y;

    g.style("stroke-width", 1 / (k*k) + "px");

    g.attr("transform", "translate(" + tx + "," + ty + ") scale(" + k + ")");

  }

  function getTransform(bounds, options) {

    options = {...defaultOptions, ...options};

    let b0,b1;

    // accept bbox, projPath.bounds(), or SVG bbox
    if (bounds.length === 4) {
      b0 = [bounds[0],bounds[1]],
      b1 = [bounds[2],bounds[3]]
    } else {
      b0 = bounds[0] || [bounds.x,bounds.y],
      b1 = bounds[1] || [bounds.width,bounds.height]
    }

    // account for padding
    b0[0] -= options.padLeft,
    b0[1] -= options.padTop,
    b1[0] += options.padRight,
    b1[1] += options.padBottom;

    let dx = b1[0] - b0[0],  // domain x (input)
        dy = b1[1] - b0[1],  // domain y (input)
     width = options.extent[1][0] - options.extent[0][0],  // range x (output)
    height = options.extent[1][1] - options.extent[0][1];  // range y (output)

    let k = (1 - options.scalePad) / Math.max(dx / width, dy / height),  // Math.max() determines which dimension will serve as best anchor to provide closest view of this data while maintaining aspect ratio
        x = b1[0] + b0[0], // xMax (b1[0]) + xOffset (b0[0])
        y = b1[1] + b0[1]; // yMax (b1[1]) + yOffset (b0[1])

    // calculate translate necessary to center data within extent
    let tx = (width - k * x) / 2,
        ty = (height - k * y) / 2;

    let transform = { k: k, x: tx, y: ty };

    return transform;

  }

  function getIdentity(atTransform,k) {
    let identity = d3.zoomIdentity
      .translate(atTransform.x,atTransform.y)
      .scale(k || atTransform.k)
    return identity;
  }

  // returns transform centering point at predetermined scale
  function centerTransform(pt,scale,options) {

    options = {...defaultOptions, ...options}  // overkill, but simplest

    pt[0] = pt[0] + options.padRight - options.padLeft
    pt[1] = pt[1] + options.padBottom - options.padTop

    let tx = -scale * pt[0] + initial.width/2,
        ty = -scale * pt[1] + initial.height/2;

    return {x: tx, y: ty, k: scale};

  }

  function resetZoom() {

    active.classed("active", false);
    active = d3.select(null);

    svg.transition().duration(zoomDuration/4) // .ease(d3.easeLinear)
      .call(zoom.transform, zoom0)

  }

//// QUADTREE / DATA / INTERSECT QUERIES

  function makeQuadtree(data,options) {
    // search and nodes functions taken from https://bl.ocks.org/mbostock/4343214
    // make latter 3 options object with defaults: data, projection of data coords

    options = {...quadtreeDefaultOpts,...options};

    // get projected bounding box of passed geoJSON
    let pathBox = projPath.bounds(options.bounding),
             x0 = pathBox[0][0], // xmin
             y0 = pathBox[0][1], // ymin
             x1 = pathBox[1][0], // xmax
             y1 = pathBox[1][1]; // ymax

    // initiate quadtree with specified x and y functions
    let quadtree = d3.quadtree(data,options.projectX,options.projectY)
      .extent([[x0, y0], [x1, y1]])

    return quadtree;
  }

  function visualizeGrid(quadtree) {

    ///// QUADTREE / TRIGGER NODES ADDED TO DOM
    let grid = g.append("g")
                .classed("quadtree", true)

    grid.selectAll(".quadnode")
        .data(nodes(quadtree))
        .enter().append("rect")
          .classed("quadnode", true)
          .attr("x", function(d) { return d.x0; })
          .attr("y", function(d) { return d.y0; })
          .attr("width", function(d) { return d.y1 - d.y0; })
          .attr("height", function(d) { return d.x1 - d.x0; })
          .style("fill", chroma.random())
          .style("stroke", "whitesmoke")
          .style("stroke-width", "0.4px")
          .style("opacity", 0.3)

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

  }

  function bindQuadtreeData(quadtree,triggerPtFlag = false) {

    // data should all be points, whether representative of larger polygons/lines or otherwise

    let quadtreeData = g.append("g")
      .classed("quadtree-data", true)

    quadtreeData.selectAll(".quad-datum")
      .data(quadtree.data())
      .enter().append("circle")
        .attr("class", d => { return "quad-datum " + d.properties.id})
        .attr("cx", d => quadtree._x(d))
        .attr("cy", d => quadtree._y(d))
        .attr("r", 0.2)
        // .property("feature_id", d => { return d.properties.id; })
        // .property("name", d => { return d.properties.name || d.properties.NAME; })
        // .property("category", d => { return d.properties.CATEGORY; })
        .style("fill","none")  // COMMENT THIS OUT TO VISUALIZE
        .style("stroke","none")  // COMMENT THIS OUT TO VISUALIZE
        // .on("mouseover", onMouseover)
        // .on("mouseout", onMouseout)

    if (triggerPtFlag) {
      quadtreeData.selectAll(".quad-datum").nodes().forEach(d => {
        d3.select(d).classed("trigger-pt",true)
      })
    }

  }

  function searchQuadtree(quadtree, x0, y0, x3, y3) {

    let selected = [];

    quadtree.visit(function(node, x1, y1, x2, y2) {

      if (!node.length) { // if node is not an array of nodes (i.e. has point content)

        do {

          let d = node.data,
             d0 = quadtree._x(d),
             d1 = quadtree._y(d)

          // for visualization purposes only
          g.selectAll(".quadtree-data").selectAll(`.quad-datum.${d.properties.id}`).classed("quad-datum--scanned",true)

          d.selected = (d0 >= x0) && (d0 < x3) && (d1 >= y0) && (d1 < y3);

          if (d.selected) {

            // for visualization purposes only
            g.selectAll(".quadtree-data").selectAll(`.quad-datum.${d.properties.id}`).classed("quad-datum--selected",true)

            // for flagged, en route trigger-pts only
            if ((g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).node()) && (g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).classed("trigger-pt"))) {

              if (!uniqueEncounters.has(d.properties.id)) {
                uniqueEncounters.add(d.properties.id)
                dispatch.call("encounter", d)
                // slightly faster than external mutationObserver watching for class changes, though that may be a cleaner structure overall
              }

            }

            selected.push(d)

            // immediately remove triggerPt and all others associated with same feature ID from remaining search pool to avoid wasting energy on retriggers
            let toRemove = quadtree.data().filter(q => {
              return q.properties.id === d.properties.id;
            })
            quadtree.removeAll(toRemove)

          }

        } while (node = node.next);

      }

      return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;

    });

    return selected;

  }

  function padExtent(extent, padX = headlightRadius/2, padY = padX) {
    return [[extent[0][0] - padX, extent[0][1] - padY], [extent[1][0] + padX, extent[1][1] + padY]];
  }

//// ANIMATION

  function trainMoved() { // called by animate() following dispatch

    let trainTransform = this.node().transform.animVal[0].matrix,
            headlights = g.select("#headlights"),
       currentLocation = [trainTransform.e, trainTransform.f],
         currentRotate = headlights.node().transform.animVal[1].angle,
      currentTransform = "translate(" + currentLocation[0] + "," + currentLocation[1] + ") rotate(" + currentRotate + ")";

    if (!searchExtent) {  // first time only

      let sectorBBox = headlights.node().getBBox(),
            arcWidth = sectorBBox.width,
           arcHeight = sectorBBox.height; // ADJUSTABLE FOR NON-VISIBLE EXTENSION OF SEARCH EXTENT

      let sectorExtent = [[-arcWidth/2,-arcHeight],[arcWidth/2,0]];

      // CALCULATE SEARCH EXTENT FOR QUADTREE
      let translatedExtent = translateExtent(sectorExtent,currentLocation[0],currentLocation[1]);

      // searchExtent is translatedThenRotated
      searchExtent = rotateExtent(translatedExtent,currentRotate);

      // console.log(searchExtent[0],searchExtent[1])

      // // TEMPORARY SEARCH/HEADLIGHT EXTENT VISUALIZATIONS
      // let tempVis = g.select("#route").append("rect")
      //   .datum(searchExtent)
      //   .attr("x", d => { return d[0][0]; })
      //   .attr("y", d => { return d[0][1]; })
      //   .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
      //   .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
      //   .style("fill",chroma.random())
      //   .style("stroke","whitesmoke")
      //   .style("stroke-width","0.3px")
      //   .style("opacity",0.4)
      // d3.timeout(() => {
      //   tempVis.transition().duration(600)
      //          .style("opacity",0)
      //          .on("end", () => {
      //            tempVis.classed("none",true)
      //            tempVis.remove()
      //          })
      // }, 600);

      // upon train arrival, schedule fade/remove of headlights + each extentVis node
      dispatch.on("arrive", () => {
        headlights.transition().duration(tPause)
                  .style("opacity",0)
                  .on("end", () => {
                    headlights.classed("none",true)
                    headlights.remove()
                  })
      })

      headlights.raise() // keep headlights on top of any extent visualizations

      this.raise(); // keep train on top of extentVis

    } else {  // get adjusted transformString (for visualizations) and searchExtent (for quadtree searches) on each trainMove

      let dx = currentLocation[0] - prevLocation[0],
          dy = currentLocation[1] - prevLocation[1],
          tx = currentLocation[0] + dx,
          ty = currentLocation[1] + dy;

      // CALCULATE SEARCH EXTENT FOR QUADTREE
      let translatedExtent = translateExtent(prevExtent,dx,dy),
               rotateDelta = currentRotate - prevRotate;

      // searchExtent is translatedThenRotated
        // rotatedThenTranslated also works for this portion, but keeping TTR for consistency with initial positioning
      searchExtent = rotateExtent(translatedExtent,rotateDelta);

      // console.log(searchExtent[0],searchExtent[1])

      // // TEMPORARY SEARCH/HEADLIGHT EXTENT VISUALIZATIONS
      // let tempVis = g.select("#route").append("rect")
      //   .datum(searchExtent)
      //   .attr("x", d => { return d[0][0]; })
      //   .attr("y", d => { return d[0][1]; })
      //   .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
      //   .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
      //   .style("fill",chroma.random())
      //   .style("stroke","whitesmoke")
      //   .style("stroke-width","0.3px")
      //   .style("opacity",0.4)
      // d3.timeout(() => {
      //   tempVis.transition().duration(600)
      //          .style("opacity",0)
      //          .on("end", () => {
      //            tempVis.classed("none",true)
      //            tempVis.remove()
      //          })
      // }, 600);

    }

    // initiate quadtree search
    // let newlySelected =
    searchQuadtree(routeQuadtree, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1]);

    // save newly determined values as previous values
    prevLocation = currentLocation,
      prevExtent = searchExtent,
      prevRotate = currentRotate;

    function translateExtent(extent,dx,dy) {
      return extent.map(d => { return [d[0]+dx, d[1]+dy] });
    }

    function rotateExtent(extent,degrees) {

      let angle = turf.degreesToRadians(degrees),
          width = extent[1][0]-extent[0][0],
         height = Math.abs(extent[1][1]-extent[0][1]),
          midPt = [extent[0][0]+width/2,extent[0][1]+height/2];

      let point = midPt,
          pivot = currentLocation;
      let rotatedPt = rotatePt(point,angle,pivot);

      // get differences relative to midPt
      let deltaX = rotatedPt[0]-point[0],
          deltaY = rotatedPt[1]-point[1];

      // adjust extent pts accordingly
      let rotatedExtent = extent.map(d => { return [d[0]+deltaX,d[1]+deltaY] });

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

  }

  function departed() {
    console.log("train departing @ " + performance.now())
    d3.timerFlush() // necessary?
  }

  function arrived() {
    console.log("train arrived @ " + performance.now())
    timer.stop()
    d3.select("#current-miles").text(totalMiles)
    // observer.disconnect()
    console.log("unique encounters",uniqueEncounters.size)
  }

//// TRANSITIONS AND TWEENS

  function tweenDash() {
    var l = this.getTotalLength(),
        i = d3.interpolateString("0," + l, l + "," + l);
    return function(t) { return i(t); };
  }

  function drawDashed() {
    var l = this.getTotalLength();
    var i = d3.interpolateString(-l,"0");
    return function(t) { return i(t); };
  }

  // TRANSLATE ONLY
  function zoomAlong(path,k = zoomFollowScale) {
    var l = path.node().getTotalLength();
    return function(d, i, a) {
      return function(t) {
        // KEEP NODE P IN CENTER OF FRAME
        var p = path.node().getPointAtLength(t * l);
        // calculate translate necessary to center data within extent
        let centered = centerTransform([p.x,p.y],k,zoomAlongOptions)
        return "translate(" + centered.x + "," + centered.y + ") scale(" + centered.k + ")";
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

  function getDashStr(length,dash = "0.1 0.4") {

    dash = dash.split(",").join(""); // standardize, in case passed dash includes commas

    let dashSum = dash.split(" ").map(x => +x)
                     .reduce((accumulator, currentVal) =>
                       accumulator + currentVal, 0
                     ),
      dashTimes = Math.ceil(length/dashSum),
       dashFill = new Array(dashTimes + 1).join(dash + ' '),
        dashStr = dashFill + ", " + length;

    return dashStr;

  }

//// REVEAL ENCOUNTERED

  function encountered() {

    let id = this.properties.id,
      baseT;

    if (id.startsWith('pt')) {

      baseT = this.properties.SNAP_DISTANCE;
      revealPt(this,baseT)

    } else {

      let triggerPt = [this.properties.trigger_x,this.properties.trigger_y],
        allCoords = turf.coordAll(this.geometry),
        i0 = turf.nearestPointOnLine(turf.lineString(allCoords),triggerPt),
        index0 = i0.properties.index,
        gjA,
        gjB;

      if (["River","River (Intermittent)"].includes(this.properties.CATEGORY)) {

        // store first and last points of flattened line geometry
        let index1A = 0,
            index1B = allCoords.length-1;
        let i1A = turf.point(allCoords[index1A]),
            i1B = turf.point(allCoords[index1B]);

        if (turf.distance(i0,i1A,{units:"miles"}) < 100) {

          // call it good, don't break enrichLine down into smaller features
          baseT = turf.length(this.geometry,{units:"miles"})
          revealLine(this,baseT)

        } else if (turf.distance(i0,i1B,{units:"miles"}) < 100) {

          // triggerPt is very close to the end of the line as written; reverse coords so that it animates outward(-ish) from route
          let reversed;

          if (this.geometry.type === "MultiLineString") {

            reversed = turf.multiLineString(reverseNested(this.geometry.coordinates), this.properties)

          } else {

            reversed = turf.lineString(this.geometry.coordinates.reverse(), this.properties)

          }

          baseT = turf.length(reversed,{units:"miles"})
          revealLine(reversed,baseT)

        } else {

          if (this.geometry.type === "MultiLineString") {
            let split = splitMultiString(triggerPt,this);
            gjA = turf.multiLineString(split[0]),
            gjB = turf.multiLineString(reverseNested(split[1]));
          } else {
            gjA = turf.lineString(allCoords.slice(index1A,index0+1).reverse()),
            gjB = turf.lineString(allCoords.slice(index0));
          }

        }

      } else {  // polygon or watershed

        let index1 = getIndex1(index0,allCoords.length),
          i1 = turf.point(allCoords[index1])

        if (id.startsWith("py")) {

          let centroid = turf.centroid(this.geometry)

          // let spine = turf.lineString([i0,i1])
          let spine = turf.lineString([i0,centroid,i1].map(d=>d.geometry.coordinates)),
               area = turf.convertArea(turf.area(this.geometry),"meters","miles");

          baseT = turf.round(Math.sqrt(Math.sqrt(area)))
          revealPolygon(this,spine,baseT)

        } else {

          // shift line geometry to start (and end) at i0
          if (this.geometry.type === "MultiLineString") {

            let split = splitMultiString(triggerPt,this);

            gjA = turf.multiLineString(split[0]),
            gjB = turf.multiLineString(reverseNested(split[1]));

          } else {  // singlepart geometry

            if (index0 < index1) {

              gjA = turf.lineString(allCoords.slice(index0,index1+1)),
              gjB = turf.lineString(allCoords.slice(index1).concat(allCoords.slice(0,index0+1)).reverse());

            } else {  // index1 < index0

              gjA = turf.lineString(allCoords.slice(index1,index0+1)),
              gjB = turf.lineString(allCoords.slice(index0).concat(allCoords.slice(0,index1+1)).reverse());

            }

          }

        }

      }

      if (gjA && gjB) { // if not, reveal should have already started

        let origId = id.slice(),
           lengthA = turf.length(gjA, {units:"miles"}),
           lengthB = turf.length(gjB, {units:"miles"}),
             baseT = [lengthA,lengthB];

        gjA.properties = {...this.properties}
        gjB.properties = {...this.properties,...{oid: origId, id: origId + "-2"}}

        if (gjA.geometry.coordinates.length) revealLine(gjA,baseT[0]);
        if (gjB.geometry.coordinates.length) revealLine(gjB,baseT[1]);

      }

    }

  }

  function splitMultiString(triggerPt,d) {  // triggerPt == coords only

    let i0 = turf.nearestPointOnLine(d,turf.point(triggerPt)),
        index = i0.properties.index,
        halfOne = [],
        halfTwo = [],
        shiftPtFound = false;

    d.geometry.coordinates.forEach(arr => {
      if (arr[index] && turf.nearestPointOnLine(turf.lineString(arr),arr[index]).properties.index === index) {
        shiftPtFound = true;
        halfOne.push(arr.slice(index));
        halfTwo.push(arr.slice(0,index+1));
      } else if (shiftPtFound) {
        halfOne.push(arr);
      } else {
        halfTwo.push(arr);
      }
    })

    return [halfOne,halfTwo]; // concat to shift multiLineString geometries such that line simply starts (and, if closed line, ends) at i0

  }

  // function sliceMultiString(pt0,pt1,d) {
  //
  //   let seekingPt0 = true, seekingPt1 = true, slice = [];
  //   iterateOver(d.geometry.coordinates)
  //
  //   if (!seekingPt0 && !seekingPt1) {
  //     return slice; // coords only
  //   }
  //
  //   function iterateOver(iterable){
  //     iterable.forEach(arr => {
  //       let found = seekPts(arr);
  //       if (found && found.length) {
  //         slice.push(found);
  //       } else if (!found && !seekingPt0) {
  //         slice.push(arr); // add whole chunk, must be between pt0 and pt1
  //       }
  //     })
  //   }
  //
  //   function seekPts(arr) {
  //
  //     if (Array.isArray(arr[0][0])) iterateOver(arr[0]); // dive deeper if necessary
  //
  //     let i0 = (seekingPt0) ? arr.findIndex(coordMatch,pt0) : null,
  //         i1 = (seekingPt1) ? arr.findIndex(coordMatch,pt1) : null;
  //
  //     if (i0 && !i1) {   // this array marks location of pt0
  //       seekingPt0 = false;
  //       return arr.slice(i0)
  //     }
  //     if (!seekingPt0 && i1) {
  //       seekingPt1 = false;
  //       return arr.slice(0,i1+1)
  //     }
  //     if (i0 && i1) {   // both pts found within same array
  //       seekingPt0 = false;
  //       seekingPt1 = false;
  //       return arr.slice(i0,i1+1);
  //     }
  //
  //     function coordMatch([x,y]) {
  //       return x === this.geometry.coordinates[0] && y === this.geometry.coordinates[1];
  //     }
  //
  //   }
  //
  // }

  function revealPt(gj,baseT) {

    let t = Math.max(minT,baseT * tpm);

    encounteredPts.add(gj)
    let sortedPts = [...encounteredPts].sort((a,b) => {
      return b.properties.orig_area - a.properties.orig_area;
    })

    let ptOpacity = 0.6,
      ptStrokeOpacity = 0.6;

    // update pts as group to allow for additional transitions on updating pts
    d3.select("#enrich-pts").selectAll(".enrich-pt")
      .data(sortedPts, d => d.properties.id)
      .order()
      .join(
        enter => enter.append("circle")
          .classed("enrich-pt", true)
          .attr("r", 0)
          .attr("cx", d => projection(d.geometry.coordinates)[0])
          .attr("cy", d => projection(d.geometry.coordinates)[1])
          .attr("id", d => d.properties.id)
          .property("name", d => d.properties.NAME)
          .property("category", d => d.properties.CATEGORY)
          .property("description", d => d.properties.DESCRIPTION)
          .property("more-info", d => d.properties.MORE_INFO)
          .property("baseT", d => d.properties.SNAP_DISTANCE)
          .property("orig-opacity", ptOpacity)
          .property("orig-stroke-opacity", ptStrokeOpacity)
          .style("fill", getFill)
          .style("stroke", "whitesmoke")
          .style("stroke-width", "0.05px")
          .style("opacity", 0)
          .style("stroke-opacity", 0)
          .call(enter => enter.transition(t)
            .attr("r", d => d.properties.orig_area * 0.00000002 || 0.1)
              // size of circle is a factor of planar (why did i do it this way?) area of polygon the circle is representing, or 0.1 minimum
            .style("opacity", 1)    // COMBAK: aim for initial glow effect
            .style("stroke-opacity", 1)
            .on("start", output(enter))
          ),
        update => update
          .call(update => update.transition(t)
            .style("opacity", ptOpacity)  // make more subtle
            .style("stroke-opacity", ptStrokeOpacity)
            .on("end", () =>
              update.on("mouseover", onMouseover)
                    .on("mouseout", onMouseout)
            )
          )
      )

  }

  function revealLine(gj,baseT) {

    let t = Math.max(minT,baseT * tpm),
      trans = d3.transition().duration(t).ease(d3.easeLinear)

    let lineOpacity = 0.8;

    // have to add these one at a time (rather than as a group join) to avoid recalculated dashArrays getting mixed up within group (esp as queue of entering elements get longer); ok because order of lines not essential for proper viewing
    let newLine = d3.select("#enrich-lines").append("path")
                    .datum(gj)
                    .classed("enrich-line",true)
                    .attr("d", projPath)
                    .attr("id", d => d.properties.id)
                    .property("name", d => d.properties.NAME)
                    .property("category", d => d.properties.CATEGORY)
                    .property("level", d => d.properties.LEVEL)
                    .property("orig-opacity", lineOpacity)
                    .property("orig-stroke-opacity", lineOpacity)
                    .style("fill", getFill)
                    .style("stroke", getStroke)
                    .style("stroke-width", getStrokeWidth)
                    .style("stroke-dasharray", "none")
                    .style("stroke-linecap", "round")
                    .style("opacity", lineOpacity)
                    .on("mouseover", onMouseover)
                    .on("mouseout", onMouseout)

    if (newLine.property("category") === "Watershed") {

      // reverse bound path to prepare for dashed line interpolation
      let initialPath = newLine.attr("d")
      newLine.attr("d",reverseSVGPath(initialPath))

      let initArray = "0.1 0.2 0.4 0.2",
        length = newLine.node().getTotalLength(),
        dashStr = getDashStr(length, initArray);
      newLine.style("stroke-dasharray", dashStr)
             .style("stroke-dashoffset", -length)

      newLine.transition(trans)
        .styleTween("stroke-dashoffset",drawDashed)

    } else {

      newLine.transition(trans)
        .styleTween("stroke-dasharray",tweenDash)

    }

    if (!gj.properties.id.includes("-")) {  // don't output partial geometries
      output(newLine)
    }

  }

  function revealPolygon(gj,spine,baseT) {

    let t = Math.max(minT,baseT * tpm),
      trans = d3.transition().duration(t).ease(d3.easeLinear) // queer yesss

    // update as group join to keep elements properly layered (bigger on bottom)
    encounteredPolys.add(gj)

    const byLevel = function(a,b) {
      return unromanize(a.properties.LEVEL) - unromanize(b.properties.LEVEL);
    }

    let ecoregions = [...encounteredPolys].filter(d => d.properties.LEVEL),
         remaining = [...encounteredPolys].filter(d => !d.properties.LEVEL)
    let sortedPolygons = ecoregions.sort(byLevel).concat(remaining);

    let polyOpacity = d => (d.properties.LEVEL) ? unromanize(d.properties.LEVEL) * 0.15 : 0.6,
      polyStrokeOpacity = 0;

    d3.select("#enrich-polygons").selectAll(".enrich-polygon")
      .data(sortedPolygons, d => d.properties.id)
      .order()  // is this an appropriate place to call this method?
      .join(
        enter => enter.append("path")
          .classed("enrich-polygon", true)
          .attr("d", projPath)
          .attr("id", d => d.properties.id)
          .property("name", d => d.properties.NAME)
          .property("category", d => d.properties.CATEGORY)
          .property("level", d => d.properties.LEVEL)
          .property("more-info", d => d.properties.MORE_INFO)
          .property("description", d => d.properties.DESCRIPTION)
          .property("orig-opacity", polyOpacity)
          .property("orig-stroke-opacity", polyStrokeOpacity)
          .style("fill", getFill)
          .style("stroke", getStroke)
          .style("stroke-width", getStrokeWidth)
          .style("stroke-opacity", polyStrokeOpacity)
          .style("opacity", 0)
          .call(enter => {
            enter.transition(trans)
              .style("opacity", polyOpacity)
            output(enter)
          })
          .on("mouseover", onMouseover)
          .on("mouseout", onMouseout)
        // update => update,
        // exit => exit.call(exit =>
        //   exit.transition(t)
        //     .style("opacity", 0)
        //     .on("end", () =>
        //       exit.remove()
        //     )
        // )
      )
      // .order()

    // SOON:
      // animate radial gradient outward from i0 -> i1
      // use line from i0 to i1 to determine baseT? and dictate direction of reveal

  }

  // baseT = Math.ceil(turf.length(turf.lineSlice(i0,i1,route),{units:"miles"}))

  // function getNestedIndex(multiGeom,pt) {
  //   let nested = {};
  //   multiGeom.geometry.coordinates.forEach((arr,i) => {
  //     if (arr.length >1) { // some end with a smattering of single points
  //       let line = turf.lineString(arr);
  //       if (turf.booleanPointOnLine(pt,line)) {
  //         nested.outer = i;
  //         nested.inner = turf.nearestPointOnLine(line,pt).properties.index;
  //         return nested;
  //       }
  //     }
  //   })
  // }

  function getIndex1(index0,length) {
    let limit = length - 1,
       index1 = index0 + Math.floor(length/2);
    if (index1 > limit) index1 -= limit;
    return index1;
  }

  function reverseNested(d) {
    let reversed = [];
    d.forEach(arr => {
      if (Array.isArray(arr[0][0])) {
        reversed.unshift(reversedNested(arr.slice()))
      } else {
        reversed.unshift(arr.slice().reverse())
      }
    })
    return reversed;
  }

  // function sliceMultiString(pt0,pt1,d) {
  //   let accumCoords = [],
  //       accumLength = 0;
  //   d.geometry.coordinates.forEach((arr,i) => {
  //     let slice = turf.lineSlice(pt0,pt1,turf.lineString(arr));
  //     if (slice.geometry.coordinates.length > 2) {
  //       accumCoords.push(slice.geometry.coordinates);
  //       accumLength += turf.length(turf.lineString(slice.geometry.coordinates),{units:"miles"});
  //     }
  //   })
  //   return {
  //     coords: accumCoords,
  //     length: accumLength
  //   }
  // }

//// OUTPUT AND ALERT incl DASHBOARD

  function output(encountered) {

    let darkText = "#333",
       lightText = "#ddd";

    if (encountered.property("name")) {

      allEncounters.unshift(encountered) // array of selections

      updateOutput(allEncounters.slice(0,maxOutput))

      // updateOutput(encountered)

      flashLabel(encountered)

      log(encountered)

      function updateOutput(allEncounters) {

        // https://observablehq.com/@d3/selection-join

        const t = d3.transition().duration(750);

        // HOW TO SMOOTH OUT SCROLL?
        d3.select("#encounters").selectAll(".encounter")
          .data(allEncounters, d => d.property("id"))
          .join(
            enter => enter.append("div")
              .classed("flex-child flex-child--no-shrink encounter txt-compact mx3 my3 px3 py3", true)
              .html(getHtml)
              .style("opacity", 1),
              // .call(enter => enter.transition(t)),
            update => update,
              // .call(update => update.transition(t)),
            exit => exit
              .call(exit => exit.transition(t)
                .style("opacity", 0))
              .remove()
          );

        // updateScroll(d3.select("#encounters").node())
        // function updateScroll(element) {
        //   element.scrollLeft = element.scrollWidth;
        // }
        // function getX(d) {
        //   return d.node().getBoundingClientRect().x;
        // }
        // function getY(d) {
        //   return d.node().getBoundingClientRect().y;
        // }

        // d3.select("#encounters").append("div")
        //   .datum(encountered)
        //   .classed("flex-child flex-child--no-shrink encounter mx3 my3 px3 py3", true)
        //   .html(getHtml)
        //   .style("opacity", 1)

      }

      function flashLabel(encountered) {

        // set the initial position of label to the feature's centroid
        let center = projPath.centroid(encountered.datum()),
             label = getName(encountered),
                id = encountered.attr("id"),
           newNode = {id: id, x0: Math.floor(center[0]), y0: Math.floor(center[1]), label: label};

        // add the centroids of each named feature to force simulation data structures
        labels.push(newNode);

        // update nodes list bound to force simulation
        labelLayout.nodes(labels)

        // bring each label into full opacity, pause, & remove
        const t = d3.transition().duration(1200);
        const anchorOpts = ["left","right"]

        // update all visible label nodes
        d3.select("#label-nodes").selectAll(".label-node")
          .data(labels, d => d.id)
          .join(
            enter => enter.append("text")
              .classed("label-node", true)
              .text(d => d.label)
              .attr("x", d => d.x0)
              .attr("y", d => d.y0)
              // .attr("r", 1)
              // .attr("cx", d => d.x0)
              // .attr("cy", d => d.y0)
              // .attr("width", d => d.label.length)
              // .attr("height", 1)
              .attr('text-anchor', d => anchorOpts[random(1)])  // could be based on L/R of route
              .style("fill", "whitesmoke")
              .style("opacity", 0) // initially
              .style("stroke", "dimgray")
              .style("stroke-width", "0.01px")
              .style("font-size","1px")
              .call(enter => enter.transition(t)
                .style("opacity", 1)
              ),
            update => update
              .call(update => update.transition(t)
                // .attr("x", d => d.x) // glitchy when updated here; leave to updatedLabelPositions() function
                // .attr("y", d => d.y)
                .style("stroke", "whitesmoke")
                .style("opacity", 0.6)
              )
            // exit called below
          )

          // schedule self-removal and cycle out old labels
          d3.timeout(() => {

            labels.splice(labels.findIndex(d => d.id === id),1)

            // update nodes list bound to force simulation
            labelLayout.nodes(labels)

            // call force simulation tick and dispatch associated callback function manually
            labelLayout.tick()
            dispatch.call("force")

            // exit and remove from SVG
            d3.select("#label-nodes").selectAll(".label-node")
              .data(labels, d => d.id)
              .exit().call(exit => exit.transition(t)
                .style("opacity", 0)
                .on("end", function() {
                  exit.remove()
                })
              )

          }, 2400)

        // call force simulation tick and dispatch associated callback function manually
        labelLayout.tick()
        dispatch.call("force")

      }

      function log(encounter) {

        // // initial element type/symbol, plus counter +=1 on each subsequent
        // // subsequent encounters
        //   // add 1 to log count
        // const logTypes = {}
        //
        // function styleToSymbol() {}
        //
        // if (!logTypes[type]) {
        //   logTypes[type] = {
        //     count: 0
        //   }
        //   logTypes[type].count++
        // }

      }

    }

  }

  function trackerUpdate(i) {

    let coordsNow = geoMM[i];

    if (coordsNow) {
      getElevation(coordsNow).then(elevation => {
        d3.select("#current-feet").text(elevation)
      });
    }

    d3.select("#current-miles").text(i+1)
    d3.select("#current-pace").text(getPace())
    d3.select("#current-bearing").text(getAzimuth(i))

    // .attr("transform", "translate(" + arcPts[0] + ") rotate(" + azimuth0 +")")

  }

  function getMM(t) {
    // if tpm variable, current mm is would be pace calculation - previous total (already elapsed, cannot undo)
    let atPace = Math.floor(t/tpm);
    mm = (accumReset) ? atPace - accumReset : atPace;
    return mm;
  }

  function adjustTPM() {
    // account for trackerUpdate which calculates milemarker using elapsed time
    accumReset += mm;  // cumulative total of elapsed at all TPMs thus far
  }

  function getPace() {
    return tpm;
  }

  function getElevation([lng,lat]) {

    // if (lng && lat) {  // avoid error at end?

      let query = `https://elevation-api.io/api/elevation?points=(${lat},${lng})`

      let elevation = d3.json(query).then(returned => {
        return metersToFeet(returned.elevations[0].elevation);
      }, onError);

      return elevation;

      function metersToFeet(m) {
        return turf.round(m * 3.281);
      }

    // }
  }

  function getAzimuth(i) {  // returns rounded/approximate value

    let prevPt = geoMM[i-1] || geoMM[i],
        nextPt = geoMM[i+1] || geoMM[i];

    return Math.round(turf.bearingToAzimuth(turf.bearing(prevPt,nextPt)));

  }

//// HTML/CSS VISIBILITY MANAGEMENT

  function expand(elementStr,direction = ["up"]) {

    // if window too short to reasonably fit more content, expand modal instead
    if (window.innerHeight < 500) {

      if (elementStr === "about") {
        toggleModal("modal-about")
      }

    } else {

      d3.select(`#${elementStr}`).classed(`disappear-${opposite(direction)}`, false)
      d3.select(`#${elementStr}-collapse`).classed("none", false);
      d3.select(`#${elementStr}-expand`).classed("none", true);

      // size- and element-specific toggles upon expand/collapse of various elements
      if (elementStr === "about") {
        if (window.innerWidth > 1200) {
          d3.select("#section-wrapper").classed("relative", true);
          d3.select("#attribution").classed("mr24-mxl", false)
          d3.select("#dash-content").classed("mx30-mxl",false)
        } else {
          d3.select("#dash-up").classed("mt-neg18", true)
          d3.select("#dash-up").classed("mt-neg6", false)
          d3.select("#dash-expand-btn").classed("h18 mt6", true)
          d3.select("#dash-expand-btn").classed("h24 mt0", false)
          if (d3.select("#dash").classed("disappear-down")) {
            d3.select("#attribution").classed("mt-neg24", false)
            d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", true)
          }
        }
      } else if (elementStr === "dash") {
        d3.select("#attribution").classed("mt-neg18 mt-neg24 mt-neg24-mxl", false)
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

    // size- and element-specific toggles upon expand/collapse of various elements
    if (elementStr === "about") {
      if (window.innerWidth > 1200) {
        d3.select("#section-wrapper").classed("relative", false)
        d3.select("#attribution").classed("mr24-mxl", true)
        d3.select("#dash-content").classed("mx30-mxl",true)
      } else {
        d3.select("#dash-up").classed("mt-neg6", true)
        d3.select("#dash-up").classed("mt-neg18", false)
        d3.select("#dash-expand-btn").classed("h24 mt0", true)
        d3.select("#dash-expand-btn").classed("h18 mt6", false)
        if (d3.select("#dash").classed("disappear-down")) {
          d3.select("#attribution").classed("mt-neg24", true)
          d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", false)
        }
      }
    } else if (elementStr === "dash") {
      if (d3.select("#about").classed("disappear-down")) {
        d3.select("#attribution").classed("mt-neg24", true)
        d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", false)
      } else {
        d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", true)
        d3.select("#attribution").classed("mt-neg24", false)
      }
    }

  }

  function toggleModal(subContent) {

    if (d3.select(`#modal`).classed("none")) {
      if (subContent) {
        d3.select(`#${subContent}`).classed("none", false);
        if (subContent === "modal-about") {
          collapse("about", collapseDirection(window.innerWidth))
          resize()
        }
        isTogglable(subContent,true)
      }
      d3.select("#veil").classed("none", false);
      d3.select(`#modal`).classed("none", false);
    } else {  // modal currently open
      // if toggling closed with close button (!subContent) or re-clicking subContent button recently used to open modal
      if (!subContent || (subContent && isTogglable(subContent))) {
        d3.select("#modal").classed("none", true);
        d3.select("#veil").classed("none", true);
        d3.select("#get-options").classed("none", true)
        d3.select("#modal-about").classed("none", true)
        if (subContent) {
          isTogglable(subContent,false)
        }
      } else {  // subContent && (!isTogglable(subContent))
        // user wants to switch modal subContent with modal open
        if (d3.select(`#${subContent}`).classed("none")) {
          // open user selected subContent via switch
          let nowOpen = oppContent[subContent]
          d3.select(`#${subContent}`).classed("none",false)
          d3.select(`#${nowOpen}`).classed("none",true)
          isTogglable(subContent,true)
          isTogglable(nowOpen,false)
        } else {
          // offer visual affordance that selected content already open (jostle/shake element)
          d3.select(`#${subContent}`).classed("already-open",true)
          d3.timeout(() => {
            d3.select(`#${subContent}`).classed("already-open",false);
          }, 300);
        }
      }
    }
  }
  // change tracker/widget/leaves background and borders

  function isTogglable(content,set) {
    let btn = assocBtns[content];
    if (set !== undefined) togglesOff[btn] = set;
    return togglesOff[btn];
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
    // resetZoom(), endAll(), clearDOM();
    d3.select("#journey").remove()
    // open selection form
    toggleModal('get-options')
  }

//// PIZAZZ

  // STYLES
  function getStrokeWidth(d) {
    if (d.properties.STROKEWIDTH) {
      return d.properties.STROKEWIDTH + "px";
    } else if (d.properties.LEVEL) {
      return 0.25/(unromanize(d.properties.LEVEL)) + "px";
    } else {
      return 0.1 + "px";
    }
  }

  // function getStrokeOpacity(d){
  //   if (d.properties.CATEGORY === "Ecoregion") {
  //     return 0;
  //   } else {
  //     return 0.5;
  //   }
  // }

  // function getZIndex(d) {
  //   let zIndex = 10,  // default for non-watershed lines & non-ecoregion polygons
  //     props = d.properties;  // shorthand
  //   if (d.geometry.type === "Point") {
  //     zIndex = 100;
  //     if (props.orig_area) {
  //       zIndex -= Math.ceil(props.orig_area * 1e-6)
  //     }
  //   } else if (props.CATEGORY === "Watershed") {
  //     zIndex = 6
  //   } else if (props.LEVEL) {  // ecoregions
  //     zIndex = unromanize(props.LEVEL);
  //   }
  //   return zIndex;
  // }

  function getColor(type,parentId,level) {

    // currently receives ecoregions only
    // if (type === "Ecoregion") {

    let arabicLevel = unromanize(level);

    if (!colorAssignments.ecoregions[parentId][level]) {

      // use arabicLevel to derive similarColor as base for current ecozone+level combination
      colorAssignments.ecoregions[parentId][level] = {
        base: similarColor(chroma(colorAssignments.ecoregions[parentId].base).rgb(),arabicLevel)
      }

      // previously:
      // use arabicLevel to derive ecozone@level base color as more saturated (brighter? darker? more opaque?) version of parent color assignment
        // base: chroma(colorAssignments.ecoregions[parentId].base).saturate(arabicLevel/4).rgb()

    }

    // else if (colorAssignments.ecoregions[parentId][level].mostRecent) {
    //
    //   // derive similar color and store within colorAssignments object as mostRecent before returning
    //   let similarRGB = similarColor(colorAssignments.ecoregions[parentId][level].mostRecent,arabicLevel)
    //
    //   colorAssignments.ecoregions[parentId][level].mostRecent = similarRGB;
    //
    //   return chroma(similarRGB); // .brighten(arabicLevel);
    //
    // }  // else, the first time this ecozone+level combination is called

    // derive similar color
    let similarRGB = similarColor(chroma(colorAssignments.ecoregions[parentId][level].base).rgb(),arabicLevel)

    // // from here in, similar color derived in succession from most recently derived
    // colorAssignments.ecoregions[parentId][level].mostRecent = similarRGB;

    return chroma(similarRGB); // .brighten(arabicLevel);

    function similarColor([r,g,b],level) {

      // OPTIMIZE: are all the below values calculated each time function called? postpone until chosen/necessary
      let adjust1 = [[adjusted(r),g,b],
                     [r,adjusted(g),b],
                     [r,g,adjusted(b)]],
          adjust2 = [[adjusted(r),adjusted(g),b],
                     [r,adjusted(g),adjusted(b)],
                     [adjusted(r),g,adjusted(b)]],
          adjust3 = [adjusted(r),adjusted(g),adjusted(b)];

      let options = {
        1: [r,g,b],
        2: adjust1[random(2)],
        3: adjust2[random(2)],
        4: adjust2[random(2)],
        5: adjust3
      }

      return options[level];

      function adjusted(c) {

        // lower levels vary more drastically, though all should be distinct
        let factor = 1/level,
          i = random(factor * 120, factor * 60)  // upper,lower

        // ensure return value is between 0 and 255
        return Math.max(0,Math.min(255,(c + (Math.random() < 0.5 ? -i : i))))

      }

    }

    // } else {
    //   return paletteScale(random());
    // }

  }

  function getStroke(d) {
    let props = d.properties; // shorthand
    if (props.CATEGORY === "Watershed") {
      return colorAssignments.watersheds[props.OCEAN_ID].base;
    } else if (props.CATEGORY === "Ecoregion") {
      return chroma(colorAssignments.ecoregions[props.ECOZONE].base).brighten(2)
    } else if (props.CATEGORY.startsWith("River")) {
      return riverBlue;
    } else if (props.CATEGORY.startsWith("Lake")) {
      return lakeBlue;
    } else {  // hover effects on textured (non-ecoregion) polygons
      return paletteScale(random()); // "dimgray"
    }
  }

  function getFill(d) {
    let props = d.properties; // shorthand
    if (props.CATEGORY === "Lake") {
      return tWaves.url();
    } else if (props.CATEGORY === "Ecoregion") {
      return getColor("Ecoregion",props.ECOZONE,props.LEVEL)
      // RADIAL GRADIENT, PIXEL->PIXEL FLOODING ETC COMING SOON
    } else if (props.id.startsWith("ln")) {  // only lake lines filled
      return "none";
    } else if (props.id.startsWith("pt")) {
      return paletteScale(random());
    } else {
      let chosen = textureOpts[random(textureOpts.length-1)];
      svg.call(chosen)
      return chosen.url();
    }
  }

  // TOOLTIPS
  function onMouseover(d) {

    // visual affordance for element itself
    d3.select(this) // .classed("hover", true) //.raise();
      .transition().duration(300)
        .style("stroke-opacity", 1)
        .style("opacity", 0.9)

    if (d3.select(this).property("name")) {
      // make/bind/style tooltip, positioned relative to location of mouse event (offset 10,-30)
      let tooltip = d3.select("#map").append("div")
        .attr("class","tooltip")
        .html(getHtml(d3.select(this)))
        .style("left", (d3.event.layerX + 10) + "px")
        .style("top", (d3.event.layerY - 30) + "px")
        .style("fill", "honeydew")
        .style("stroke", "dimgray")
        .style("opacity", 0) // initially

      // bring tooltip into full opacity
      tooltip.transition().duration(300)
        .style("opacity", 1)
    }

  }

  function getHtml(d) {

    // only arrives here if node and name confirmed

    // verb/pretext
      // passing
      // entering
      // exiting
      // traversing

    let pre = `<span class="name txt-s txt-m-mxl">`;

    // main output
    let mainOut = getName(d);

    // posttext/subtext/more info
    let post = `</span>`;

    if (d.property("category") === "Ecoregion") {
      mainOut += `<br />
      <span class="name-ii txt-em txt-xs txt-s-mxl ">Level ${d.property("level")} Ecoregion</span >
      `
    }

    if (d.property("more-info")) {
      mainOut += `
      <br />
      <span class="more-info txt-xs txt-s-mxl">${d.property("more-info")}</span>
      `
    }

    return pre + mainOut + post;

  }

  function getName(d) {

    let pre = (["River","Ecoregion","Watershed","Grassland"].includes(d.property("category"))) ? `The ` : ``;

    let name = pre + `${d.property("name")}`
    if (d.property("category") === "Lake") {
      // type = "Lake"
    } else if (d.property("id").startsWith("ln")) {
      name += ` ${d.property("category")}`
    } else if (d.property("description")) {
      name += ` ${d.property("description")}`
    }

    return name;

  }

  function onMouseout(d) {

    // reset visual affordances
    let resetStrokeOpacity = d3.select(this).property("orig-stroke-opacity") || 0,
      resetOpacity = d3.select(this).property("orig-opacity") || 0;

    d3.select(this) // .classed("hover", false) // .lower();
      .transition().duration(750)
        .style("stroke-opacity", resetStrokeOpacity)
        .style("opacity", resetOpacity)

    // access existing
    let tooltip = d3.select("body").selectAll(".tooltip") // don't bother matching by id; should only ever be one tooltip open at a time

    // transition tooltip away
    tooltip.transition().duration(300)
      .style("opacity", 0)

    // remove tooltip from DOM
    tooltip.remove();

  }

  function updateLabelPositions() {
    d3.select("#label-nodes").selectAll(".label-node")
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
  }

//// OTHER HELPER FUNCTIONS

  // CLEANING UP
  function clearDOM() { }

  function endAll(transition,callback) {
    var n = 0;
    transition.each(function() { ++n; })
              .each("end", function() { if (!--n) callback.apply(this, arguments); });
  }

  // THE PARSING OF THINGS
  function replaceCommas(string) {
    let commaFree = string.replace(/\s*,\s*|\s+,/g, '%2C');
    return commaFree;
  }

  function unromanize(romanNum) {
    // for now
    let unromanized = {
      "I": 1,
      "II": 2,
      "III": 3,
      "IV": 4,
      "V": 5
    };
    return unromanized[romanNum];
  }

  function kmToMi(km) {
    return turf.convertLength(km,"kilometers","miles");
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

  function random(upper,lower = 0) {
    let randNum = Math.random();
    return (upper) ? lower + Math.round(randNum * (upper - lower)) : randNum;
  }

  function isEmpty(obj) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        return false;
      }
    }
    return true;
  }

  // ERRORS
  function onError(error) {
    console.log(error);
  }

  // AMENDED D3 FUNCITON
  // https://bl.ocks.org/cmgiven/547658968d365bcc324f3e62e175709b
  function rectCollide() {

    var nodes, sizes, masses
    var size = constant([0, 0])
    var strength = 1
    var iterations = 1

    function force() {

      var node, size, mass, xi, yi
      var i = -1
      while (++i < iterations) { iterate() }

      function iterate() {
        var j = -1
        var tree = d3.quadtree(nodes, xCenter, yCenter).visitAfter(prepare)

        while (++j < nodes.length) {
          node = nodes[j]
          size = sizes[j]
          mass = masses[j]
          xi = xCenter(node)
          yi = yCenter(node)

          tree.visit(apply)
        }
      }

      function apply(quad, x0, y0, x1, y1) {

        var data = quad.data
        var xSize = (size[0] + quad.size[0]) / 2
        var ySize = (size[1] + quad.size[1]) / 2

        if (data) {

          if (data.index <= node.index) { return }

          var x = xi - xCenter(data)
          var y = yi - yCenter(data)
          var xd = Math.abs(x) - xSize
          var yd = Math.abs(y) - ySize

          if (xd < 0 && yd < 0) {
            var l = Math.sqrt(x * x + y * y)
            var m = masses[data.index] / (mass + masses[data.index])

            if (Math.abs(xd) < Math.abs(yd)) {
              node.vx -= (x *= xd / l * strength) * m
              data.vx += x * (1 - m)
            } else {
              node.vy -= (y *= yd / l * strength) * m
              data.vy += y * (1 - m)
            }
          }

        }

        return x0 > xi + xSize || y0 > yi + ySize ||
               x1 < xi - xSize || y1 < yi - ySize

      }

      function prepare(quad) {
        if (quad.data) {
          quad.size = sizes[quad.data.index]
        } else {
          quad.size = [0, 0]
          var i = -1
          while (++i < 4) {
            if (quad[i] && quad[i].size) {
              quad.size[0] = Math.max(quad.size[0], quad[i].size[0])
              quad.size[1] = Math.max(quad.size[1], quad[i].size[1])
            }
          }
        }
      }

    }

    function xCenter(d) { return d.x + sizes[d.index][0] / 2 }
    function yCenter(d) { return d.y + sizes[d.index][1] / 2 }

    force.initialize = function (_) {
      sizes = (nodes = _).map(size)
      masses = sizes.map(function (d) { return d[0] * d[1] })
    }

    force.size = function (_) {
      return (arguments.length ? (size = typeof _ === 'function' ? _ : constant(_), force) : size)
    }

    force.strength = function (_) {
      return (arguments.length ? (strength = +_, force) : strength)
    }

    force.iterations = function (_) {
      return (arguments.length ? (iterations = +_, force) : iterations)
    }

    function constant(_) {
      return function () { return _ }
    }

    return force

  }

// })


//// INCOMPLETE TODO ////


  // dashboard and log output!!
    // sizing of dash output text
    // data clumping / prepare for log out
    // dash jump when text scroll starts
    // add nonProjMM to thisRoute object for mileage/elevation checks
    // separate journey log, narration txt?
  // about this map
    // sources.md -> links
    // writing real words

// LITTLE THINGS
  // less padding around about map on mm
  // line-dash ease slower at end
  // improve visual affordances on hover for pts & lines
  // new color for modal
  // change projection to equidistant (instead of equal area)
  // add exclusive pass rail lines?
  // const miles = {units:"miles"}
  // distinguish between stations and enrich pts
  // mouseover for stations
  // Northern Thompson Upland?? falsely triggered

// LITTLE BUT STUMPING ME RIGHT NOW
  // turn #dash, #about, and #modal expand/collapse into transitions (ESP switch between dash/about at begin)
  // keeping zindexes in line on very small screen sizes

// MEDIUM
  // use relational db / crosswalk to slim polygon file; then increase appropriate possible trigger points across the board
  // add level I ecozones again?
  // fix weird zoom on tiny routes
    // eg Amsterdam -> Oshawa, Mystic -> lots of NY ones
  // make lines/watersheds more sensitive to mousover?
  // new train icon that rotates along with headlights
  // remaining open github issues (form focus issue: use focus-within?); several more interspersed COMBAKs, FIXMEs, TODOs
  // more interesting icon for point data?
    // NPS svg
    //  maki: all -11, -15: volcano, mountain, park, park-alt1, information, marker, marker-stroked, circle, circle-stroked, bridge, heart
    // assembly #icon-mountain icon -- mount, mountain, mt, mtn
  // avoid repeating content elements in HTML doc (widgets @ two screen sizes, about modal + aside)

// MAJOR!! *** = NEED HELP!
  // *** performance improvement! (see ideas below) ***
  // resolve all dash output / user information INCL legend/log (lots of data clumping)
  // resolve all colors, stroke-dasharrays, textures, styling issues of every kind (see more style notes below)

// WISHLIST/FUN
  // polygon radial animation / so fancy
  // add autocomplete/suggestions to R2R search
  // add features:
    // ability to "select random" in prompt route
    // ability to select route visually, by clicking on city/rail stn locations from map
    // ability to control pace of train (and other variables?) via slider(s) (!)
    // ability to replay, PAUSE, CANCEL, ff?, rewind??? (dash/animate back)
      // would need so much help with state management stuff: animation frame, rendered reveal -- and questions about local/session storage (R2R returns, processed/filtered enrichData) ***
    // ability to takeSnapshot()=> save inner screenshot in log?
  // orig options matches sorted by distance
  // add more enrich data (mostly pts): tunnels, bridges, iNaturalist, glaciers, species-specific polygons (habitat/range, https://www.worldwildlife.org/publications/wildfinder-database)
  // animate rivers in direction of flow: http://www.hydrosheds.org/download
  // add underlying MapboxGL vector tiles / custom MapboxStudio basemap?
  // add underlying shaded relief raster layer?
    // http://www.shadedrelief.com/birds_eye/gallery.html?
  // instead of free-zooming, zoom to certain views: whole continent, all routes, selected route, current train position, X miles
    // keep enabled even during animation
  // keep improving responsivity/layout
    // journey log separates from dash and grows with content on wider screens, overtaking #about (if #about toggled)
    // journey log separates from dash and grows with content on wider screens, overtaking #about (if #about toggled)
  // mousing over log elements highlights all within map
  // use x/y to transition-collapse down from tooltip/element itself into dash/log
  // more data-driven styling
  // elevation grid/visual tracker from number data

// MAAAAYBE
  // verbose console errors (in Chrome)
    // "[Violation] Forced reflow while executing JavaScript took 39ms"
      // https://gist.github.com/paulirish/5d52fb081b3570c81e3a
  // create toggle structure for page layout such that DOM responsivity requires less conditional logic; preset toggle groups for  various panes/panels (integrating all the if/else logic within calcSize(), expand(), and collapse() into styles.css doc; creating style groups to toggle on/off)
    // https://developer.mozilla.org/en-US/docs/Web/Events/toggle
    // css states?

////

// PERFORMANCE IMPROVEMENT IDEAS
  // removing unneeded elements from DOM as animation progresses
  // removing everything from DOM at end of experience (WHY DOES MY COMPUTER HUM FOR 5 MINUTES POST EVERY ANIMATION)
    // https://beta.observablehq.com/@mbostock/disposing-content
  // use projPath.measure() or projPath.area() instead of turf.length() calculations to determine animation variables? how would pixel units translate to time?
  // taken from github issue notes:
    // * redraw SVG (supported by use of `clipExtent()` or similar?) at certain moments within script
    // * appropriately truncate coordinates and other values wherever possible
    // * slim library imports / take only what I need
  // search/filter dynamically on backend? is this possible? goal: avoid bringing all of north america's enrichData into the browser every time
  // allow R2R request / data prep to happen more asynchronously to avoid long lag following submit click??
  // dynamically simplify map geometries?
  // use Canvas! even WebGL?
    // stardust.js? https://www.cs.ucsb.edu/~holl/pubs/Ren-2017-EuroVis.pdf
    // possible to integrate with some svg elements that I would like to retain mouseover interaction, etc?
    // ----->>>> https://github.com/kafunk/eco-rails/issues/1 <<<<-----
    // links:
      // https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource
      //  + SVG??: https://css-tricks.com/rendering-svg-paths-in-webgl/
      // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Drawing_DOM_objects_into_a_canvas
      // https://beta.observablehq.com/@mbostock/randomized-flood-fill
      // blockbuilder.org/larsvers/6049de0bcfa50f95d3dcbf1e3e44ad48
      // https://medium.freecodecamp.org/d3-and-canvas-in-3-steps-8505c8b27444


// STYLING NOTES:
  // transitions can interpolate between:
    // visibility: visible and visibility: hidden
    // opacity [0, 1]
    // colors
    // location/size
  // PLAY/ADVANCED:
    // CSS filters: blur(),brightness(),hueRotate()
    // mix-blend-mode, filters: sepia(), blur(), drop-shadow(), grayscale()
    // backdrop filters? (not much browser compatability?)
    // SVG filters: feGaussianBlur, etc


// CODE CLEAN
  // be super consistent and clear including '' vs "", use of var/const/let, spacing, semicolons, etc
  // refactor, optimize, condense, DRY, improve structure
  // revisit older functions (eg zoomFollow group) in particular


// DATA CLEAN!

  // PROBLEM CITIES
    // FIX
      // Sault Ste Marie, ON
      // Charleston, SC
      // Cincinnatti, OH
      // Greenville, SC
      // Grand Junction, CO
      // Saskatoon, SK
      // Memphis, TN
      // Burlington, IA
    // REMOVE

////////

// DONE:


// TRYING TO RECONCILE ACTUAL DISTANCE WITH SIMP DISTANCE for purposes of tracking mileage, determining elevation at precise pt en route, etc.
// elapsed tpsm --> ? tpm

// NEW TO DO:
// ecozone 10 yellow --> more subtle
// east green ecozone --> more subtle
// fix dash pop right when narration txt starts!
// bg-lighten in journey-log
// no point in having polygons or pts without names (nameless river/lake segments at least visually illuminating)

// NOTES
// dash post jump on half size left: 719 w [orig 707]
// 394narration [orig 387!] -- 7 px diff (12 split)
// 276journeylog [orig 271] -- 5 px diff (12 split)
// route reveal == red amsterdam
