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

  // FOR EASY ACCESS/ADJUSTMENT:
  var arcSteps = 500 // how fine tuned SVG path animation
    headlightRadius = 6,
    tpm = 80,  // time per mile; hard-coded goal of animated ms per route mile (more == slower); eventually should be user-adjustable via slider
    minT = tpm * 10,
    tPause = 2400,  // standard delay time for certain transitions
    viewFocusInt = 100, // miles in/out to initially focus view, start/stop
    zoomFollowScale = 18, // hard coded scale seems to be widely appropriate given constant bufferExtent; ~12 good
    zoomDuration = tPause *2,
    zoomEase = d3.easeCubicIn,
    zoomAlongOptions = {padBottom: 1 + zoomFollowScale/10};

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

  var labelNodes = g.append("g").attr("id", "labelNodes")

  let allEncounters = [],
         enterAlign = "left",
          exitAlign = "right";

  let defaultOptions = {
    extent: extent0,
    scalePad: 0.1,
    padTop: 0,
    padRight: 0,
    padBottom: 0,
    padLeft: 0
  }

  const cityState = d => { return d.city + ", " + d.state; }

// COLORS
  const palette = ['#483597','#94417f','#fa8253','#ec934a','#c7993f', '#b5be6a','#9dc579','#8bc188'];

  const paletteScale = chroma.scale(palette).domain([1,0]).mode('lch').correctLightness();

  const riverBlue = "cyan",
         lakeBlue = "teal";

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


//// INITIATE DATA LOAD

  // Typical Mapshaper CLI transform:
    // mapshaper *filein*.geojson name=*objectunits* \
    //     -o quantization=1e5 format=topojson mapshaped/*fileout*.json
    // then simplified and cleaned in browser for visual

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
     enrichPolys = d3.json("data/final/enrich_polys.json"),
     enrichLines = d3.json("data/final/enrich_lines.json"),
       enrichPts = d3.json("data/final/enrich_pts.json"),
  // quadtree ready
    quadtreeReps = d3.json("data/final/quadtree_search_reps.json"),
   // triggerPtPool = d3.json("data/final/snapped_enrich_trigger_pts.json"),
   triggerPtPool = d3.json("data/final/enrich_trigger_pts.json");

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
        .on("end", noneClass)

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
       mergedGJ = turf.lineString(route.segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat());

      let thisRoute = {
        from: raw.places[0],
        to: raw.places[1],
        totalDistance: route.distance, // in miles,
        totalTime: route.totalTransitDuration, // not including transfers
        lineString: mergedGJ,
        segments: route.segments.map(storeSegmentDetails),
        allStops: raw.places,
        overallBearing: turf.bearing([raw.places[0].lng,raw.places[0].lat],[raw.places[1].lng,raw.places[1].lat]),
        arcPts: getArcPts(arcSteps)
      }

      // easily access to/from coords
      let getCoords = function() {
        this.coords = [this.lng,this.lat]
        return this.coords
      }
      thisRoute.to.coords = getCoords
      thisRoute.from.coords = getCoords

      function getArcPts(steps = 500) {

        let lineChunks = turf.lineChunk(mergedGJ,route.distance/steps,{units:"miles"}).features,
           firstCoords = lineChunks.map(d=>d.geometry.coordinates[0]),
             lastChunk = lineChunks[lineChunks.length-1].geometry.coordinates,
             lastCoord = lastChunk[lastChunk.length-1];

        let allCoords = firstCoords.concat([lastCoord]).map(d=>projection(turf.truncate(turf.point(d),{precision:5,mutate:true}).geometry.coordinates)),
           getBearing = function(i) {
            let prevPt = this.coordinates[i-1] || this.coordinates[i],
                nextPt = this.coordinates[i+1] || this.coordinates[i];
            return turf.bearing(projection.invert(prevPt),projection.invert(nextPt));
             // FOR ELSEWHERE
             // getOrientation(i) {}, // cardinal
             // getElevation(i) {}
           };

        return {
          coordinates: allCoords,
          orient: getBearing // receives i as parameter (plus implicit this)
        };

      }

      // likely will not need all this information
      function storeSegmentDetails(segment) {

        if (!segment) { // debugging, temporary
          console.log("no route segments?")
          console.log("route:",raw.routes[0])
        }

        return {
            agency: raw.agencies[segment.agencies[0].agency],
          lineName: segment.agencies[0].lineNames[0],
        lineString: polyline.toGeoJSON(segment.path),
          distance: segment.distance,
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

      let confirmedEnrich = Promise.all([quadtreeReps,initBounds]).then(getIntersected,onError);

      let enrichTriggers = Promise.all([triggerPtPool,confirmedEnrich]).then(distillTriggers,onError);

      let updatedEnrich = Promise.all([enrichTriggers,confirmedEnrich]).then(updateInAccordance,onError)

      // bind all trigger points to the DOM for en route intersection
      Promise.all([enrichTriggers]).then(data => {

        routeQuadtree = makeQuadtree(data[0].triggerPts,chosen.bufferedRoute);

        // optional binding/visualization:
        // bindQuadtree(routeQuadtree)

        // non-optional binding, optional visualization (within function):
        bindQuadtreeData(data[0].triggerPts,true) // triggerPtFlag === true

      },onError)

      // bind all updated, trigger-pt-associated full geometries to DOM
      Promise.all([updatedEnrich]).then(bindEnriching,onError)

      return chosen;

      function getIntersected([quadReps,quadBounds]) {

        // FIRST make a quadtree of all representative enrich data pts draped over North America

        let quadtreeData = topojson.feature(quadReps,quadReps.objects.searchReps).features,
              dataExtent = topojson.feature(quadBounds,quadBounds.objects.bounds).features[0];

        let begin = performance.now();
        // console.log("making quadtree @",begin)

        let quadtree = makeQuadtree(quadtreeData, dataExtent)

        // // optional data viz
        // bindQuadtree(quadtree);
        // bindQuadtreeData(quadtreeData);

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

        // removeQuadtreeNodes(filtered,quadtree); // won't speed up search because all filtering complete by this point; keep quadtree in tact in case it could be reutilized within same session?

        let possibleFeatures = [...new Set(filteredEnrich.map(d => d.properties.id))];

        console.log("unique possibleFeatures by id:",possibleFeatures.length)

        let confirmedEnrich = Promise.all([enrichPts,enrichLines,enrichPolys]).then(filterFurther,onError);

        return confirmedEnrich;

        function filterFurther([pts,lines,polys]) {

          let filteredPts = topojson.feature(pts, pts.objects.enrichPts).features.filter(d => { return possibleFeatures.includes(d.properties.id) }),
            filteredLines = topojson.feature(lines, lines.objects.enrichLines).features.filter(d => { return possibleFeatures.includes(d.properties.id) }),
            filteredPolys = topojson.feature(polys, polys.objects.enrichPolys).features.filter(d => { return possibleFeatures.includes(d.properties.id) });

          let confirmedEnrich = turfFilter(filteredPts,filteredLines,filteredPolys,chosen.lineString,chosen.bufferedRoute);

          return confirmedEnrich;

          function turfFilter(pts,lines,polys,route,buffer) {

            // more specific than initial quadtree search

            // if any lines or polys are multigeometries, split for purposes of turf boolean queries only (to be reunited before return)
            let singleLines = lines.map(d => {
              if (!d.geometry) { console.log(d) }
              return (d.geometry.type === "MultiLineString") ? turf.flatten(d).features : d;
             }).flat(),
            singlePolys = polys.map(d => {
              // convert polygons to lines to ease turf.js utilization
                // even regular (non-multi-) polygons can produce MultiLineStrings when converted; account for this
              let asLines = turf.polygonToLine(d);
              // i think some recursion is called for below
              if (asLines.features) {
                return asLines.features.map(d => {
                  return (d.geometry.type === "MultiLineString") ? turf.flatten(d).features : d;
                }).flat();
              } else {
                return (asLines.geometry.type === "MultiLineString") ? turf.flatten(asLines).features : asLines;
              }
             }).flat()

            // OPTIMIZE: once a subfeature with a certain feature id has been identified, no need to run turf query on other subfeatures associated with same parent
            let filteredSingleLineIds = singleLines.filter(d => {
              return turf.booleanCrosses(d,buffer);
            }).map(d => d.properties.id),
            filteredSinglePolyIds = singlePolys.filter(d => {
              // which faster?
              return turf.booleanCrosses(d,buffer); // requires pre-conversion from polys -> (multi)linestrings -> single linestrings;
              // return turf.booleanOverlap(d,buffer) // no conversion, but seems so slow!
            }).map(d => d.properties.id);

            let confirmedEnrich = {
              pts: pts.filter(d => turf.booleanPointInPolygon(d,buffer)),
              lines: lines.filter(d => filteredSingleLineIds.includes(d.properties.id)),
              polys: polys.filter(d => filteredSinglePolyIds.includes(d.properties.id))
            }

            return confirmedEnrich;

          }

        }

      }

      function distillTriggers([triggerPtPool,confirmedEnrich]) {

        let massagedEnrich = massageEnrich(confirmedEnrich);

        let triggerData = getTriggerData(triggerPtPool,massagedEnrich.pts,massagedEnrich.regLines,massagedEnrich.linegons,massagedEnrich.polys,chosen.lineString,chosen.bufferedRoute);

        // console.log("triggerData",triggerData)

        return triggerData;

        function massageEnrich(confirmed) {

          let massagedEnrich = {
            pts: confirmed.pts,  // pts won't need any adjustment; kept here for simplicity
            regLines: [],
            linegons: [],
            polys: []
          };

          // separate out lines into LINEGONS (aka a polygon I want to style as a line, eg watersheds; pronounced liney-gons; not to be confused with polylines) and regular lines:
          confirmed.lines.forEach(d => {
            let coords = d.geometry.coordinates  // shorthand
            if (coords[0][0] === coords[coords.length-1][0] && coords[0][1] === coords[coords.length-1][1]) {  // ie if line === closed
              massagedEnrich.linegons.push(d)
            } else {
              massagedEnrich.regLines.push(d);
            }
          })

          // polys => linestrings for purposes of extracting triggerData and styling associated features; will remain flagged as "polygons" within enrichData object
          confirmed.polys.forEach(d => {
            if (d.geometry.type === "MultiPolygon") {
              d = turf.multiLineString(turf.flatten(turf.polygonToLine(d)).features.map(d => d.geometry.coordinates),d.properties)
            } else if (d.geometry.coordinates.length > 1) {
              d = turf.multiLineString(turf.polygonToLine(d).geometry.coordinates,d.properties)
            } else {
              d = turf.lineString(turf.polygonToLine(d).geometry.coordinates,d.properties)
            }
            massagedEnrich.polys.push(d);
          })

          return massagedEnrich;

        }

        function getTriggerData(triggerPtPool,pts,regLines,linegons,polys,route,buffer) {

          let begin = performance.now();
          // console.log("getting trigger data @",begin)

          triggerPtPool = topojson.feature(triggerPtPool,triggerPtPool.objects.triggerPts).features;

          let prefixes = {
            points: "pt",
            regLines: "ln",
            linegons: "ln",
            polygons: "py"
          };

          let replaceGJs = [];  // should be linegons only
                                // keep track of features that come in whole and were segmented, such that associated full GJ's can be replaced with multiple parts before binding to domain
                                // keep all ids and geoms consistent between triggerPts and triggered features to ensure easy styling/transitions later on

          let routeOrigin = route.geometry.coordinates[0],
            triggerGroups = [{data: pts, type: "points"},
                             {data: regLines, type: "regLines"},
                             {data: linegons, type: "linegons"},
                             {data: polys, type: "polygons"}];

          let allTriggerPts = triggerGroups.map(geomGroup => {

            let assocPrefix = prefixes[geomGroup.type],
                  groupPool = triggerPtPool.filter(d => {
                    return d.properties.id.slice(0,2) === assocPrefix;
                  });

            let returnGrp = geomGroup.data.map(d => {

              let triggerPts = [],
                      origId = d.properties.id.slice(),
                 featurePool = groupPool.filter(d => {
                   return d.properties.id === origId;
                 });

              if (geomGroup.type === "linegons") {

                let i0, i1,
                routeIntersectPts = featurePool.filter(d => {
                  return !d.properties.buffer_int && turf.booleanPointInPolygon(d,buffer);
                }).sort((a,b) => {  // SKIP THE SORT?
                  return turf.distance(routeOrigin,a) < turf.distance(routeOrigin,b);  // sort vaguely in direction of travel (turf.distance calculated geodesically, not route specific)
                }),
                bufferIntersectPts; // may or may not need

                // if (!routeIntersectPts.length) {
                //   // try again manually with turf?
                //   routeIntersectPts = turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features.map(d=>d.geometry.coordinates))
                // };

                if (routeIntersectPts.length) {

                  // console.log("routeIntPts filtered from pool",routeIntersectPts.slice().map(d=>d.geometry.coordinates))
                  // console.log("SAME DATUM: routeIntPts found dynamically by turf",turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features.map(d=>d.geometry.coordinates))

                  // store first encountered as i0, last encountered as i1 (i.e. if route enters/exits a geometry 3 different times, save only first enter and last exit)
                  i0 = routeIntersectPts[0];
                  if (routeIntersectPts.length > 1) {
                    i1 = routeIntersectPts[routeIntersectPts.length-1];
                  }

                } else {

                  bufferIntersectPts = featurePool.filter(d => {
                    return d.properties.buffer_int && turf.booleanPointInPolygon(d,buffer);
                  }).sort((a,b) => {
                    return turf.distance(routeOrigin,a) < turf.distance(routeOrigin,b);  // sort vaguely in direction of travel (turf.distance calculated geodesically, not route specific)
                  });

                  // if (bufferIntersectPts.length) {
                  //   console.log("bufferIntPts filtered from pool",bufferIntersectPts.slice().map(d=>d.geometry.coordinates))
                  //   console.log("SAME DATUM: bufferIntPts found dynamically by turf", turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features.map(d=>d.geometry.coordinates))
                  // }

                  // if still no intersectPts, get them manually
                  if (isEmpty(bufferIntersectPts)) {
                    console.log("NUTHIN")
                    bufferIntersectPts = turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features;
                    // COMBAK WHAT IF TINY FEATURES BETWEEN ROUTE AND BUFFER?
                    // SOME WAY TO REVAMP ALL OF THIS BY FINDING CLOSEST POINTS ON ROUTE + FEATURE?
                  }

                  // save *first* buffer intersect pt as i0 snapped to route
                  i0 = turf.nearestPointOnLine(route,bufferIntersectPts[0]);
                  if (bufferIntersectPts.length > 2) { // because if there are any, there will always be at least 2 (buffer enter/exit)
                    // save last buffer intersect pt snapped to route as i1
                    i1 = turf.nearestPointOnLine(route,bufferIntersectPts[bufferIntersectPts.length-1]);
                  }

                }

                let singleIntersectFlag = (!i1) ? true : false;

                // shift enrich datum geometry to get i1

                // find index of i0 (or closest to it) on d
                let nearest = turf.nearestPointOnLine(d,i0),
                     index0 = nearest.properties.index;

                // shift line geometry to start (and end) at i0
                let shifted;
                if (d.geometry.type === "MultiLineString") {
                  let halfOne = [],
                      halfTwo = [],
                      shiftPtFound = false;
                  d.geometry.coordinates.forEach(arr => {
                    if (arr[index0] && index0 === turf.nearestPointOnLine(turf.lineString(arr),i0).properties.index) {
                      halfOne.push(arr.slice(index0)),
                      halfTwo.push(arr.slice(0,index0+1)),
                      shiftPtFound = true;
                    } else if (shiftPtFound) {
                      halfOne.push(arr);
                    } else {
                      halfTwo.push(arr);
                    }
                  })
                  shifted = turf.multiLineString(halfOne.concat(halfTwo));
                } else {
                  shifted = turf.lineString(d.geometry.coordinates.slice(index0).concat(d.geometry.coordinates.slice(0,index0+1)));
                }

                let index1,
                  shiftedCoords = turf.coordAll(shifted.geometry);
                if (!i1) {  // only 0-1 actual route intersect pts, so calculate i1 as approx midpt on closed line (i0-i0)
                  // [catch Recalcuate]
                  i1 = turf.point(shiftedCoords[Math.floor(shiftedCoords.length/2)]),
                  index1 = (shifted.geometry.type === "MultiLineString") ? getNestedIndex(shifted,i1) : Math.floor(shiftedCoords.length/2);
                } else {
                  index1 = turf.nearestPointOnLine(shifted,i1).properties.index;
                  if (index1 === 0) {
                    // i0 & i1 route/buffer intersect points were identical or nearly so, such that turf.nearestPointOnLine is returning the same point for both;
                    // solution: recalculate index1 and i1 as though there were only ever one routeIntersect pt
                    // [throw Recalculate]
                    i1 = turf.point(shiftedCoords[Math.floor(shiftedCoords.length/2)]),
                    index1 = (shifted.geometry.type === "MultiLineString") ? getNestedIndex(shifted,i1) : Math.floor(shiftedCoords.length/2);
                  }
                }

                // create new geoJSON features with sub-geometries for individual line segment animation
                let gjA = turf.lineString(shifted.geometry.coordinates.slice(0,index1+1)),
                  gjB = turf.lineString(shifted.geometry.coordinates.slice(index1).reverse());

                let baseT;
                if (singleIntersectFlag) {
                  let lengthA = turf.length(gjA, {units:"miles"})
                      lengthB = turf.length(gjB, {units:"miles"}),
                        baseT = Math.ceil((lengthA + lengthB) / 2);
                } else {
                  baseT = Math.ceil(turf.length(turf.lineSlice(i0,i1,route),{units:"miles"}))
                }

                // return one trigger pt representing both i0->i1 segments
                triggerPts.push(turf.point(i0.geometry.coordinates,{
                  oid: origId,
                  id: origId + "-1",
                  i1: i1,
                  triggers: "linegon",
                  baseT: baseT,
                  multiTrigger: true  // no need for additional segmentFlag
                }));

                // save properties to repspective GJs and push to outer function's replaceGJs to ensure alignment between triggering and triggered
                let gjs = [gjA,gjB];
                gjs.forEach((gj,i) => {

                  let newId = `${origId}-${(i+1)}`;

                  gj.properties = Object.assign({},d.properties),
                  gj.properties.oid = origId,
                  gj.properties.id = newId;

                  replaceGJs.push(gj);

                })

              } else {

                // let begin = performance.now()
                //
                // console.log("filtering feature pool @", begin)

                triggerPts = featurePool.filter(d => turf.booleanPointInPolygon(d,buffer));

                // let end = performance.now()
                //
                // console.log("done @", end)
                // console.log("(",geomGroup.type,"took",end-begin,"ms)")

              }

              // if (geomGroup.type === "points") {

                // triggerPts.push(fea)
                // let baseT = Math.ceil(featurePool[0].properties.SNAP_DISTANCE);
                //
                // triggerPts.push(turf.point(featurePool[0].geometry.coordinates,{
                //   id: origId,
                //   triggers: "point",
                //   baseT: baseT
                // }));

              // } else {

                // let i0, i1,
                //   routeIntersectPts = featurePool.filter(d => {
                //     return !d.properties.buffer_int && turf.booleanPointInPolygon(d,buffer);
                //   }).sort((a,b) => {  // SKIP THE SORT?
                //     return turf.distance(routeOrigin,a) < turf.distance(routeOrigin,b);  // sort vaguely in direction of travel (turf.distance calculated geodesically, not route specific)
                //   }),
                //   bufferIntersectPts; // may or may not need
                //
                // // if (!routeIntersectPts.length) {
                // //   // try again manually with turf?
                // //   routeIntersectPts = turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features.map(d=>d.geometry.coordinates))
                // // };
                //
                // if (routeIntersectPts.length) {
                //
                //   // console.log("routeIntPts filtered from pool",routeIntersectPts.slice().map(d=>d.geometry.coordinates))
                //   // console.log("SAME DATUM: routeIntPts found dynamically by turf",turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features.map(d=>d.geometry.coordinates))
                //
                //   // store first encountered as i0, last encountered as i1 (i.e. if route enters/exits a geometry 3 different times, save only first enter and last exit)
                //   i0 = routeIntersectPts[0];
                //   if (routeIntersectPts.length > 1) {
                //     i1 = routeIntersectPts[routeIntersectPts.length-1];
                //   }
                //
                // } else {
                //
                //   bufferIntersectPts = featurePool.filter(d => {
                //     return d.properties.buffer_int && turf.booleanPointInPolygon(d,buffer);
                //   }).sort((a,b) => {
                //     return turf.distance(routeOrigin,a) < turf.distance(routeOrigin,b);  // sort vaguely in direction of travel (turf.distance calculated geodesically, not route specific)
                //   });
                //
                //   // if (bufferIntersectPts.length) {
                //   //   console.log("bufferIntPts filtered from pool",bufferIntersectPts.slice().map(d=>d.geometry.coordinates))
                //   //   console.log("SAME DATUM: bufferIntPts found dynamically by turf", turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features.map(d=>d.geometry.coordinates))
                //   // }
                //
                //   // if still no intersectPts, get them manually
                //   if (isEmpty(bufferIntersectPts)) {
                //     console.log("NUTHIN")
                //     bufferIntersectPts = turf.lineIntersect(d.geometry,turf.polygonToLine(buffer)).features;
                //     // COMBAK WHAT IF TINY FEATURES BETWEEN ROUTE AND BUFFER?
                //     // SOME WAY TO REVAMP ALL OF THIS BY FINDING CLOSEST POINTS ON ROUTE + FEATURE?
                //   }
                //
                //   // save *first* buffer intersect pt as i0 snapped to route
                //   i0 = turf.nearestPointOnLine(route,bufferIntersectPts[0]);
                //   if (bufferIntersectPts.length > 2) { // because if there are any, there will always be at least 2 (buffer enter/exit)
                //     // save last buffer intersect pt snapped to route as i1
                //     i1 = turf.nearestPointOnLine(route,bufferIntersectPts[bufferIntersectPts.length-1]);
                //   }
                //
                // }
                //
                // let singleIntersectFlag = (!i1) ? true : false;
                //
                // // LINEGONS and POLYGONS ONLY: shift enrich datum geometry to get i1
                // if (["linegons","polygons"].includes(geomGroup.type)) {
                //
                //   // find index of i0 (or closest to it) on d
                //   let nearest = turf.nearestPointOnLine(d,i0),
                //        index0 = nearest.properties.index;
                //
                //   // shift line geometry to start (and end) at i0
                //   let shifted;
                //   if (d.geometry.type === "MultiLineString") {
                //     let halfOne = [],
                //         halfTwo = [],
                //         shiftPtFound = false;
                //     d.geometry.coordinates.forEach(arr => {
                //       if (arr[index0] && index0 === turf.nearestPointOnLine(turf.lineString(arr),i0).properties.index) {
                //         halfOne.push(arr.slice(index0)),
                //         halfTwo.push(arr.slice(0,index0+1)),
                //         shiftPtFound = true;
                //       } else if (shiftPtFound) {
                //         halfOne.push(arr);
                //       } else {
                //         halfTwo.push(arr);
                //       }
                //     })
                //     shifted = turf.multiLineString(halfOne.concat(halfTwo));
                //   } else {
                //     shifted = turf.lineString(d.geometry.coordinates.slice(index0).concat(d.geometry.coordinates.slice(0,index0+1)));
                //   }
                //
                //   let index1,
                //     shiftedCoords = turf.coordAll(shifted.geometry);
                //   if (!i1) {  // only 0-1 actual route intersect pts, so calculate i1 as approx midpt on closed line (i0-i0)
                //     // [catch Recalcuate]
                //     i1 = turf.point(shiftedCoords[Math.floor(shiftedCoords.length/2)]),
                //     index1 = (shifted.geometry.type === "MultiLineString") ? getNestedIndex(shifted,i1) : Math.floor(shiftedCoords.length/2);
                //   } else {
                //     index1 = turf.nearestPointOnLine(shifted,i1).properties.index;
                //     if (index1 === 0) {
                //       // i0 & i1 route/buffer intersect points were identical or nearly so, such that turf.nearestPointOnLine is returning the same point for both;
                //       // solution: recalculate index1 and i1 as though there were only ever one routeIntersect pt
                //       // [throw Recalculate]
                //       i1 = turf.point(shiftedCoords[Math.floor(shiftedCoords.length/2)]),
                //       index1 = (shifted.geometry.type === "MultiLineString") ? getNestedIndex(shifted,i1) : Math.floor(shiftedCoords.length/2);
                //     }
                //   }
                //
                //   if (geomGroup.type === "linegons") {
                //
                //     // create new geoJSON features with sub-geometries for individual line segment animation
                //     let gjA = turf.lineString(shifted.geometry.coordinates.slice(0,index1+1)),
                //       gjB = turf.lineString(shifted.geometry.coordinates.slice(index1).reverse());
                //
                //     let baseT;
                //     if (singleIntersectFlag) {
                //       let lengthA = turf.length(gjA, {units:"miles"})
                //           lengthB = turf.length(gjB, {units:"miles"}),
                //             baseT = Math.ceil((lengthA + lengthB) / 2);
                //     } else {
                //       baseT = Math.ceil(turf.length(turf.lineSlice(i0,i1,route),{units:"miles"}))
                //     }
                //
                //     // return one trigger pt representing both i0->i1 segments
                //     triggerPts.push(turf.point(i0.geometry.coordinates,{
                //       oid: origId,
                //       id: origId + "-1",
                //       i1: i1,
                //       triggers: "linegon",
                //       baseT: baseT,
                //       multiTrigger: true  // no need for additional segmentFlag
                //     }));
                //
                //     // save properties to repspective GJs and push to outer function's replaceGJs to ensure alignment between triggering and triggered
                //     let gjs = [gjA,gjB];
                //     gjs.forEach((gj,i) => {
                //
                //       let newId = `${origId}-${(i+1)}`;
                //
                //       gj.properties = Object.assign({},d.properties),
                //       gj.properties.oid = origId,
                //       gj.properties.id = newId;
                //
                //       replaceGJs.push(gj);
                //
                //     })
                //
                //   } else { // polygons
                    //
                    // // TESTING
                    // featurePool.forEach(d => {
                    //   d.properties = {...d.properties, ...{baseT:80}}
                    //   triggerPts.push(d);
                    // })
                    //
                    // if (featurePool[0].properties.name === "Lake Erie") {
                    //   console.log("lake erie triggerpts:")
                    //   console.log(featurePool[0])
                    //   console.log(featurePool)
                    //   console.log("--------------")
                    // }

                    // FIXME:
                      // why is Lake Erie so hesitant to reveal?
                      // baseT should really be tied to geom itself to avoid having to bind to all triggerPts

                      // triggerPts.push(turf.point(i0.geometry.coordinates,{
                      //   id: origId,
                      //   // i1: i1,
                      //   triggers: "polygon",
                      //   baseT: 80 // temp
                      // }));

                    // let baseT;
                    // if (singleIntersectFlag) {
                    //   baseT = Math.ceil(turf.length(d,{units:"miles"}))
                    //   // eventually, line straight from i0 to shifted/madeup i1?
                    //   // console.log("perimeter",baseT,"vs area",turf.convertArea(turf.area(turf.lineToPolygon(d)),"meters","miles"))
                    // } else {
                    //   baseT = Math.ceil(turf.length(turf.lineSlice(i0,i1,route),{units:"miles"}));
                    // }
                    //
                    // triggerPts.push(turf.point(i0.geometry.coordinates,{
                    //   id: origId,
                    //   i1: i1,
                    //   triggers: "polygon",
                    //   baseT: baseT
                    // }));

                  // }

                  function getNestedIndex(multiGeom,pt) {
                    let nested = {};
                    multiGeom.geometry.coordinates.forEach((arr,i) => {
                      if (arr.length >1) { // some end with a smattering of single points
                        let line = turf.lineString(arr);
                        if (turf.booleanPointOnLine(pt,line)) {
                          nested.outer = i;
                          nested.inner = turf.nearestPointOnLine(line,pt).properties.index;
                          return nested;
                        }
                      }
                    })
                    // if (isEmpty(nested)) {
                    //   console.log("nested remained empty")
                    // }
                  }

                // } else { // regLines
                //
                //   // FIND ONLY ONE INTERSECT PT; KEEP GJ IN TACT, BUT BASE LOCATION OF TRIGGER PT ON DISTANCE FROM ENRICHLINE START TO I0 (TIMING SO THAT TRAIN AND ANIMATION MEET AT THAT POINT CONCURRENTLY)
                //   // ANIMATE ENRICH LINE IN FULL FROM START-> END OF LINE BASE ON FLOW DIRECTION! OR OTHER STANDARD FOR NON-STREAMS (?)
                //   // ACTUAL TRIGGER PT LOCATIONS WILL HAVE TO BE RECREATED IN ORDER FOR QUADTREE SEARCH TO ENCOUNTER THEM WITH ENOUGH LEEWAY SO THAT STREAMS/ETC CAN GET AN APPROPRIATE HEADSTART WHERE NECESSARY
                //
                //   // THAT IS: restructure line trigger/reveal such that only 1 intersection per feature, triggerPts adjusted accordingly (given streams a headstart such that they reach i0 concurrently) and each animated in flow direction
                //     // get baseT of i0->i1, then extrapolate baseT of full, THEN determine new i0 based on distance from coord0 to original i0
                //
                //   // i0 is first intersected route pt OR snapped buffer intersect pt; if there were enough intersectPts, i1 is final route intersect pt OR snapped final buffer intersect pt
                //   let i0First = i0,
                //        dFirst = getI1(d), // "first" flag == default
                //        i0Last = i1 || i0; // i0 if no i1 has been saved so far (indicating there is really only one enrichLine-route intersect pt)
                //         // dLast = getI1(d,"last");
                //
                //   // break off line slice between start of d and i0First
                //   let dPreMiles;
                //   if (dFirst !== i0First) {
                //     if (d.geometry.type === "MultiLineString") {
                //       dPreMiles = sliceMultiString(dFirst,i0First,d).length;
                //     } else {
                //       dPreMiles = turf.length(turf.lineSlice(dFirst,i0First,d),{units:"miles"});
                //     }
                //   } else {
                //     dPreMiles = 0;
                //   }
                //
                //   let dOverlapMiles;
                //   if (i0First !== i0Last) {
                //     if (d.geometry.type === "MultiLineString") {
                //       dOverlapMiles = sliceMultiString(i0First,i0Last,d).length;
                //     } else {
                //       dOverlapMiles = turf.length(turf.lineSlice(i0First,i0Last,d),{units:"miles"});
                //     }
                //   } else {
                //     dOverlapMiles = 0;
                //   }
                //
                //   let dTotalMiles = turf.length(d,{units:"miles"});
                //
                //   let routeI0 = (i0First.properties.location) ? i0First : turf.nearestPointOnLine(route,i0First,{units:"miles"});
                //
                //   let adjustedI0Location = Math.max(0,routeI0.properties.location - dPreMiles);
                //
                //   // console.log("adjusted location",adjustedI0Location)
                //
                //   // if (Math.sign(adjustedI0Location) === -1) {
                //   //
                //   //   // try reversing d
                //   //   let reversed, preMiles2;
                //   //
                //   //   // console.log("d",d.geometry.coordinates.slice())
                //   //
                //   //   if (d.geometry.type === "MultiLineString") {
                //   //     reversed = turf.multiLineString(reverseNested(d.geometry.coordinates.slice()));
                //   //     // console.log("reversed nested",reversed.geometry.coordinates)
                //   //     preMiles2 = sliceMultiString(dLast,i0First,reversed).length;
                //   //   } else {
                //   //     reversed = turf.lineString(d.geometry.coordinates.slice().reverse())
                //   //     // console.log("reversed plain",reversed.geometry.coordinates)
                //   //     preMiles2 = turf.length(turf.lineSlice(dLast,i0First,reversed),{units:"miles"});
                //   //   }
                //   //
                //   //   adjustedI0Location = routeI0.properties.location - preMiles2;
                //   //
                //   //   // console.log("new adjusted",adjustedI0Location)
                //   //
                //   //   // if still negative
                //   //   if (Math.sign(adjustedI0Location) === -1) {
                //   //     adjustedI0Location = 0;
                //   //   } else {  // if it worked, make changes permanent (for now; at least until flow direction property added)
                //   //     d.geometry.coordinates = reversed;
                //   //     dPreMiles = preMiles2;
                //   //     dLast = dFirst;
                //   //   }
                //   //
                //   // }
                //
                //   let adjustedI0 = turf.along(route,adjustedI0Location, {units: "miles"});
                //
                //   let baseT;
                //   if (dOverlapMiles > 0) {
                //     let wouldBeT = Math.ceil(turf.length(turf.lineSlice(i0First,i0Last,route),{units:"miles"}));
                //     // console.log("would be t",wouldBeT)
                //     baseT = Math.ceil((wouldBeT * dTotalMiles) / dOverlapMiles)
                //   } else {
                //     baseT = dTotalMiles;
                //   }
                //
                //   // console.log("baseT",baseT)
                //   // console.log("final premiles",dPreMiles)
                //
                //   triggerPts.push(turf.point(adjustedI0.geometry.coordinates,{
                //     // i1: dLast,
                //     id: origId,
                //     baseT: baseT,
                //     outputDelay: dPreMiles,
                //     triggers: "line"
                //   }))
                //
                // }

              // }

              // ALL
              // triggerPts.forEach(triggerPt => {
              //   triggerPt.properties.name = d.properties.NAME;
              // })

              return triggerPts;

            }).flat()

            console.log("returning",returnGrp.length,geomGroup.type.slice(0,geomGroup.type.length-1),"triggerPts @",Math.floor(performance.now())) //,returnGrp)

            return returnGrp;

            function getI1(d,position = "first") {
                let coords = d.geometry.coordinates.slice(), // deep enough copy?
                     index = 0;
                if (position === "last") {
                  if (d.geometry.type === "MultiLineString") {
                    coords = d.geometry.coordinates[d.geometry.coordinates.length-1]
                  }
                  index = coords.length-1;
                } else if (d.geometry.type === "MultiLineString") {
                  coords = d.geometry.coordinates[0]
                }
                return turf.point(coords[index]);
              }

            // function reverseNested(d) {
            //   let reversed = [];
            //   d.forEach(arr => {
            //     if (Array.isArray(arr[0][0])) {
            //       reversed.unshift(reversedNested(arr.slice()))
            //     } else {
            //       reversed.unshift(arr.slice().reverse())
            //     }
            //   })
            //   return reversed;
            // }

            function sliceMultiString(pt0,pt1,d) {
              let accumCoords = [],
                  accumLength = 0;
              d.geometry.coordinates.forEach((arr,i) => {
                let slice = turf.lineSlice(pt0,pt1,turf.lineString(arr));
                if (slice.geometry.coordinates.length > 2) {
                  accumCoords.push(slice.geometry.coordinates);
                  accumLength += turf.length(turf.lineString(slice.geometry.coordinates),{units:"miles"});
                }
              })
              return {
                coords: accumCoords,
                length: accumLength
              }
            }

          });

          let end = performance.now();
          console.log("getting trigger data took", Math.floor(end-begin), "ms")

          return {
            triggerPts: allTriggerPts.flat(),
            replaceGJs: replaceGJs
          };

        }

      }

      function updateInAccordance(enrichData) {

        let replaceGJs = enrichData[0].replaceGJs,
             fullGeoms = enrichData[1];

        // UPDATE ENRICH GJ'S AS NEEDED (SHOULD BE LINEGONS ONLY)
        let replaceIds = [...new Set(replaceGJs.map(d => d.properties.id.substring(0,d.properties.id.indexOf("-"))))];

        let updatedLines = fullGeoms.lines.map(feature => {
          if (replaceIds.includes(feature.properties.id)) {
            let replaceWith = [];
            replaceWith.push(replaceGJs.filter(replacement => {
              return replacement.properties.oid === feature.properties.id;
            }));
            return replaceWith.flat();
          } else {
            return feature;
          }
        }).flat();

        // NO NEED TO UPDATE PTS OR POLYS (return original full geometries)
        let updated = {
            pts: fullGeoms.pts,
          lines: updatedLines,
          polys: fullGeoms.polys
        }

        return updated;

      }

      function bindEnriching([updated]) {

        console.log("binding enrichData:",updated.pts.length,"pts,",updated.lines.length,"lines (incl split), &",updated.polys.length,"polys")

        // filter null geometries
        let pts = updated.pts.filter(d => d.geometry.coordinates.length > 0),
          lines = updated.lines.filter(d => d.geometry.coordinates.length > 0),
          polys = updated.polys.filter(d => d.geometry.coordinates.length > 0);

        // let begin = performance.now();

        let oceanIds = [...new Set(lines.filter(d => { return d.properties.CATEGORY === "Watershed" }).map(d => { return d.properties.OCEAN_ID }))],
           oceanHues = chroma.scale(['paleturquoise','aquamarine']).mode('lch').correctLightness().colors(oceanIds.length);

        let ecoZones = [...new Set(polys.filter(d => { return d.properties.CATEGORY === "Ecoregion" /* && d.properties.LEVEL === "II"*/ }).map(d => { return d.properties.ECOZONE }))],
            // zoneHues = chroma.scale('Spectral').colors(ecoZones.length);
            zoneHues = chroma.scale(['#472e37','#e35c45','#e2754d','#ffa100','#dbea09']).mode('lch').correctLightness().colors(ecoZones.length);

        let colorAssignments = {
          watersheds: {},
          ecoregions: {}
        };

        oceanIds.forEach(id => {
          colorAssignments.watersheds[id] = {
            base: chroma(oceanHues.shift().slice()).alpha(0.7)
            // base: paletteScale(random()).alpha(0.5)
          }
        })
        ecoZones.forEach(zone => {
          colorAssignments.ecoregions[zone] = {
            base: chroma(zoneHues.splice(random(zoneHues.length-1),1)[0].slice()).alpha(0.7)
            // base: paletteScale(random()).alpha(0.5)
          }
        })

        const levelStyles = {  // used for watersheds and ecoregions
          "I": {
            // dash: "0.1 0.4",
            width: 0.01,
            zIndex: 1
          },
          "II": {
            // dash: "0.3 0.4",
            width: 0.05,
            zIndex: 2
          },
          "III": {
            // dash: "0.3 0.1 0.2 0.1",
            width: 0.05,
            zIndex: 3
          },
          "IV": {
            // dash: "0.1 0.2 0.4 0.2",
            width: 0.1,
            zIndex: 4
          },
          "V": {  // some ecoregions
            zIndex: 5
          }
        }

        const getDashArray = function(d) {
          return (d.properties.CATEGORY === "Watershed") ? "0.1 0.2 0.4 0.2" : "none";
        }

        const getStrokeWidth = function(d) {
          return (d.properties.STROKEWIDTH) ? d.properties.STROKEWIDTH : 0.1;
        }

        const getZIndex = function(d) {
          let zIndex = 10,  // default for non-watershed lines & non-ecoregion polygons
            props = d.properties;  // shorthand
          if (props.LEVEL) {  // ecoregions; FORMERLY watersheds
            zIndex = levelStyles[props.LEVEL].zIndex;
          } else if (props.CATEGORY === "Watershed") {
            zIndex = 6
          }
          return zIndex;
        }

        const getColor = function(type,parentId,level) {
          if (type === "Ecoregion") {
            // derive color as brighter (/more saturated? darker? more opaque?) version of parent level color assignment
            if (!colorAssignments.ecoregions[parentId][level]) {
              colorAssignments.ecoregions[parentId][level] = {
                base: chroma(colorAssignments.ecoregions[parentId].base).saturate(unromanize(level))
              }
            }
            return chroma(colorAssignments.ecoregions[parentId][level].base).set('lch.c', random(30));
          } else {
            return paletteScale(random());
          }
        }

        const getStroke = function(d) {
          let props = d.properties; // shorthand
          if (props.CATEGORY === "Watershed") {
            return colorAssignments.watersheds[props.OCEAN_ID].base;
          } else if (props.CATEGORY === "Ecoregion") {
            return chroma(colorAssignments.ecoregions[props.ECOZONE][props.LEVEL].base).brighten(2)
          } else if (props.CATEGORY === "River") {
            return riverBlue;
          } else if (props.CATEGORY === "Lake") {
            return lakeBlue;
          } else {  // ??
            return paletteScale(random());
          }
        }

        const getFill = function(d) {
          let props = d.properties; // shorthand
          if (props.CATEGORY === "Lake") {
            return tWaves.url();
          } else if (props.CATEGORY === "Ecoregion") {
            return getColor("Ecoregion",props.ECOZONE,props.LEVEL)
            // RADIAL GRADIENT, PIXEL->PIXEL FLOODING ETC COMING SOON
          } else if (props.id.slice(0,2) === "ln") {  // only lake lines filled
            return "none";
          } else if (props.id.slice(0,2) === "pt") {
            return paletteScale(random());
          } else {
            let chosen = textureOpts[random(textureOpts.length-1)];
            svg.call(chosen)
            return chosen.url();
          }
        }

        const enrichLayer = g.append("g")
          .attr("id","enrich-layer")

        const enrichPolys = enrichLayer.append("g")
          .attr("id", "enrich-polygons")
          .selectAll(".enrich-poly")
          .data(polys)
          .enter().append("path")
            .classed("enrich-poly polygon waiting", true)
            .attr("d", projPath)
            .attr("id", d => d.properties.id)
            .property("name", d => d.properties.NAME)
            .property("category", d => d.properties.CATEGORY)
            .property("level", d => d.properties.LEVEL)
            .property("more-info", d => d.properties.MORE_INFO)
            .property("description", d => d.properties.DESCRIPTION)
            .property("baseT", d => {
              // let perimeter = Math.ceil(turf.length(d,{units:"miles"})),
              let area = turf.convertArea(turf.area(d),"meters","miles");
              // console.log("perim",perimeter)
              // console.log("area sqrt",Math.sqrt(area))
              return turf.round(Math.sqrt(area));
            })
            .style("fill", getFill)
            .style("stroke", getStroke) // was "none"; adding for hover effects
            .style("z-index",getZIndex) // d => (getZIndex(d) - 4)) // temp, to keep polygons in order under lines
            .style("opacity",0)
            .style("visibility","hidden")  // specify so tooltips don't engage too soon
            // .on("mouseover",onMouseover)
            // .on("mouseout",onMouseout)

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
            .property("assoc-watershed", d => d.properties.ASSOC_WATERSHED)
            .property("baseT", d => Math.ceil(turf.length(d,{units:"miles"})))
            .style("fill", getFill)
            .style("stroke", getStroke)
            .style("stroke-width", getStrokeWidth)
            .style("stroke-dasharray", getDashArray)
            .style("stroke-linecap", "round")
            .style("z-index",getZIndex)
            .style("opacity", 0)
            .style("visibility","hidden")
            // .on("mouseover", onMouseover)
            // .on("mouseout", onMouseout)

        const enrichPoints = enrichLayer.append("g")
            .attr("id", "enrich-pts")
          .selectAll(".enrich-pt")
          .data(pts)
          .enter().append("circle")
            .classed("enrich-pt point waiting", true)
            .attr("r", 0)
            .attr("cx", d => projection(d.geometry.coordinates)[0])
            .attr("cy", d => projection(d.geometry.coordinates)[1])
            .attr("id", d => d.properties.id)
            .property("name", d => d.properties.NAME)
            .property("category", d => d.properties.CATEGORY)
            .property("description", d => d.properties.DESCRIPTION)
            .property("more-info", d => d.properties.MORE_INFO)
            .property("baseT", d => d.properties.SNAP_DISTANCE)
            .style("fill", getFill)
            .style("stroke", "whitesmoke")
            .style("stroke-width", "0.05px")
            .style("z-index",7)
            .style("opacity", 0.6)
            .style("visibility","hidden")
            // .on("mouseover", onMouseover)
            // .on("mouseout", onMouseout)

        // let done = performance.now();

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

        function getPath(d) {
          // reverse certain line paths for purposes of later tweenDash directionality
          if (d.properties.CATEGORY === "Watershed") {
            return reverseSVGPath(projPath(d));
          } else {
            return projPath(d);
          }
        }

      }

    }

  }

//// INITIATE EXPERIENCE

  function initExp(chosen) {

    experience.initiated = true;

    let transform0 = getTransform(projPath.bounds(chosen.lineString)),
          options = { padBottom: 1 + transform0.k / 4 };  // ADJUSTABLE

    // zoom to bounds of chosen route
    let routeTransform = getTransform(projPath.bounds(chosen.lineString),options),
      boundsScale = Math.min(routeTransform.k,zoomFollowScale), // don't zoom in beyond set zoomFollowScale
      routeBoundsIdentity = getIdentity(routeTransform,boundsScale);

    // // testing
    // let routeMidPt = turf.midpoint(turf.point(chosen.to.coords()),turf.point(chosen.from.coords())).geometry.coordinates,
    //   routeCentroid = turf.centroid(chosen.lineString).geometry.coordinates,
    //   midPtBoundsIdentity = getIdentity(centerTransform(projection(routeMidPt),boundsScale)),
    //   centroidBoundsIdentity =  getIdentity(centerTransform(projection(routeCentroid),boundsScale));

    // control timing with transition start/end events
    svg.transition().duration(zoomDuration).ease(zoomEase)
      .call(zoom.transform, routeBoundsIdentity)
      .on("start", () => {
        prepareEnvironment();  // now includes collapse("#about") & drawRoute()
      })
      .on("end", () => {
        // confirm g transform where it should be
        g.attr("transform", routeBoundsIdentity.toString())
        // pause to prepareUser, then initiate animation (incl zoom to firstFrame)
        prepareUser();
        d3.timeout(() => {
          initAnimation(chosen,routeBoundsIdentity);
        }, tPause);
      })

    function prepareEnvironment() {

      // collapse about pane
      collapse("about", collapseDirection(window.innerWidth))
      resize()

      drawRoute(chosen, tPause);

      // let initialThree =
      d3.select("#encounters").selectAll(".encounter")
        .data(['Traversing special places','Encountering incredible things','Beholding the world made fresh again'])
        .enter().append("div")
          .classed("flex-child flex-child--grow encounter placeholder", true)
          .property("name", d => d)
          .html(d => `<span>${d}</span>`)

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

      function drawRoute(received,t) {

        d3.select("#map-init-load").transition()
          .delay(t/2)
          .duration(t/2 - 200)
          .style("opacity", 0)
          .on("end", noneClass)

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

        let arcPts = received.arcPts.coordinates;

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
          .style("stroke", "darkmagenta") // fiddle/improve
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
        let azimuth0 = getAzimuth(semiSimp.geometry.coordinates[0],semiSimp.geometry.coordinates[1]),
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
      goTrain(zoomFollow,zoomArc,routeBoundsIdentity); // initiate movement!
    // }

    function getZoomFollow() { // requires access to routeObj

      let zoomFollow = {
        necessary: true, // default
        focus: viewFocusInt,
        limit: viewFocusInt *3,
        scale: zoomFollowScale,
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

      if (zoomFollow.simpLength() > zoomFollow.limit) {

        let firstLast = getFirstLast(zoomFollow.fullSimp,zoomFollow.focus);

        zoomFollow.firstThree = firstLast[0],
         zoomFollow.lastThree = firstLast[1],
         zoomFollow.simpSlice = turf.lineSlice(zoomFollow.firstThree[1],zoomFollow.lastThree[1],zoomFollow.fullSimp).geometry.coordinates;

        // update firstLast with exact in/out focus coordinates (prevents stutter at moment of zoomAlong "takeoff")
        zoomFollow.firstThree[1] = zoomFollow.simpSlice[0],
         zoomFollow.lastThree[1] = zoomFollow.simpSlice[zoomFollow.simpSlice.length-1];

        zoomFollow.arc = zoomFollow.simpSlice;

      } else {

        // console.log(`short route (< ${limit} miles -- specifically, ${zoomFollow.simpLength}. first/last frames identical; no zoomAlong necessary.`)

        zoomFollow.necessary = false,
              zoomFollow.arc = zoomFollow.fullSimp.geometry.coordinates.slice();

        // save start, mid, and end points as onlyThree
        let onlyThree = [zoomFollow.fullSimp.geometry.coordinates[0],turf.along(zoomFollow.fullSimp,zoomFollow.simpLength/2,{ units: "miles" }).geometry.coordinates.map(d => +d.toFixed(2)),zoomFollow.fullSimp.geometry.coordinates[zoomFollow.fullSimp.geometry.coordinates.length - 1]];

        zoomFollow.firstThree = onlyThree,
         zoomFollow.lastThree = onlyThree;

      }

      // console.log(zoomFollow)

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

  function goTrain(zoomFollow,zoomArc,routeBoundsIdentity) {

    let t = 0, tDelay, tMid, firstIdentity, lastIdentity;

    let simpDistance = Math.floor(turf.length(zoomFollow.fullSimp, {units: "miles"})),
      tFull = Math.max(tpm * simpDistance, tPause);  // based on ms per simplified mile for so tDelay calculation is accurate

    let headlights = g.select("#headlights"),
          semiSimp = g.select("#semi-simp"),
             point = g.select("#train-point"),
          fullPath = g.select("#full-route"),
          azimuth0 = headlights.property("azimuth0");

    if (zoomFollow.necessary) {  // calculate transforms and timing from firstFrame to lastFrame

      // firstIdentity = getIdentity(getTransform(projPath.bounds(turf.lineString(zoomFollow.firstThree)),options),zoomFollowScale);
      //
      // lastIdentity = getIdentity(getTransform(projPath.bounds(turf.lineString(zoomFollow.lastThree)),options),zoomFollowScale);

      firstIdentity = getIdentity(centerTransform(projection(zoomFollow.firstThree[1]),zoomFollowScale,zoomAlongOptions))

      lastIdentity = getIdentity(centerTransform(projection(zoomFollow.lastThree[1]),zoomFollowScale,zoomAlongOptions))

      t = zoomDuration,
      tDelay = (simpDistance > zoomFollow.limit) ? tpm * zoomFollow.focus : tpm * 0,      // delay zoomFollow until train hits mm <zoomFollow.focus> (of fullSimp) IF route long enough
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
        goOnNow(zoomFollow.scale,lastIdentity,zoomArc)
      })

    function dimBackground(t) {

      let toDim = [d3.select("#admin-base"),d3.select("#hydro-base"),d3.select("#urban-base"),d3.select("#rail-base")];

      toDim.forEach(selection => {
        let currentOpacity = selection.style("opacity")
        selection.transition().duration(t)
          .style("opacity", currentOpacity * 0.2)
        });

    }

    function goOnNow(scale,lastIdentity,simpPath) {
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
  // svg.on("move", rerender);
  // svg.on("viewreset", rerender);

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

  // function makeFeature(coords, type = "Point") {
  //   return {
  //     "type": "Feature",
  //     "geometry": {
  //       "type": type,
  //       "coordinates": coords
  //     }
  //   }
  // }

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

  // function getBounds(transform,extent = extent0) { // functionality questionable
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

  function getAzimuth(p0,p1,isInitial = false) {
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

  function makeQuadtree(data,boundingGJ) {
    // search and nodes functions taken from https://bl.ocks.org/mbostock/4343214

    // get projected bounding box of passed geoJSON
    let pathBox = projPath.bounds(boundingGJ),
             x0 = pathBox[0][0], // xmin
             y0 = pathBox[0][1], // ymin
             x1 = pathBox[1][0], // xmax
             y1 = pathBox[1][1]; // ymax
           // padX = headlightRadius,
           // padY = headlightRadius;

    // initiate quadtree with specified x and y functions
    const projectX = d => { return projection(d.geometry.coordinates)[0] },
          projectY = d => { return projection(d.geometry.coordinates)[1] };

    let quadtree = d3.quadtree(data,projectX,projectY)
      .extent([[x0, y0], [x1, y1]])
      // .extent([[x0 - padX, y0 - padY], [x1 + padX, y1 + padY]])

    return quadtree;
  }

  function bindQuadtree(quadtree) {

    // CALLED OPTIONALLY FOR VISUAL OF GRID

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

  function bindQuadtreeData(data,triggerPtFlag = false) {

    // data should all be points, whether representative of larger polygons/lines or otherwise

    let quadtreeData = g.append("g")
      .classed("quadtree-data", true)

    quadtreeData.selectAll(".quad-datum")
      .data(data)
      .enter().append("circle")
        .attr("class", d => { return "quad-datum " + d.properties.id})
        .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
        .attr("r", 0.2)
        .property("feature_id", d => { return d.properties.id; })
        .property("name", d => { return d.properties.name || d.properties.NAME; })
        .property("category", d => { return d.properties.CATEGORY; })
        // .style("fill","none")  // COMMENT THIS OUT TO VISUALIZE
        // .style("stroke","none")  // COMMENT THIS OUT TO VISUALIZE
        .on("mouseover", onMouseover)
        .on("mouseout", onMouseout)

    if (triggerPtFlag) {
      quadtreeData.selectAll(".quad-datum").nodes().forEach(d => {
        d3.select(d).classed("trigger-pt",true)
      })
    }

  }

  function removeQuadtreeNodes(selected,quadtree) {

    if (selected.length) {

      // REMOVE NEWLY SELECTED TRIGGER PTS FROM QUADTREE SEARCH POOL
      quadtree.removeAll(selected)

      selected.forEach(d => {

        g.selectAll(".quadtree-data").selectAll(`.quad-datum.${d.properties.id}`).classed("quad-datum--removed",true)

      })

    }

  }

  function searchQuadtree(quadtree, x0, y0, x3, y3) {

    let selected = [];

    quadtree.visit(function(node, x1, y1, x2, y2) {

      if (!node.length) { // if node is not an array of nodes (i.e. has point content)

        do {

          let d = node.data,
             d0 = projection(d.geometry.coordinates)[0],
             d1 = projection(d.geometry.coordinates)[1];

          g.selectAll(".quadtree-data").selectAll(`.quad-datum.${d.properties.id}`).classed("quad-datum--scanned",true)

          d.selected = (d0 >= x0) && (d0 < x3) && (d1 >= y0) && (d1 < y3);

          if (d.selected) {

            // console.log("found match in quadtree at " + performance.now())

            g.selectAll(".quadtree-data").selectAll(`.quad-datum.${d.properties.id}`).classed("quad-datum--selected",true)

            // for flagged, en route trigger-pts only
            if ((g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).node()) && (g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).classed("trigger-pt"))) {

              // save d id as triggerId
                // for lines only, recognize multiTrigger flag and pass both ids together as pair
              let triggerId = (d.properties.multiTrigger) ? [d.properties.oid + "-1", d.properties.oid + "-2"] : d.properties.id;

              let options = {
                baseT: d.properties.baseT || null,
                segmentFlag: d.properties.segmentFlag
              }

              dispatch.call("encounter", triggerId, options);
              // slightly faster than external mutationObserver watching for class changes, though that may be a cleaner structure overall

            }

            selected.push(d)

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



  let prevLocation, prevRotate, prevExtent, searchExtent;
  function trainMoved() { // called by animate() following dispatch

    let trainTransform = this.node().transform.animVal[0].matrix,
            headlights = g.select("#headlights"),
       currentLocation = [trainTransform.e, trainTransform.f],
         currentRotate = headlights.node().transform.animVal[1].angle,
      currentTransform = "translate(" + currentLocation[0] + "," + currentLocation[1] + ") rotate(" + currentRotate + ")";

    if (!searchExtent) {  // first time only

      let sectorBBox = headlights.node().getBBox(),
            arcWidth = sectorBBox.width,
           arcHeight = sectorBBox.height;

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

      headlights.raise() // keep headlights on top of extent visualizations

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
    let newlySelected = searchQuadtree(routeQuadtree, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1]);

    // remove data as they are selected/revealed; (not sure if this helps performance any, but it probably doesn't hurt)
    removeQuadtreeNodes(newlySelected,routeQuadtree);

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
    // observer.disconnect()
    let unique = [...new Set(allEncounters.map(d=>d.property("id")))]
    console.log("unique encounters",unique.length)
    console.log("all encounters",allEncounters.length)
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
        if (!(pt0.x === pt1.x)) rotate = getAzimuth(pt0,pt1);
        pt0 = pt1;  // shift pt values pt0 >> pt1
        return transform = "translate(" + pt1.x + "," + pt1.y + ") rotate(" + rotate + ")";
      }
    }
  }

  function reverseSVGPath(pathStr) {
    return ["M",pathStr.split('M')[1].split('L').reverse().join('L')].join('');
  }

  function getDashStr(along,length,dash = "0.1 0.4") {

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

  function encountered(options) {

    // console.log("reached encountered() at " + performance.now())

    let id = this, id1, encountered1;

    if (Array.isArray(this)) {
      id = this[0],
      id1 = this[1],
      encountered1 = g.select(`#${id1}`);
      encountered1.classed("waiting",false);
      encountered1.style("visibility","visible")
    }

    // FIND full feature(s) by id
    let encountered = g.select(`#${id}`);
    encountered.style("visibility","visible")
    // remove waiting class upon intersect
    encountered.classed("waiting",false);

    let baseT = options.baseT || encountered.property("baseT"),
            t = Math.max(minT,baseT * tpm);
    // baseT is # en route miles from i0 to i1, OR
    // # miles from snapped route i0 to off route i1, OR
    // in a few cases, full length of d

    // DETERMINE TYPE, CALCULATE T, VISUALIZE
      // currently separated for geom-specific styling and transitions, but may be no need..
    if (id.startsWith('ln')) {
      // if (encountered.property("category") === "Watershed") {
      //   let innerReveal = g.selectAll(".enrich-line.waiting").filter(e => {
      //     return e.properties.ASSOC_WATERSHED === encountered.datum().properties.oid;
      //   });
      //   if (innerReveal.nodes()) {
      //     innerReveal.nodes().forEach(node => {
      //       // let selectedReveal = g.select(`#${e.properties.id}`);
      //       let selectedReveal = d3.select(node);
      //       selectedReveal.classed("waiting",false);
      //       reveal(selectedReveal,"line",t);
      //       output(selectedReveal)
      //     })
      //   }
      // }
      if (encountered1) { encountered = [encountered,encountered1]; }
      reveal(encountered,"line",t)
    } else if (id.startsWith('py')) {
      reveal(encountered,"polygon",t)
    } else {  // point feature
      reveal(encountered,"point",t)
    }

    if (!options.segmentFlag) {
      output(encountered[0] || encountered)
    }

  }

  function reveal(encountered,type,t = minT) {

    // all styling basics should already be in place;
    // just need to trigger appropriate transitions based on type

    if (type === "line") {
      if (Array.isArray(encountered)) { // multiTrigger
        if (encountered[0].property("category") === "Watershed") {

          // a version of animateDashed()
            // see https://bl.ocks.org/kafunk/91f7b870b79c2f104f1ebacf4197c9dc for more commentary

          let dashArr0 = encountered[0].style("stroke-dasharray"),
              dashArr1 = (encountered[1].style("stroke-dasharray")),
               length0 = encountered[0].node().getTotalLength(),
               length1 = encountered[1].node().getTotalLength(),
              dashStr0 = getDashStr(encountered[0], length0, dashArr0),
              dashStr1 = getDashStr(encountered[1], length1, dashArr1);

          encountered[0].style("stroke-dasharray", dashStr0)
            .style("stroke-dashoffset", -length0)
            .style("opacity", 0.6)
            .transition().duration(t).ease(d3.easeLinear)
            .styleTween("stroke-dashoffset",drawDashed)
            .on("start", () => {
              encountered[1].style("stroke-dasharray", dashStr1)
                .style("stroke-dashoffset", -length1)
                .style("opacity", 0.6)
                .transition().duration(t).ease(d3.easeLinear)
                .styleTween("stroke-dashoffset",drawDashed)
            })

        } else {
          encountered.forEach(d => {
            d.style("opacity",0.8)
              .transition().duration(t).ease(d3.easeLinear)
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
        .style("opacity", 0.6)
      // animate radial gradient outward from i0
    } else {  // type === "point"
      encountered.transition().duration(t).ease(d3.easeLinear)
          .attr("r", d => d.properties.orig_area * 0.00000002 || 0.1)
            // size of circle is a factor of planar (why?) area of polygon the circle is representing, or 0.1 minimum
          .style("opacity", 1)  // aim for initial glow effect?
        .transition().duration(t)
          .style("opacity",0.8)
    }

  }

//// OUTPUT AND ALERT incl DASHBOARD

  function output(encountered) {

    let darkText = "#333",
       lightText = "#ddd";

    if (encountered.node() && encountered.property("name")) {

      allEncounters.unshift(encountered)

      updateOutput(allEncounters.slice(0,3))

      flashLabel(encountered)

      trackerUpdate(encountered)

      log(encountered)

      function updateOutput(encounters) {

        // https://observablehq.com/@d3/selection-join

        // const t = d3.transition().duration(750);
          // unable to limit to 3 only when transition active

        d3.select("#encounters").selectAll(".encounter")
          .data(encounters, d => {
            return (typeof d === "string") ? d : d.property("id")
          })
          .join(
            enter => enter.append("div")
                .classed("flex-child flex-child--grow encounter mx3 my3 px3 py3", true)
                .html(getHtml)
              // .call(enter => enter.transition(t)
              //   .style("background", "green")),
              ,
            update => update
              // .call(update => update.transition(t)
              //   .style("background", "purple")),
              ,
            exit => exit
              // .call(exit => exit.transition(t)
              //   .style("background", "tomato")
                .remove() //)
          );

      }

      function trackerUpdate(e) {}

      function log(e) {}

    }

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

    // update all visible labelNodes
    labelNodes.selectAll(".labelNode")
      .data(labels, d => d.id)
      .join(
        enter => enter.append("text")
          .classed("labelNode", true)
          .text(d => d.label)
          .attr("x", d => d.x0)
          .attr("y", d => d.y0)
          // .attr("r", 1)
          // .attr("cx", d => d.x0)
          // .attr("cy", d => d.y0)
          // .attr("width", d => d.label.length)
          // .attr("height", 1)
          .attr('text-anchor', "middle")  // could be based on L/R of route
          .style("fill", "whitesmoke")
          .style("opacity", 0) // initially
          .style("stroke", "hotpink")
          .style("stroke-width", "0.01px")
          .style("font-size","1px")
          .call(enter => enter.transition(t)
            .style("opacity", 1)
          )
          .raise(),
        update => update
          .call(update => update.transition(t)
            // .attr("x", d => d.x) // glitchy when updated here; leave to updatedLabelPositions() function
            // .attr("y", d => d.y)
            .style("stroke", "yellowgreen")
            .style("opacity", 0.8)
          )
          .raise()
        // now called below
        // exit => exit
        //   .call(exit => exit.transition(t)
        //     .style("opacity", 0)
        //     .on("end", function() {
        //       exit.remove()
        //     })
        //   )
      ).raise() // .raise() // not working?

      // schedule self-removal and cycle out old labels
      d3.timeout(() => {

        labels.splice(labels.findIndex(d => d.id === id),1)

        // update nodes list bound to force simulation
        labelLayout.nodes(labels)

        // call force simulation tick and dispatch associated callback function manually
        labelLayout.tick()
        dispatch.call("force")

        // exit and remove from SVG
        labelNodes.selectAll(".labelNode")
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

    // element tooltip now accessible to user upon mouseover
    encountered.on("mouseover",onMouseover)
               .on("mouseout",onMouseout)

  }

  function updateLabelPositions() {
    labelNodes.selectAll(".labelNode")
              .attr('cx', d => d.x)
              .attr('cy', d => d.y)
  }

  function trackerUpdate(current) {
    // update dashboard elements: compass visual?, mileage tracker, elevation?
    // time limited, automatic tooltip raises as new points and layers encountered (taken care of through event listeners?)
  }

  function log(encounter) {
    // initial element type/symbol, plus counter +=1 on each subsequent
    // subsequent encounters
      // add 1 to log count
    const logTypes = {}

    function styleToSymbol() {}

    if (!logTypes[type]) {
      logTypes[type] = {
        count: 0
      }
      logTypes[type].count++
    }

  }

//// HTML/CSS VISIBILITY MANAGEMENT

  function noneClass() {
    d3.select(this).classed("none", true)
  }

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
    // subContent required to reveal; optional on close
    if (d3.select(`#modal`).classed("none")) {
      if (subContent) {
        d3.select(`#${subContent}`).classed("none", false);
        if (subContent === "modal-about") {
          collapse("about", collapseDirection(window.innerWidth))
          resize()
        }
      }
      d3.select("#modal-bg").classed("bg-lighten25", true)
      d3.select(`#modal`).classed("none", false);
    } else {
      d3.select(`#modal`).classed("none", true);
      d3.select("#modal-bg").classed("bg-lighten25", false)
      d3.select("#get-options").classed("none", true)
      d3.select("#modal-about").classed("none", true)
    }
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

  // TOOLTIPS
  function onMouseover(d) {

    // visual affordance for element itself
    d3.select(this).classed("hover", true).raise();

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

    let pre = `<span class="name txt-spacing1">`;

    // main output
    let mainOut = getName(d);

    // posttext/subtext/more info
    let post = `</span>`;

    if (d.property("category") === "Ecoregion") {
      mainOut += `<br />
      <span class="name-ii txt-em">Level ${d.property("level")} Ecoregion</span>
      `
    }

    if (d.property("more-info")) {
      mainOut += `
      <br />
      <span class="more-info txt-s">${d.property("more-info")}</span>
      `
    }

    return pre + mainOut + post;

  }

  function getName(d) {

    let pre = (["River","Ecoregion","Watershed","Grassland"].includes(d.property("category"))) ? `The ` : ``;

    let name = pre + `${d.property("name")}`
    if (d.property("category") === "Lake") {
      // type = "Lake"
    } else if (d.property("id").slice(0,2) === "ln") {
      name += ` ${d.property("category")}`
    } else if (d.property("description")) {
      name += ` ${d.property("description")}`
    }

    return name;

  }

  function onMouseout(d) {

    // d3.select("#current-hover").remove();

    // console.log(d) // feature gj
    // console.log(this) // dom node (svg)
    // console.log(d3.event) // event
    // console.log(d3.select("body").selectAll(".tooltip").node()) // tooltip
    // console.log(d3.select("body").selectAll(".tooltip").nodes()) // array of all tooltips

    // reset visual affordances
    d3.select(this).classed("hover", false).lower();

    // access existing
    let tooltip = d3.select("body").selectAll(".tooltip") //.datum(d => { return d.properties.id; }) // key function? match by id

    // transition tooltip away
    tooltip.transition().duration(300)
      .style("opacity", 0)

    // remove tooltip from DOM? // COMBAK NOT WORKING
    tooltip.remove();

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
  function replaceCommas(string){
    let commaFree = string.replace(/\s*,\s*|\s+,/g, '%2C');
    return commaFree;
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

// PRIORITIZE:
  // dashboard and log output!!
    // sizing of dash output text
    // data clumping / prepare for log out
  // about this map
    // sources.md -> links
    // writing real words

// LITTLE THINGS
  // veil only over map area (keep about accessible)
  // less padding around about map on mm
  // line-dash ease slower at end
  // improve visual affordances on hover for pts & lines
  // new color for modal
  // change projection to equidistant (instead of equal area)
  // workable link color
  // workable button hover color

// LITTLE BUT STUMPING ME RIGHT NOW
  // on form submit, modal element jumps, offsetting sizing (the excess padding issue that presented itself before and resolved mysteriously; well, it's back)
  // turn #dash, #about, and #modal expand/collapse into transitions (ESP switch between dash/about at begin)
  // keeping zindexes in line on very small screen sizes
  // issue: jump to center of wide routes upon collapse of #about

// MEDIUM
  // lines: account for outputDelay triggerPt property
  // new train icon / rotate along with headlights
  // remaining open github issues (form focus issue: use focus-within?); several more interspersed COMBAKs, FIXMEs, TODOs

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

// MAAAAYBE
  // account for polygons a user STARTS in? (does not enter, may/may not exit)
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
      // Memphis, TN?
      // Burlington, IA
    // REMOVE
      // Lynn Lake, MB
      // Sept-Iles, QC :(
      // Quesnel, BC
      // North Glengarry, ON
      // Scheferville QC
      // Severn ON
    // SEGMENT ISSUES?
      // Richmond, CA
      // Ft Lauderdale, FL
      // Oriole, ON

// DONE:
  // extract variables for easy access
  // iprove/simplify getting route bounds (reduce redunant turf method calls)
  // add options object to getTransform and centerTransform functions, allowing insertion of extra padding
  // zoomAlong calls on centertransform() for consistency
  // move around functions more logically, i.e. keep creation of second quadtree within enrichRoute (no need to pass around that data), and drawRoute() within prepareEnvironment()
  // adjust zoom scale, options, focus point
  // center zoomFollow further north to offset dash intrusion
  // rm unncessary clearfix/fr classes from dash widgets
  // clean data
    // pts revamp: all below 2800000 (zeroes?) threshold
    // removed handful of non-intersecting line remnants
    // re-did ids, searchreps, triggerpts
    // split certain rivers, removed a few doubles (those noticed earlier were almost all simply of different categories), rm radium, semisnapped and removed doubles for trigger pts (reduced #, reduced overlap, ensured close enough)
  // getTriggerData - points no longer calls on turf.nearestPointOnLine()
  // baseT now a property of enrich datum , not trigger pt
  // testing restructure of getTriggerData wherein all triggerpts within buffer returned, no fancy baseT calculations
  // "The" Lake Michigan,etc
  // more data cleaning: doubles, rivers needing split, etc (see below)
  // wrt functions relying on double defaults, extract into options objects

////////

// new trigger structure:
  // points: straightforward
  // regLines, on the fly: flow direction built in, forget timing?
  // linegons, on the fly: whatever pt is intersect, that becomes based for shifted geom calculation; associated geoms bound and rendered on the fly??
  // polygons, on the fly: whatever pt is intersected, that is base of spread/color fill (in direction perpendicular to triggerPt?)

// TODO
// more split: The Colorado River, The Republican River, the Big Blue River
  // Stillwater Swan Wooded Valley?
  // get Lake Erie some more trigger pts!
// add exclusive pass rail lines?
// const miles = {units:"miles"}
