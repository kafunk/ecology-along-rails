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
    // dash1 = "0.2 1.4",
    // dash1 = "4 8",
    // dash1 = "0.1 0.4",
      dash1 = "0.1 0.2",
      dash2 = "0.05 0.1",
    // dash2 = "0.2 1.2",
    // dash0 = "0.2 0.2",
    // dash0 = "4 8 16 8",
      dash3 = "0.05 2.4",
    dashTwo = "2 2",
    origDash = "4 8 16 8",
    line = d3.line().curve(d3.curveCardinal.tension(0)),
    t = 12000;  // default

  // var pi = Math.PI,
  //    tau = 2 * pi;

  // var minZ,  // minimum area threshold for dynamic simplification
  //   simplify = d3.geoTransform({
  //     point: function(x, y, z) {
  //       if (z >= minZ) this.stream.point(x, y);
  //     }
  //   })

  var padX = 0,
      padY = 0;

  // var margin = { top: d3.select("#header").node().clientHeight + 6, left: 12, bottom: 6, right: 12 },
  //   parentWindow = d3.select("#map-and-dash-pane").node(),
  //   height = parentWindow.clientHeight - margin.top - margin.bottom,
  //   width = parentWindow.clientWidth - margin.left - margin.right;

  var parentWindow = d3.select("#map-and-dash-pane").node(),
            height = parentWindow.clientHeight,
             width = parentWindow.clientWidth;

  var thisWindow = d3.select(window);

  var extent0 = [[-width/2, -height/2],[width/2, height/2]];

  var translate0 = [(width - padX)/2, (height + padY)/2];

  var scale0 = 1;

  // let currentView, currentBounds;
  let currentView = {
      scale: scale0
    },
    experience = {
      initiated: false,
      animating: false
    };

// // SET UP CANVAS
//   // ?? TEMP
//   var barbSize = 40,
//     intervalsTemp = [14,17,20,23,26,29,35,38];
//
//   var canvas = d3.select("#map").append("canvas")
//     .attr("width", width)
//     .attr("height", height);
//
//   var context = canvas.node().getContext("2d");

// SET UP SVG

  var svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height)

  // <defs> elements for later <use></use>
  var defs = svg.append("defs");

  // all rendered/zoomable content
  var g = svg.append("g")
    .attr("id", "zoomable")
    // .attr("width", width)
    // .attr("height", height)

//// READY MAP

  // PROJECTIONS & PATHS

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
  var path = d3.geoPath().projection(projection);

  // pre-projected path generator
  var ppPath = d3.geoPath().projection(identity);

// SET UP PAN/ZOOM BEHAVIOR

  var zoom0 = d3.zoomIdentity.translate(translate0[0],translate0[1]).scale(scale0)

  var active = d3.select(null);

  var zoom = d3.zoom()
    .translateExtent(paddedBounds(extent0).coordinates)
    .scaleExtent([scale0*0.5, scale0*64])
    .on("zoom", zoomed)

  var background = svg.append("rect")
      .attr("id", "background")
      .attr("width", width)
      .attr("height", height)
      .style("fill", "none")
      // .style("pointer-events", "all")
      .on("dblclick", resetZoom());

  svg.call(zoom.transform, zoom0) // keep this line first
     .call(zoom)
     // .on("wheel.zoom", null)

// SET UP CUSTOM DISPATCH BEHAVIOR

  let dispatch = d3.dispatch("ready","depart","move","arrive")
                   .on("depart.train", departed)
                   .on("move.train", trainMoved)

// DECLARE (BUT DON'T DEFINE) CERTAIN VARIABLES FOR LATER ACCESS

  let timer, quadtree;

// COLORS

  var diverging = d3.scaleDiverging(d3.interpolateBrBG),
    sequential = d3.scaleSequential(d3.interpolateSpectral),
    threshold = d3.scaleThreshold(d3.interpolateMagma),
    categorical = d3.scaleOrdinal(d3.schemeDark2);

  var linearGradientScale = d3.scaleLinear()
    .range(["#2c7bb6", "#00a6ca","#00ccbc","#90eb9d","#ffff8c",
            "#f9d057","#f29e2e","#e76818","#d7191c"]);

  var helix = d3.interpolateCubehelix();

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

  // append radial color gradient to new svg <defs> element
	var radialGradient = svg.append("defs").append("radialGradient")
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

// DECLARE A FEW MORE FREQUENTLY USEFUL BINDINGS FOR LATER ASSIGNMENT

  var cityState = d => { return d.city + ", " + d.state; }
  // routeSpec, initStats

// INITIATE DATA LOAD

  // Typical Mapshaper CLI transform:
    // mapshaper *filein*.geojson name=*objectunits* \
    // //    -simplify resolution=1920x1600 \
    // //    -clean \
    //     -o quantization=1e5 format=topojson mapshaped/*fileout*.json

    // more: pois incl bridges, tunnels, iNat

    // background/reference
      var admin0 = d3.json("../data/final/admin0.json"),
          admin1 = d3.json("../data/final/admin1.json"),
      // terrain = d3.buffer("../data/final/terrain.tif"),
       hydroBase = d3.json("../data/final/hydro_base.json"),
       urbanBase = d3.json("../data/final/urban_areas.json"), // add major roads?
    // rail
        railBase = d3.json("../data/final/railways.json"),
        // passRail = d3.json("../data/final/pass_railways.json"),
        railStns = d3.json("../data/final/na_main_rr_stns.json"),
       // prBuffers = d3.json("../data/final/pass_rail_buffers.json");
    // merged enrich data
       // enrichPolys = d3.json("../data/final/enrich_polys.json"),
       // enrichPolys = d3.json("../data/final/enrich_polys_slimmed.json"),
       // enrichLines = d3.json("../data/final/enrich_lines.json"),
       // enrichLines = d3.json("../data/final/enrich_lines_slimmed.json"),
       enrichPts = d3.json("../data/final/enrich_pts.json");

  // SET BOUNDING BOX
    Promise.all([admin0]) // admin0
           .then(setBounding,onError)
    // IF ATTEMPTING TO USE BOTH PREPROJECTED & UNPROJECTED DATA
      // Promise.all([admin1,admin1Proj])
      //        .then(setPPBounding,onError)
      //        .then(setBounding,onError)

  // PREP OVERLAY DATA
    // Promise.all([enrichPolys,enrichLines,enrichPts]).then(prepOverlay, onError);
    // also passRail, prBuffers?

  // DRAW RASTER BASE
    // Promise.all([terrain]).then(drawRaster, onError);

  // DRAW VECTOR BASE
    Promise.all([admin0,admin1,hydroBase,urbanBase,railBase,railStns]).then(drawBase, onError);

  // JOIN ATTRIBUTES
    // Promise.all([*,*]).then(joinAttributes,onError)


//////////////////////////
/////// FUNCTIONS ////////
//////////////////////////

//// PREPARE MAP LAYERS

  // DATA: OVERLAY / DEFS //
  function prepOverlay(data) {

    // console.log(data)

    let presimp = [];

    data.forEach(json => {
      if (json.arcs.length > 0) {
        presimp.push(topojson.presimplify(json));
      } else {
        presimp.push(json);
      }
    })

    // receive and parse data
    var polys = topojson.feature(presimp[0], presimp[0].objects.enrichPolys),
        lines = topojson.feature(presimp[1], presimp[1].objects.enrichLines),
        points = topojson.feature(presimp[2], presimp[2].objects.enrichPoints);
    // vs no presimp?
    // var polys = topojson.feature(data[0], data[0].objects.enrichPolys),
    //     lines = topojson.feature(data[1], data[1].objects.enrichLines),
    //     points = topojson.feature(data[2], data[2].objects.enrichPoints);

    // overlayers group
    var overlayers = defs.append("g")
      .attr("class","overlay overlayers")

    // append overlay data to svg <defs> element
    var enrichPolys = overlayers.append("g")
        .attr("id", "enrich-polygons")
        .attr("class", "enrich polys extract overlay group")
      .selectAll("path")
      .data(polys.features)
      .enter().append("path")
        .attr("d", path)
        .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
        .classed("enrich poly waiting", true)
        .style("fill", d => { return d3.interpolateSinebow(Math.random()); })
        .style("stroke", "none")
       // .on("intersected", highlightPoly)

    var enrichLines = overlayers.append("g")
        .attr("id", "enrich-lines")
        .attr("class", "enrich lines extract overlay group")
      .selectAll("path")
      .data(lines.features)
      .enter().append("path")
        .attr("d", path)
        .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
        .classed("enrich line waiting", true)
        .style("stroke", d => { return d3.interpolateWarm(Math.random()); })
        .style("stroke-width", 1.6)
        .style("fill", "none")
       // .on("intersected", highlightLine)

    // console.log(enrichLines.nodes())

    var enrichPoints = overlayers.append("g")
        .attr("id", "enrich-points")
        .attr("class", "enrich points extract overlay group")
      .selectAll("circle")
      .data(points.features)
      .enter().append("circle")
        .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
        .attr("r", 1)
        .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
        .classed("enrich point waiting", true)
        .style("fill", d => { return d3.interpolateCool(Math.random()); })
        .style("stroke", d => { return d3.interpolateGreys(Math.random()); })
        .style("stroke-width", 0.4)
       // .on("intersected", highlightPt)

  }

  // DATA: MESH / BASE //
  function drawBase(data) {

    // console.log(data)

    // presimplified and converted as relevant/possible
    let sourceData = new Object();

    data.forEach(datum => {
      // if (datum instanceof ArrayBuffer) {
      //   // SPECIAL HANDLING FOR GEOTIFF
      //   sourceData.terrain = {
      //     tif: datum
      //   };
      // }
      if (datum["type"] == "Topology") {
        let oKey = Object.keys(datum.objects)[0],  // object key
           sdKey = oKey;                           // sourceData key (to distinguish multiple TJ's with objects of same name)
        if (sourceData[sdKey]) { sdKey += "2" };
        // if (datum.arcs.length > 0) {
        //   sourceData[sdKey] = {
        //     tj: topojson.presimplify(datum) // QUESTION is this helpful?
        //   };
        //   // mesh: getMesh(sourceData[sdKey],oKey) was here
        // } else {
        //   // NOTE: don't try to presimplify points!
        sourceData[sdKey] = {
          tj: datum
        },
        // }
        // regardless
        sourceData[sdKey].gj = getGj(sourceData[sdKey],oKey);
      } else {  // if not topojson, assume already geojson
        sourceData[datum.name] = {
          gj: datum
        }
      }
    });

    // CUSTOM, ADDITIONAL, SPECIFIC, COMPLEX, ETC

    // MESH SELECT
    let lakeMesh = getMesh(sourceData.hydroLines,"hydroLines", (a,b) => { return a.properties.strokeweig === null }),
       urbanMesh = getMesh(sourceData.urbanAreas,"urbanAreas"),
   continentMesh = getMesh(sourceData.countries,"countries",outerlines()),
   countriesMesh = getMesh(sourceData.countries,"countries",innerlines()),
      statesMesh = getMesh(sourceData.states,"states",innerlines());
    // passRailMesh = getMesh(sourceData.passRailways,"passRailways");

    console.log("* base data *")
    console.log(sourceData)

    // define svg groups
    var baselayers = g.append("g")
      .attr("class", "base basemap baselayers")
    var adminBase = baselayers.append("g")
      .attr("id", "admin-base")
    var hydroBase = baselayers.append("g")
      .attr("id", "hydro-base")
    var urbanBase = baselayers.append("g")
      .attr("id", "urban-base")
    var railBase = baselayers.append("g")
      .attr("id", "rail-base")

    // FILLED MESH
    // var continent =
    adminBase.append("path")
      .attr("d", path(continentMesh))
      .style("stroke","darkslategray")
      .style("stroke-width",0.2)
      .style("stroke-opacity",0.8)
      .style("fill","dimgray")

    // var lakeMesh =
    hydroBase.append("path")
      .attr("id", "lake-mesh")
      .attr("d", path(lakeMesh))
      .style("fill","cyan")
      .style("stroke","teal")
      .style("stroke-width",0.1)
      .style("opacity",0.6)
      .style("stroke-opacity",1)

    // var urbanAreas =
    urbanBase.append("path")
      .attr("id", "urban-areas")
      .attr("d", path(urbanMesh))
      .attr("stroke","silver")
      .attr("fill","gainsboro")
      .style("stroke-width",0.1)
      .style("opacity",0.4)

    // STROKED MESH
    // var countryBorders =
    adminBase.append("path")
      .attr("id","country-borders")
      .attr("d", path(countriesMesh))
      .style("fill","none")
      .style("stroke","yellowgreen")
      .style("stroke-width",0.6)

    // var stateBorders =
    adminBase.append("path")
      .attr("id","state-borders")
      .attr("d", path(statesMesh))
      .style("fill","none")
      .style("stroke","magenta")
      .style("stroke-width",0.4)
      .style("stroke-dasharray", "0.2 0.4")

    // var passRailways =
    // railBase.append("path")
    //   .attr("id","pass-railways")
    //   .attr("d", path(passRailMesh))
    //   .style("fill","none")
    //   .style("stroke","lightsteelblue")
    //   .style("stroke-width",0.6)
    //   // .style("stroke-dasharray", dash1)

    // STROKED FEATURES
    // var rivers =
    hydroBase.append("g")
      .attr("id", "rivers")
      .selectAll("path")
      .data(sourceData.hydroLines.gj.features.filter(d => { return d.properties.strokeweig !== null }))
      .enter().append("path")
        .attr("d", path)
        .style("fill","none")
        .style("stroke","teal")
        .style("stroke-width", d => { return d.properties.strokeweig })

    // var railways =
    railBase.append("g")
      .attr("id", "railways")
      .selectAll("path")
      .data(sourceData.railways.gj.features)
      .enter().append("path")
        .attr("d", path)
        .attr("stroke-width", d => { return (8/(d.properties.scalerank * 4)) }) // 10/(d.properties.scalerank ** 2)
        .attr("stroke","lightslategray")
        .style("fill", "none")
        .style("opacity",0.95)
        // .attr("class", d => { return "rendered railway " + d.properties.scalerank.toLocaleString(); } )

    // POINT FEATURES
    // var stations =
    railBase.append("g")
      .attr("id", "rail-stations")
      .selectAll("circle")
      .data(sourceData.stations.gj.features)
      .enter().append("circle")
        .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
        .attr("r", 0.8)
        .style("fill", "#f13131")
        .style("stroke","#36454F")
        .style("stroke-width",0.1)
        // .attr("class", d => {
        //   console.log(d.properties)
        //   return "rail station point rendered " + d.properties.city + " " + d.properties.country })

    // sort stations by city name
    sourceData.stations.gj.features.sort( (a,b) => {
      return a.properties.city > b.properties.city;
    });

    // create new allStations array by extracting sorted, slimmed railStns properties
    var allStations = sourceData.stations.gj.features.map( (d,i) => {
      let props = d.properties, // shorthand
        stnCode = i.toLocaleString().padStart(3,"0"),
        station = {
          id: stnCode,
          city: props.city,
          state: props.state ? props.state : props.province,
          country: props.country
        };
      return station;
    });

    populateOptions(allStations);

  }


// PIZAZZ: TOOLTIPS
  // function makeTooltip() {
  //   // Create new html div element to house the tooltip and give it a class so css can hide with opacity
  //   var tooltip = d3.select("body").append("div")
  //     .attr("class", "tooltip")
  //
  //   var tooltipInfo = getTooltip(props,percentVal,currentYear);
  //
  //   // call drawLegend function
  //   drawLegend(svg, width, height)
  //
  // }

  function bindTooltip(parent){
    // bind a tooltip to the layer with geography-specific information
    parent.bindTooltip(tooltipInfo, {
      // sticky property so tooltip follows the mouse
      sticky: true,
      tooltipAnchor: [200, 200]
    });

    parent.on('mouseover', function(e) {
      e.target.setStyle({
        color: 'greenyellow',
        fillColor: 'honeydew',
        fillOpacity: 0.7
      }).bringToFront()
      .openTooltip();
    });

    parent.on('mouseout', function(e) {
      dataLayer.resetStyle(e.target);
      e.target.setStyle({
        fillColor: colorize(percentVal)
      }).closeTooltip();
    });

    parent.on("mouseover", onMouseover())

  }

  function onMouseover() {
    d3.select(this).classed("hover", true).raise();
    tooltip.style("opacity",1).html(getTooltipContent(d))
  }
  function onMouseout() {
    d3.select(this).classed("hover", false) // remove the class
    tooltip.style("opacity", 0)  // hide the element
  }
  function positionTooltip(event) {
    // update the position of the tooltip relative to location of mouse event (offset 10,-30)
    tooltip.style("left", (d3.event.pageX + 10) + "px")
      .style("top", (d3.event.pageY - 30) + "px");
  }
  // PIZAZZ: COLOR
  // PIZAZZ: TRANSITIONS

// Map animation, experience, encounters, triggers

  // spur data refresh?, start/end/midpoint?
  // on.("encountered", output(encounter)) // FIXME PSEUDOCODE
    // temp popups/tooltips fade in/out
    // legend-log populated
    // dashboard/trackers updated
    //

  function flashName(e,t) {
    console.log(this)
    console.log(e)
    console.log(t)
    // .each(flashName(d,i)) {
    //
    // }
  }
  //   .on("mouseover", function raiseTooltip(d,i,e) {
  //     console.log(d)
  //     console.log(i)
  //     console.log(e)
  //     // div.transition()
  //     //     .duration(200)
  //     //     .style("opacity", .9);
  //     // div	.html(formatTime(d.date) + "<br/>"  + d.close)
  //     //     .style("left", (d3.event.pageX) + "px")
  //     //     .style("top", (d3.event.pageY - 28) + "px");
  //     // })
  // }

  // Dashboard Interaction


// ~ : if applicable

//// KAFUNK'S SEMI-GENERALIZABLE WEBMAP APPLICATION OUTLINE

  // D3 DYNAMISM
    // Declare function expressions for later use
    // Colors, scales, tweens, etc

  // SET UP MAP / SVG / CANVAS

  // SET UP THE DATA LANDSCAPE
    // INITIATE ASYNC DATA LOAD
      // OVERLAYERS
      // BASE
    // KEEP TRACK OF THINGS
      // Classes, Instances, Objects
        // Layers
          // function addLayer(data) { // ( | type,options)
            // id/nickname:
            // baselayer/overlayer flag
            // type: geojson, topojson, shapefile
            // actual data
            // metadata:
              // geom type: point, line, polygon
              // subtype1: symbol, linestring, multilinestring
              // subtype2: interior borders, state, counties?
              // source: file/link/citation
                // access details
                // transform/hx details
            // options: {attributes}
            // layout flags:
              // e.g., for train point! icon-image: "<name/source>", "icon-rotate": ["get","bearing"], "icon-rotatation-alignment": "map", icon-allow-overlap: true}  *** SEE / ADAPT MAPBOX GL SOURCECODE?
          // }
        // Layer Groups
        // Views/Frames
        // Currently Rendered

  // SET UP UI
    // PREPARE INITIAL EVENT LISTENERS
    // PROMPT USER FOR INITIAL OPTIONS
      function initPrompt() {
        d3.select("#modal").classed("none",false);
      }

  // AWAIT NEW INFORMATION

////  ===>  FUNCTIONAL LOOP STRUCTURE STARTS/RESUMES HERE  <===  (*)(*)(*)

  // RECEIVE NEW INFORMATION
    // direct event listeners
    // // initial user customization
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

        if (!seemsValid([opt0,opt1])) return false; // throw error?

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
              } else {
                updateMap(newData[0])
              }

            }, onError);

          }

        }, onError);

      }

  // ACKNOWLEDGE NEW INFORMATION I
    // the fact of it
      // function iFeelYou(*) : wheel & touch events
      //  function iSeeYou(*) : mouse & scroll events
      // function iHearYou(*) : click events & form input

  // PROCESS NEW INFORMATION
    // API/complex
      // VALIDATE CLIENT-SIDE AS POSSIBLE
        function seemsValid(input) {
          // for now!
          return true;
        }
      // ASSUME WE'RE GOOD
        // provide user feedback that map content is loading
        function toggleLoading() {
          d3.select("#modal").classed("none", true);
          d3.select("#map-init-load").classed("none", false);
        }
        // prevent window reprompt on apps with lots of moving parts
        function localStore() {
          // add somewhere to prevent reprompt
          localStorage.optionsReceived = true;
        }
      // QUERY API IF USING
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

            // // add to ongoing list of mismatches
            // d3.json("../data/mismatches.json").then(function(json) {
            //   var mismatch = new Blob([JSON.stringify(data,null,2)], {type: "text/plain;charset=utf-8"});
            //   saveAs(mismatch, "../data/mismatches.json");
            // }, onError);

            // alert user
            window.alert(`No rail-only route found between ${data.places[0].shortName} and ${data.places[1].shortName}. Please try another combination!`)

            return null;

          }

          // OTHERWISE
          return data;

        }

      // so do it!
        function processReceived(data) {
          var parsed = parseReceived(data),
            enriched = enrichRoute(parsed);
            //  attuned = attuneRoute(parsed),
            // enriched = enrichRoute(attuned);

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
            mileMarkers() { return this.getMileMarkers(); },
            arcPts() { return getArcPts(this.lineString,this.totalDistance); },
            ticks: {},
            queryChunks: newFeatureCollection(),
            // quadtree: d3.quadtree(),
            overallBearing: turf.bearing([places[0].lng,places[0].lat],[places[1].lng,places[1].lat]),
            gj: gj,
            getPath() { return g.select("#full-route").attr("d"); },
            getPathLength() { return this.getPath().node().getTotalLength(); },
            getBounds() { return path.bounds(this.lineString); },
            getProjectedGj() {
              let segments = this.segments;
              let projectedSegments = [];
              for (var i = 0; i < segments.length; i++) {
                let wgsCoords = segments[i].lineString.coordinates,
                  projectedCoords = [];
                wgsCoords.forEach(coord => {
                  projectedCoords.push(projection(coord));
                });
                projectedSegments = projectedSegments.concat(projectedCoords);
              }
              return turf.lineString(projectedSegments);
            },
            getMileMarkers() {
              let miles = Math.floor(this.totalDistance);
              this.mileMarkers = [...getBreaks(this.lineString,this.totalDistance,miles)].map(point => projection(point));
              return this.mileMarkers;
            }
          }

          // PATH NODES / SEGMENTS (to interpolate b/t orig and destination at regular, arbitrary intervals)
          // let miles = Math.floor(thisRoute.totalDistance);
          // thisRoute.mileMarkers = [...getBreaks(thisRoute.lineString,thisRoute.totalDistance,miles)].map(point => projection(point));

          // OVERLAPPING BBOX CHUNKS (in order)
          let queryChunks = 5,
              chunkBreaks = [...getBreaks(thisRoute.lineString,thisRoute.totalDistance,queryChunks)].map(point => projection(point));
          for (var i = 0; i < chunkBreaks.length-1; i ++) {
            let line = turf.lineString([chunkBreaks[i],chunkBreaks[i+1]]);
            let bbox = turf.bbox(line);
            let bboxPolygon = turf.bboxPolygon(bbox);
            thisRoute.queryChunks.features.push(bboxPolygon);
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

          // ALL TICKS
          for (var i= 0; i < thisRoute.mileMarkers.length; i++) {
            thisRoute.ticks[i] = {
              point: thisRoute.mileMarkers[i],
              coords: projection.invert(thisRoute.mileMarkers[i]),
              getPrevPt() { return thisRoute.mileMarkers[i-1] || this.point },
              getPrevCoords() { return projection.invert(this.getPrevPt()) },
              getNextPt() { return thisRoute.mileMarkers[i+1] || this.point },
              getNextCoords() { return projection.invert(this.getNextPt()) },
              getBearing() {
                return turf.bearing(this.getPrevCoords(),this.getNextCoords());
                // return turf.bearing(this.getPrevPt(),this.getNextPt());
              },
              getRotate() {
                let angle = this.getBearing();
                if (Math.sign(angle) == -1) {  // if angle is negative
                  angle += 360;
                }
                // let rotate = perpendicular(angle);
                // return rotate;
                return angle;
              }
              // getAzimuth()
              // getOrientation() // cardinal
              // getElevation()
              // getIntersecting()
              // scanned
              // selected
            }
          }

          return thisRoute;

        }

    // UI direct

  // ACKNOWLEDGE NEW INFORMATION II
    // the processed content
      // function iGotYou(*) { }

  // INTEGRATE NEW INFORMATION
    // // INITIAL
      function initExp(chosen) {

        experience.initiated = true;

        let sT = 2400; // standard transition time

        // zoomTo padded bounds of chosen route
        let routeCoords = chosen.lineString.geometry.coordinates;
        let routeBounds = getIdentity(getTransform(path.bounds(paddedBounds(routeCoords)))),
                     k0 = routeBounds.k,
                centerPt = turf.center(turf.explode(chosen.lineString)),
              identity0 = getIdentity(centerTransform(projection(centerPt.geometry.coordinates),k0));

        console.log(routeBounds)
        console.log("vs")
        console.log(identity0)

        // control timing with transition start/end events
        svg.transition().duration(sT*2).ease(d3.easeCubicIn)
          .call(zoom.transform, identity0) //routeBounds)
          .on("start", () => {
            drawRoute(chosen,sT);
          })
          .on("end", () => {
            // confirm g transform where it should be
            g.attr("transform",identity0.toString())//routeBounds.toString())
            // pause (offer route overview here?) then zoom to firstFrame
            d3.timeout(() => {
              initAnimation(chosen);
            }, sT);
          })

      }

      function drawRoute(received,sT) {

        d3.select("#veil").transition()
          .duration(sT)
          .style("opacity", 0)
          .on("end", hide)

        d3.select("#map-init-load").transition()
          .delay(sT/2)
          .duration(sT/2 - 200)
          .style("opacity", 0)
          .on("end", hide)

        // d3.select("#dashplus").transition()
        //   // .delay(sT/2)
        //   // .duration(sT * 2)
        //   .style("opacity", 1)
        //   .on("end", show)

        // draw faint stroke along returned route
        var journey = g.append("g")
          // .classed("overlayers overlay rail route experience journey current", true)
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

        // remove non-chosen station points
        var allStns = g.select("#rail-stations").selectAll("circle");

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

        let arcPts = received.arcPts();
            // mileMarkers = received.mileMarkers;

        // LINE/ROUTE
        // faint underlying solid
        route.append("path")
          .datum(arcPts)
          .attr("d", line)
          .style("fill","none")
          .style("stroke", "#4F4036")
          .style("opacity", 0.8)
          .style("stroke-width",0.5)

        // setup path for dashed stroked interpolation
        var fullRoute = route.append("path")
          .attr("id", "full-route")
          .datum(arcPts)
          .attr("d", line)
          .style("fill", "none")
          .style("stroke", "orangered")
          .style("stroke-width", 0.4 )
          .style("opacity",0)
          .style("stroke-dasharray", dash0)
          .style("stroke-linecap", "round")

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

        // overlay of ticks/ties @ arcPts
        let rrTies = route.append("g")
          .attr("id","rr-ties")
          .append("path")
          .attr("d", line(arcPts))
          .style("fill", "none")
          .style("stroke", "slateblue")
          .style("stroke-width",0.6)
          .style("stroke-dasharray", dash1)

      }

      // Relate route waypts/nodes/links to spatially intersecting (given buffer) data for interesting and illuminating route experience
      function enrichRoute(data) {

        let enriched = queryData(data);

        return enriched;

      }

      // ENRICH DATA
      function queryData(chosen) {

        let bufferedRoute = buffer(chosen.lineString);

        g.append("path")
          .attr("id","route-buffer")
          .attr("d", line(bufferedRoute.geometry.coordinates[0].map(d => projection(d))))
          .attr("fill","none")
          .attr("stroke","none")
          // .attr("fill","slateblue")
          // .attr("stroke","black")

        let enriched = Promise.all([/*enrichPolys,enrichLines,*/enrichPts]).then(filterEnriching,onError);

        return enriched;

        function filterEnriching(data) {

          // console.log(data)

          // let allPolys = topojson.feature(data[0], data[0].objects.enrichPolys),
          // let allLines = topojson.feature(data[1], data[1].objects.enrichLines),
          // allPts = topojson.feature(data[2], data[2].objects.enrichPts);

          let allPts = topojson.feature(data[0], data[0].objects.enrichPts);

          let filteredPts = allPts.features.filter(d => {
            return turf.booleanPointInPolygon(d.geometry,bufferedRoute);
          });

          // let singleLines = allLines.features.filter(d => {
          //   return d.geometry.type === "LineString" && turf.booleanCrosses(d.geometry,bufferedRoute);
          // });
          //
          // let multiLines = allLines.features.filter(d => {
          //   return d.geometry.type === "MultiLineString"
          //   // 'multilines not supported'
          //   // && turf.booleanCrosses(d.geometry,bufferedRoute);
          // });
          //
          // // explode multilinestrings
          // let explodedLines = newFeatureCollection();
          //
          // // enter each multiline feature
          // for (var i = 0; i < multiLines.length; i++) {
          //   // for each coordinate array / line segment within multiline
          //   for (var j = 0; j < multiLines[i].geometry.coordinates.length; j++) {
          //     // separate parts into individual features
          //     let segment = makeFeature(multiLines[i].geometry.coordinates[j], "LineString");
          //     // transfer props, too
          //     segment.properties = multiLines[i].properties;
          //     explodedLines.features.push(segment);
          //   }
          // }
          //
          // // then filter exploded multilines
          // let moreLines = explodedLines.features.filter(d => {
          //   return turf.booleanCrosses(d.geometry,bufferedRoute);
          // });
          //
          // // combine all intersecting initial lines and intersecting multiline segments
          // let filteredLines = singleLines.concat(moreLines);

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

          // console.log(filteredPts)
          // console.log(filteredLines)
          // console.log(filteredPolys)

          // tag all filtered features with type spec id
          // eg, id: i.toFixed().padStart(3,'0')

          // add filtered enrich data to <defs> with full geometry, relevant properties, and type-spec id for triggerPt crosswalk
          populateDefs(filteredPts/*,filteredLines,filteredPolys*/)

          // get specific trigger intersection pts for spatial search algorithm
          // let triggerPts = getTriggerPts(filteredPts,filteredLines,filteredPolys,chosen.lineString,bufferedRoute)
          // temporary while polys/lines out of this
          let triggerPts = filteredPts;

          chosen.enrichData = {
            triggerPts: triggerPts,
          withinBuffer: bufferedRoute
          }

          console.log(chosen)

          return chosen;

        }

        // append overlay data to svg <defs> element
        function populateDefs(pts/*,lines,polys*/) {

          var overlayers = defs.append("g")
            .attr("class","overlay overlayers")

          // var enrichPolys = overlayers.append("g")
          //     .attr("id", "enrich-polygons")
          //     .attr("class", "enrich polys extract overlay group")
          //   .selectAll("path")
          //   .data(polys)
          //   .enter().append("path")
          //     .attr("d", path)
          //     .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
          //     .classed("enrich poly waiting", true)
          //     .style("fill", d => { return d3.interpolateSinebow(Math.random()); })
          //     .style("stroke", "none")
          //    // .on("intersected", highlightPoly)
          //
          // var enrichLines = overlayers.append("g")
          //     .attr("id", "enrich-lines")
          //     .attr("class", "enrich lines extract overlay group")
          //   .selectAll("path")
          //   .data(lines)
          //   .enter().append("path")
          //     .attr("d", path)
          //     .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
          //     .classed("enrich line waiting", true)
          //     .style("stroke", d => { return d3.interpolateWarm(Math.random()); })
          //     .style("stroke-width", 1.6)
          //     .style("fill", "none")
          //    // .on("intersected", highlightLine)

          var enrichPoints = overlayers.append("g")
            .attr("id", "enrich-points")
            // .attr("class", "enrich points extract overlay group")
            .selectAll("circle")
            .data(pts)
            .enter().append("circle")
              .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
              .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
              .attr("r", 1)
              .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
              .classed("enrich point waiting", true)
              .style("fill", d => { return d3.interpolateCool(Math.random()); })
              .style("stroke", d => { return d3.interpolateGreys(Math.random()); })
              .style("stroke-width", 0.4)
             // .on("intersected", highlightPt)

          // console.log(enrichPoints.node())

        }

        function getTriggerPts(pts,lines,polys,route,buffer){

          let polyIntersectPts = polys.map((d,i) => {
            // get first interesect pt in direction of travel + type-spec id
            console.log(d)
            let pt = {
              id: d.properties.id,
              type: "polygon",
              coords: turf.lineIntersect(d.geometry,route) || closestTriggerPt()
            };
            return pt;
          })
          let lineIntersectPts = lines.map((d,i) => {
            console.log(d)
            let pt = {
              id: d.properties.id,
              type: "line",
              coords: turf.lineIntersect(d.geometry,route) || closestTriggerPt()
            };
            return pt;
          })

          // if remaining pts that intersected route buffer but NOT actual route, allow nearest point on line to trigger animation
          function closestTriggerPt() {
            let bufferIntersect = turf.lineIntersect(this,buffer),
                        snapped = turf.nearestPointOnLine(route,bufferIntersect, {units: 'miles'});
            return snapped;
          }

          let allTriggerPts = pts.concat(lineIntersectPts).concat(polyIntersectPts);

          return allTriggerPts;

        }

      }

      function makeQuadtree(triggerData,bufferedRoute) {
        // search and nodes functions taken from https://bl.ocks.org/mbostock/4343214

        // get projected bounding box of chosen route
        let pathBox = path.bounds(bufferedRoute)
                 x0 = pathBox[0][0], // xmin
                 y0 = pathBox[0][1], // ymin
                 x1 = pathBox[1][0], // xmax
                 y1 = pathBox[1][1]; // ymax
                 // rx = x1 - x0,       // box width
                 // ry = y1 - y0;       // box height

        // initiate quadtree with specified x and y functions
        const projectX = d => { return projection(d.geometry.coordinates)[0] },
              projectY = d => { return projection(d.geometry.coordinates)[1] };

        quadtree = d3.quadtree(triggerData,projectX,projectY)
                     .extent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])

        let grid = g.append("g")
                    .attr("id","nodes")
                    .selectAll(".quadnode")
                    .data(nodes(quadtree))
                    .enter().append("rect")
                      .classed("quadnode", true)
                      .attr("x", function(d) { return d.x0; })
                      .attr("y", function(d) { return d.y0; })
                      .attr("width", function(d) { return d.y1 - d.y0; })
                      .attr("height", function(d) { return d.x1 - d.x0; })
                      .style("fill","none")

        let triggerPts = g.append("g")
                          .attr("id","trigger-pts")
                          .selectAll(".trigger-pt")
                          .data(triggerData)
                          .enter().append("circle")
                            .classed("trigger-pt", true)
                            .classed("trigger-pt--scanned trigger-pt--selected", false) // for now
                            .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
                            .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
                            // temporary visual
                            .attr("r", 0.8)
                            .style("fill","chartreuse")
                            .style("stroke","goldenrod")
                            .style("stroke-width","0.1px")

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

      function intersectingDefs(all) {

      }

      function useDefs() {

          defs.append("use")
              .attr("xlink:href", "#watersheds");
          // svg.append("use")
          //   .attr("xlink:href", "#watersheds")
          g.append("use")
            .attr("id", "enrich-pool")
            .attr("xlink:href", "#watersheds")
            // .attr("d",path)
            // .attr("class", "stroke")
            // .attr("stroke-dasharray", "1 1")
            // .attr("stroke-width", 1.6)
            // .attr("stroke", "teal")
            // FILTER

          console.log(d3.select("#enrich-pool"))

          console.log(g.node())
          console.log(defs.node())
      }

      // function enrich(newRoute) {
        // receive object of waypts/nodes/links
        // cluster basic route elements (links/nodes) in a way that makes sense [Q: optimization](#optimization)
        // retrieve BBoxes for route clusters
        // filter all enrichData to elements within these BBoxes
          // function retrievePotentiallyIntersecting(routeClustersBBoxes) {
          //       // return selection to inspect further
          //     }
        // potentiallyIntersectingPOLYGONS ONLY (I think this will be most efficient):
          // iterate through polygons,compare with entireline of route;
            // for those polygons that indicate ANY intersection,
              // retrieve routeNode at polygonEnter
              // retrieve routeNode at polygonExit
        // iterate through all route nodes (including those already containing polygon enter/exit points)
          // use specific intersect queries to pair remaining potentiallyIntersecting elements (lines/points) with each route node
          // function retrieveIntersecting(routeNodes,potentialIntersectClusters) {
          //       // compare each node to remaining potentialIntersect data (again, optimize this somehow! not all railNodes/allPOIs; not Wisconsin to California):
          //         // run specific queries with turf.js (or even just stick with d3 since it can clearly do everything?)
          //         // store references to matching points/lines for each node (there will be crossover/overlap: all nodes with radius of point, all intersections of line and line)
          //     }
        // return completely enriched route object
      // }

      function initAnimation(routeObj){

        // SHOULD ALREADY BE ZOOMED TO ROUTE BOUNDS, NO MODAL, ETC
        let length = Math.floor(routeObj.totalDistance),
               int = 100 // miles in/out to focus view, start/stop zoomFollow

        // setupAnimation()
        let point = g.select("#train-point"),
             path = g.select("#full-route");

        // setupExtras()
          // setup legend
          // setup Tooltips
          // setup dashboard
          // initiate certain event listeners

        // prepareUser() // provide countdown/feedback to user

        let simpOptions = {tolerance: 1, highQuality: false, mutate: true},
               fullSimp = turf.simplify(routeObj.lineString,simpOptions);

        let simpSlice,
            firstLast,
            simpLength = Math.floor(turf.length(fullSimp, {units: "miles"}));

        if (simpLength > 300) {
          firstLast = getFirstLast(fullSimp,int);

          // clip path between center of first and center of last (100m in/out)
          // console.log("route longer than 300 miles. first & last coord trios: ")
          // console.log(firstLast)
          // let in100 = firstLast[0][1],
          //    out100 = firstLast[1][1];

          simpSlice = turf.lineSlice(firstLast[0][1],firstLast[1][1],fullSimp);

          // firstFocus = simpSlice.geometry.coordinates[0],
          // lastFocus = simpSlice.geometry.coordinates[simpSlice.geometry.coordinates.length-1];

          // similar but not exact
          // console.log(in100)
          // console.log(firstFocus)
          // console.log(out100)
          // console.log(lastFocus)

          // update firstLast with exact 100in/100out focus coordinates
          firstLast[0][1] = simpSlice.geometry.coordinates[0],
          firstLast[1][1] = simpSlice.geometry.coordinates[simpSlice.geometry.coordinates.length-1];

        } else {
          let both = [fullSimp.geometry.coordinates[0],turf.along(fullSimp,simpLength/2,{ units: "miles" }).geometry.coordinates.map(d => +d.toFixed(2)),fullSimp.geometry.coordinates[fullSimp.geometry.coordinates.length - 1]];
          // aka first, middle, last

          // console.log("short route (< 300 miles). start/end zoom identical.")
          // console.log([both,both])

          simpSlice = fullSimp,
          firstLast = [both,both];
        }

          let zoomArc = g.append("path")
            .attr("id", "zoom-arc")
            .datum(simpSlice.geometry.coordinates.map(d => projection(d)))
            .attr("d", line)
            .style("fill","none")
            .style("stroke","none")
            // uncomment below for visual of zoomArc
              // .style("stroke", "rebeccapurple")
              // .style("stroke-width",2)

        // tprm hard coded as goal of animated ms per route mile;
        // tpsm is based on same, calculated per simplified miles
        let tprm = 40, // harded coded as goal of animated ms per route mile (more == slower)
            tpsm = tprm * length / simpLength;

        // depart(train)
          // if (experience.animating)
          // while (experience.animating)
          // transition automatically after user prep
          // if (confirm("Ready?")) {
            experience.animating = true;
            goTrain(point,path,zoomArc,tprm,tpsm,simpLength,firstLast,routeObj.enrichData);

          // set up select event listeners
            d3.select("#replay").on("click", () => {
              let pausedAt = projection.invert(pauseTrain()),
                 traversed = turf.lineSlice(firstLast[0][0],pausedAt,routeObj.lineString),
              reversedPath = makeFeature(traversed.geometry.coordinates.slice().reverse(), "LineString"),
               reversedArc = makeFeature(turf.lineSlice(firstLast[0][0],pausedAt,fullSimp).geometry.coordinates.slice().reverse(), "LineString"),
                   rewindT = turf.length(traversed, {units: "miles"}) * tpm/2;

              g.transition().duration(rewindT)
                .on("start", rewindAll(point,traversed,reversedPath,reversedArc,rewindT))
                .on("end", () => {
                  // confirm g exactly in alignment for next transition
                  g.attr("transform",firstIdentity.toString())
                  // restart with same data

                  goTrain(point,path,zoomArc,tprm,tpsm,simpLength,firstLast)
                })
            });
          // }

      }
      function rewindAll(point,path,reversedPath,reversedArc,t) {  // enrichRendered)

        point.transition().delay(3000).duration(tFull).ease(d3.easeLinear)
        		 .attrTween("transform", translateAlong(reversedPath))
             // point transition triggers additional elements
             .on("start", () => {
               path.transition().duration(t).ease(d3.easeLinear)
                 .styleTween("stroke-dasharray",dashBack)
               g.transition().duration(t).ease(d3.easeLinear)
                 .attrTween("transform", zoomAlong(reversedArc)) //,scale))
             })
      }
      // function followAlong() {
      //   use train pt location for numerous checks/adjustments
      // }
      function getFirstLast(fullLine,int) {

        // turf.js returning same three coordinates at distance - 200, distance - 100, distance;
        // reversing instead
        let fullLineReversed = makeFeature(fullLine.geometry.coordinates.slice().reverse(), "LineString");

        let firstThree = threePts(fullLine,int),
             lastThree = threePts(fullLineReversed,int).reverse();

        // confirm in alignment with first and last pts
        // console.log(firstThree)
        // console.log(lastThree)
        // console.log(fullLine.geometry.coordinates[0])
        // console.log(fullLine.geometry.coordinates[fullLine.geometry.coordinates.length-1])

        return [firstThree,lastThree];

      }

      function getIdentity(atTransform,k) {
        let identity = d3.zoomIdentity
          .translate(atTransform.x,atTransform.y)
          .scale(k || atTransform.k)  // if (k), k || (keep k constant?)
        return identity;
      }

      function centerTransform(pt,scale) {
        let tx = -scale * pt[0] + width/2,
            ty = -scale * pt[1] + height/2;
        return {x: tx, y: ty, k: scale};
      }
      // function transformed(b,k) {
      //   // console.log("from bbox => string")
      //   return getIdentity(getTransform(b),k).toString()
      // }

      // function centerView(distance,fullLine) {
      //
      // // // clip projected data to minimize shift/render calculations
      // // let clipExtent = [[-(tx ** 2), -(ty ** 2)], [tx ** 2, ty ** 2]]; // extended for leeway around edges
      // // identity.clipExtent(clipExtent) //
      // // projection.clipExtent(clipExtent)
      //
      //   let interval = 100,
      //       chunkNum = Math.ceil(distance/interval),
      //       breakNum = chunkNum/2 + 1,
      //     zoomChunks = getZoomChunks(fullLine,interval,breakNum),
      //              k = getTransform(zoomChunks[0]).k, // define stable k across all zoomChunks
      //             tt = distance * 4,
      //            ttt = tt/zoomChunks.length;
      //          // tt = t/breakNum;
      //
      //         // console.log(ttt)
      //         // console.log(tt)
      //         // console.log(t)
      //
      //   // function testing() {
      //   //   // let ia = d3.interpolateArray(chunks[i][0],chunks[i+1][0]),
      //   //   //     ib = d3.interpolateArray(chunks[i][1],chunks[i+1][1]);
      //   //   let startTransform = getIdentity(getTransform(zoomChunks[0]),k),
      //   //       finalTransform = getIdentity(getTransform(zoomChunks[zoomChunks.length-1]),k);
      //   //   g.attr("transform",startTransform.toString())
      //   //    .transition().duration(tt*4)
      //   //      .attr("transform",finalTransform.toString())
      //   // }
      //
      // //   function initZoom(chunks,i = 0) {
      // //
      // //     let currentTransform = function(i) {
      // //       return getIdentity(getTransform(chunks[i]),k);
      // //     }
      // //     startTransform = getIdentity(getTransform(chunks[0]),k),
      // //     finalTransform = getIdentity(getTransform(chunks[chunks.length-1]),k);
      // //
      // //     g.transition()//.delay(1000).duration(tt*2) // TOTAL MILES * F
      // //         // .attr("transform", // initial transform? final transform?)
      // //       .on("start", function () {
      // //         svg.on('.zoom',null)  // disable free zooming
      // //         zoomAlong(i)
      // //         function zoomAlong(i) {
      // //           console.log("zooming along " + i)
      // //           let ia = d3.interpolateArray(chunks[i][0],chunks[i+1][0]),
      // //               ib = d3.interpolateArray(chunks[i][1],chunks[i+1][1]);
      // //           g.attr("transform",currentTransform(i).toString())
      // //             .transition().duration(ttt).ease(d3.easeLinear)
      // //               .attrTween("transform", () => { return t => { return transformed([ia(t),ib(t)],k); } })
      // //               .on("end", function () {
      // //                 console.log("end " + i)
      // //                 i++
      // //                 if (i < chunks.length - 1) { // bc new start relies on value of chunks[i+1]
      // //                   zoomAlong(i);
      // //                 } else {
      // //                   wrapUp();
      // //                 }
      // //               })
      // //         }
      // //       })
      // //       function wrapUp() {
      // //         console.log("destination reached")
      // //         // remove all transitions from g?
      // //         // align d3 zoom behavior with final transform value and reenable free zooming
      // //         svg.call(zoom.transform, finalTransform)
      // //            .call(zoom)
      // //       }
      // //     }
      // //
      // //   // initZoom(zoomChunks) // call elsewhere?
      // //   // testing()
      // //
      // //   return zoomChunks;
      // //   // return zoomAlong(zoomChunks)
      // //
      // }

      // receives unprojected coords, finds bbox of three received coords and pads returned bbox to ensure all three remain well within zoom frame
      function paddedBounds(ptArray) {
        let bbox = turf.bbox(turf.lineString(ptArray))
        // 2% SVG padding (adjusted for y reflection)
        let padded = [[bbox[0]*1.02,bbox[1]*0.98], [bbox[2]*0.98,bbox[3]].map(pt => pt*1.02)],
          paddedGj = turf.lineString(padded);
        return paddedGj.geometry;  // returns GJ with padded, unprojected bounding coordinates
      }

      // returns three points along route; origin | trailing corner, zoom focus, leading corner | destination
      function threePts(fullLine,int,i = 0) {
        let miles = { units: 'miles' }; // turf unit options
        let pt0 = turf.along(fullLine,int*i,miles).geometry.coordinates,
            pt1 = turf.along(fullLine,int*i+int,miles).geometry.coordinates,
            pt2 = turf.along(fullLine,int*i+2*int,miles).geometry.coordinates;

        // toFixed() rounds... truncate instead?
        return [pt0.map(d => +d.toFixed(5)),pt1.map(d => +d.toFixed(5)),pt2.map(d => +d.toFixed(5))];
      }

      // // returns array of breakNum projected bounding boxes
      // function getZoomChunks(fullLine,int,breakNum) {
      //   // simplify / replace with [...getBreaks(fullLine,length,chunkNum)].map(point => projection(point)); ?
      //   let zoomChunks = [],
      //                i = 0;
      //   while (i < breakNum) {
      //     zoomChunks.push(path.bounds(paddedBounds(threePts(fullLine,int,i))));
      //     i++;
      //   }
      //   let lastPt = fullLine.geometry.coordinates[fullLine.geometry.coordinates.length-1],
      //    lastFrame = path.bounds(paddedBounds(threePts(fullLine,int,i).slice(0,2).concat([lastPt])));
      //   zoomChunks.push(lastFrame);
      //   return zoomChunks;
      // }

      // if explicitly using d3.interpolateZoom, will need:
      // function getCenterWidth(bounds,center) {
      //   return [center[0],center[1],Math.abs(bounds[1][0]-bounds[0][0])];
      // }

      // TRANSLATE ONLY
      // function zoomFollow(path,tDelay,tMid,tEnd,scale,lastTransform) {
      //   g.transition().duration(tMid).ease(d3.easeLinear)
      //   // g.transition().delay(tDelay).duration(tMid).ease(d3.easeLinear)
      //     .attrTween("transform", zoomAlong(path,scale))
      //     // .on("end", () => {
      //     //   g.transition().duration(tEnd)
      //     //     .attr("transform",lastTransform.toString())
      //     // })
      // }
      function zoomAlong(path,k = currentView.scale) {
        var l = path.node().getTotalLength(); // orig 'this'
        // let train = d3.select("#train-point")
        return function(d, i, a) {
          return function(t) {
            // KEEP NODE P IN CENTER OF FRAME
            var p = path.node().getPointAtLength(t * l);
            // calculate translate necessary to center data within extent
            // let tx = (width - k * p.x) / 2,
            //     ty = (height - k * p.y) / 2;
            let tx = -k * p.x + width/2,
                ty = -k * p.y + height/2;
            // let px = +/translate\((.*?),/.exec(train.attr("transform"))[1],
            //     py = +/,(.*?)\)/.exec(train.attr("transform"))[1];
            // console.log(train.node()) // 165,-26 | 164, -26
            // console.log(g.node()) // -786, 376 | -789, 372
            // // clip projected data to minimize shift/render calculations
            let clipExtent = [[-tx, -ty], [tx, ty]]; // extended for leeway around edges
            // let clipExtent = [[-(tx ** 2), -(ty ** 2)], [tx ** 2, ty ** 2]]; // extended for leeway around edges
            identity.clipExtent(clipExtent) //
            projection.clipExtent(clipExtent)
            return "translate(" + tx + "," + ty + ") scale(" + k + ")";
          }
        }
      }

      function prepareUser() {
        // introduce dash, summary
        // prompt for readiness

          // provide user feedback, e.g. 'You have chosen to travel from {ptA} to {ptB} on {railCompany}'s {lineName} line. IRL, this route would take you about {travelTime} to complete, but we are going to more a little more quickly. Keep your eye on the dashboard and journey log for more details as the journey unfolds in {countdown?... until data loads?}'

          // OUTPUT initial orienting data to dashboard (and store for easy updating)
            // total length (leg length sum?)
            // full travel time(basetime?)
            // remainTime, remainDistance
      }

    // UPDATE DATA LANDSCAPE / STRUCTURE
      // add new data layers to svg <defs>
        function storeNew(overlayers) { }
      // update map object with source content?
      // update event listeners?
    // UPDATE PRIMARY VISUAL        <=== I.E., RENDER A MAP OF RELEVANCE
      function updateMap(newData) { }   // <=== GENERAL UPDATE PATTERN STARTS HERE
      // ADD NEW CONTENT
        // create new selections & data joins as necessary
          // function addLayer() { }
          // // from <defs>?
          //   function useDef(*) { }           *****COMBAK****
      // UPDATE PERSISTING VISUAL
        function highlightRelevant(data) { }
        // function zoomTo(bounds) { } // elsewhere
      // REMOVE BLOAT
        // exit excessive DOM nodes
          function removeExcess() { }
    // UPDATE SECONDAY VISUALS (WIDGETS, ETC)
      function updateTooltip() { }
      function getTooltipContent(d) {
        var content = '<span class="category">Facility Name: </span>' +
        '<span class="align-r">' + titleCase(d.Facility_Name) + '</span>' +
        '<br /><span class="category">Location: </span>' +
        '<span class="align-r">' + titleCase(d.City) + ', ' + d.State + '</span>' +
        '<br /><span class="category">2018 Percent Voter Turnout: </span>' +
        '<span class="align-r">' + Math.floor(d.Total).toLocaleString() +
        ' metric tons</span>'
        return content;
      }

      function drawLegend(svg,width,height) {

        // append a new g element
        var legend = svg.append("g")
          .attr("id", "legend")
          .attr("dy", "1.3em")  // adjust the vertical displacement
          .attr("class", "legend")  // add a class (for CSS)
          .attr("transform", "translate(" + (width - 54) + "," + (height - 20) + ")")
          .selectAll("g")       // select all new g elements
          .data([5e6, 2e7])     // apply two numbers (approx median/max)
          .enter().append("g"); // enter and append the two new g elements

          legend.append("rect")
            .attr("width", 180)
            .attr("height", 24)
            .attr("fill", "url(#colorizeGradient)")

          // append text to each
          legend.append("text")
            .attr("y", function (d) {
              return -2 * radius(d);
            })
            .attr("dy", "1.3em")
            .text(d3.format(".1s"));

          // append a legend label at bottom
          legend.append("text")
            .attr("y", 16)
            .text("Percent of Registered Voters who Voted, Fall 2018")

      }  // end drawLegend()

      function updateLegend() { }

      function addFilter(facilityData, facilities) {

        // create new select element in the DOM as child of #map
        var dropdown = d3.select('#map')
          .append('select')         // append a new select element
          .attr('class', 'filter')  // add a class name
          .on('change', onChange)   // listen for change event, call onChange function

        // array to hold select options
        var uniqueTypes = ["All facilities"];

        // loop through all features and push unique types to array
        facilityData.forEach(function (facility) {
          // if the type is not included in the array, push it to the array
          if (!uniqueTypes.includes(facility.Industry_Type)) uniqueTypes.push(facility.Industry_Type)
        })

        // sort types alphabeticaly in array
        uniqueTypes.sort();

        // confirm list of unique Industry Type values from CSV data
        // console.log(uniqueTypes)

        // create new option elements for each unique type
        dropdown.selectAll('option')  // 'option' pre-selected as element to be created
          .data(uniqueTypes).enter()  // attach our array as data
          .append("option")           // append a new option element for each data item
          .text(function (d) {
            return d                  // use the item as text
          })
          .attr("value", function (d) {
            return d                  // use the time as value attribute
          })

        // define what will happen when option is selected by user
        function onChange() {

          // get the current value from the select element
          var val = d3.select('select').property('value')

          // style the display of the facilities
          facilities.style("display", function (d) {
            // if it's our default, show them all with inline
            if (val === "All facilities") return "inline"
            // otherwise, if each industry type doesn't match the value
            if (d.Industry_Type != val) return "none"  // don't display it
          })

        }

      }


  // AWAIT USER INTERACTION or OTHER NEW INFO
    // UPON RECEIPT...                            ===>  LOOP TO (*)(*)(*)


/////////////////////
///// FUNCTIONS /////
/////////////////////

//// SVG/CANVAS

  // MAP DATA

    function dynamicallySimplify() {
      minZ = 1 / scale * scale;
      // minZi, minZp
    }
    function redraw(layerGroupSelector){
      d3.selectAll(`g${layerGroupSelector}`) // could be # or .
        .selectAll("path")
          .attr("d",path)
    }
    function redrawMap() {
      g.selectAll("path.rendered.projectedOTF").attr("d", path);
      g.selectAll("path.rendered").attr("d", path);
    }
    function rerender(content = "map") {
      // select content from DOM
      // parse as necessary
      // redraw(content)

      // svg.transition().duration(750)
      //   .call(zoom.transform, zoom1)
      // g.style("stroke-width", 1 / (scale*scale));
      // // g.style("stroke-width", 1 / (scale*scale) + "px");
      //
      // g.attr("transform", "translate(" + translate[0] + "," + translate[1] + ") scale(" + scale + ")");
    }

    // RASTER & CANVAS
    function drawRaster(data) {

      // console.log(data)

      GeoTIFF.fromArrayBuffer(data).then(tiff => {
        // console.log(tiff);
        const image = tiff.getImage();
        Promise.all([image]).then(proceed,onError);
      },onError);

      function proceed(data) {

        const image = data[0];

        // console.log(image)

        const rasters = image.readRasters(),
                width = image.getWidth(),
               height = image.getHeight(),
               origin = image.getOrigin(),
           resolution = image.getResolution(),
                 bbox = image.getBoundingBox();

        // console.log(origin) // [-180, 90, 0]
        // console.log(bbox) // [-180, 10, -50, 90]

        // below drawn heavily from http://bl.ocks.org/rveciana/263b324083ece278e966686d7dba700f
        const tiepoint = image.getTiePoints()[0];

        // console.log(rasters) // PROMISE
        // console.log(tiepoint) // {i: 0, j: 0, k: 0, x: -180, y: 90, z: 0}

        const geoTransform = [tiepoint.x, resolution[0], 0, tiepoint.y, 0, -1 * resolution[1]],
           invGeoTransform = [-geoTransform[0]/geoTransform[1], 1/geoTransform[1], 0, -geoTransform[3]/geoTransform[5], 0, 1/geoTransform[5]];

        var tempData = new Array(height);

        Promise.all([rasters]).then(data => {

          let rasters = data[0];

          for (var i = 0; i < height; i++) {
            tempData[i] = new Array(height);
            for (var j = 0; j < width; j++) {
              tempData[i][j] = rasters[0][j + i * width];
            }
          }

          // Canvas II
          var canvasRaster = d3.select("#map").append("canvas")
            .attr("width", width)
            .attr("height", height)
            .style("display","none");

          var contextRaster = canvasRaster.node().getContext("2d");

          var id = contextRaster.createImageData(width,height),
            data = id.data,
             pos = 0;

          for (var i = 0; i < height; i++) {

            for (var j = 0; j < width; j++) {

              let coords = projection.invert([j,i]),
                      px = invGeoTransform[0] + coords[0]* invGeoTransform[1],
                      py = invGeoTransform[3] + coords[1] * invGeoTransform[5];

              if (Math.floor(px) >= 0 && Math.ceil(px) < width && Math.floor(py) >= 0 && Math.ceil(py) < height) {

                // https://en.wikipedia.org/wiki/Bilinear_interpolation
                let value = tempData[Math.floor(py)][Math.floor(px)]*(Math.ceil(px)-px)*(Math.ceil(py)-py)+
                tempData[Math.floor(py)][Math.ceil(px)]*(px-Math.floor(px))*(Math.ceil(py)-py) +
                tempData[Math.ceil(py)][Math.floor(px)]*(Math.ceil(px)-px)*(py-Math.floor(py)) +
                tempData[Math.ceil(py)][Math.ceil(px)]*(px-Math.floor(px))*(py-Math.floor(py));

                //let color = d3.rgb(d3.interpolateRdBu(1-((value- 14)/24)));
                let v = (value - 14) / 24;

                data[pos+0] = 255 * (v < 0.5 ? 2 * v : 1);
                data[pos+1] = 255 * (v < 0.5 ? 2 * v : 1 - 2 * (v - 0.5));
                data[pos+2] = 255 * (v < 0.5 ? 1 : 1 - 2 * (v - 0.5));
                data[pos+3] = 180;

                pos = pos + 4

              }

            }

          }

          contextRaster.putImageData( id, 0, 0);
          context.drawImage(canvasRaster.node(), 0, 0);

        },onError);

      }

    }

  // ZOOM BEHAVIOR
    function dblclicked(d,i) {

      if (active.node() === this) return resetZoom();

      if (d3.event.defaultPrevented) return; // panning, not zooming

      active.classed("active", false);

      active = d3.select(this).classed("active", true);

      zoomTo(path.bounds(d))
        // make sure upper-most (clickable) layer is in accordance with path function, or adjust bounds() caller accordingly

    }

    function zoomed() {

      var transform = d3.zoomTransform(this)

      let scale = transform.k,
            e00 = transform.x,
            e11 = transform.y;

      let translate = [e00, e11],
         clipExtent = [[-(e00 ** 2), -(e11 ** 2)], [e00 ** 2, e11 ** 2]]; // extended for leeway around edges

      identity.clipExtent(clipExtent)
      projection.clipExtent(clipExtent)

      g.style("stroke-width", 1 / (scale*scale));
      // g.style("stroke-width", 1 / (scale*scale) + "px");

      // g.style("transform-origin","0% 0% 0") // reset after auto center elsewhere

      g.attr("transform", "translate(" + translate[0] + "," + translate[1] + ") scale(" + scale + ")");

      // currentView = {
      //   translate: translate,
      //   scale: scale,
      //   extent: clipExtent
      // };

    }

    function scaleOnly(k) {

      console.log(k)
      console.log(g.node())

      // let currentTranslate = +/translate\((.*?)\)/.exec(g.attr("transform"))[1],
      let cTx = +/translate\((.*?),/.exec(g.attr("transform"))[1],
          cTy = +/,(.*?)\)/.exec(g.attr("transform"))[1];

        console.log(cTx,cTy)
      let scaled = d3.zoomIdentity
        .translate(cTx,cTy)
        .scale(k)

      svg.transition().duration(750)
        .call(zoom.transform, scaled)
    }

    function zoomTo(bounds,k) {

      let transform = getTransform(bounds);

      let zoom1 = d3.zoomIdentity
        .translate(transform.x,transform.y)
        .scale(k || transform.k)

      svg.transition().duration(750)
        .call(zoom.transform, zoom1)

    }

    function getTransform(bounds, extent = extent0) {

      let b0,b1;

      // accept bbox, path.bounds(), or SVG bbox
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

      let k = 0.9 / Math.max(dx / width, dy / height),
                             // aka the m in y = mx + b
                             // Math.max() determines which dimension will serve as best anchor to provide closest view of this data while maintaining aspect ratio
                             // 0.9 provides 10% built-in padding
          x = b1[0] + b0[0], // xMax (b1[0]) + xOffset (b0[0])
          y = b1[1] + b0[1];  // yMax (b1[1]) + yOffset (b0[1])

      // calculate translate necessary to center data within extent
      let tx = (width - k * x) / 2,
          ty = (height - k * y) / 2;

      let transform = { k: k, x: tx, y: ty, extent: extent };

      return transform;

    }
    // function makeBounds(centerPt,h,w) {
    //   console.log(centerPt)
    //   console.log(h)
    //   console.log(w)
    //   let x = centerPt[0],
    //       y = centerPt[1];
    //   // returns svg rect with top,left and bottom,right coords
    //   return [[x - w/2, y + h/2],[x + w/2, y - h/2]];
    // }

    function resetZoom() {
      active.classed("active", false);
      active = d3.select(null);

      svg.transition().duration(3000).ease(d3.easeLinear)
        .call(zoom.transform, zoom0)

      svg.call(zoom)
    }

  // TRANSITIONS AND TWEENS
    function tweenDash() {
      var l = this.getTotalLength(),
          i = d3.interpolateString("0," + l, l + "," + l);
      return function(t) { return i(t); };
    }

    function dashBack() {
      var l = this.getTotalLength(),
          i = d3.interpolateString(l + ",0", "0," + l);
      return function(t) { return i(t); };
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

    function fadeToDashed(pathSelection) {
      pathSelection.transition()
    }

    function drawDashed() {
      var l = this.getTotalLength();
      var i = d3.interpolateString(-l,"0"); // results in 0=>dashed in wrong direction
      // var i = d3.interpolateString(l,"0"); // results in full=>dashed in correct direction
      // var i = d3.interpolateString("0",l); // results in dashed=>full in wrong direction
      // var i = d3.interpolateString("0",-l); // results in dashed=>0 in correct direction
      // var i = d3.interpolateString(-l,l); // results in 0=>dashed=>full in wrong direction
      // var i = d3.interpolateString("0","0"); // results in unmoving dashed
      // var i = d3.interpolateString(l,l,"0"); // results in unmoving full
      // var i = d3.interpolateString(-l,-l,"0"); // results in zippo
      // var i = d3.interpolateString(l,-l,"0"); // results in full=>dashed=>0 in correct direction
      return function(t) { return i(t); };
    }
    function animateSolid(along,t){
      along.style("opacity", 0.6)
           .transition()
           .duration(t)
           .styleTween("stroke-dasharray",tweenDash)
    }

    function animateDashed(along,t) {

      // see https://bl.ocks.org/kafunk/91f7b870b79c2f104f1ebacf4197c9dc for more commentary

      let reversedAlong = along.clone();

      var length = reversedAlong.node().getTotalLength(),
         dashSum = dash1.split(" ")
                          .map( x => +x )
                          .reduce((accumulator, currentVal) =>
                             accumulator + currentVal, 0
                          ),
       dashTimes = Math.ceil(length/dashSum),
        dashFill = new Array(dashTimes + 1).join(dash1 + ' '),
         dashStr = dashFill + ", " + length;

      // REVERSE PATH for drawDashed only (finicky)
      let currentPath = reversedAlong.attr("d"),
       currentPathArr = currentPath.split('M'),
      currentPathBulk = currentPathArr[1].split('L'),
         reversedBulk = currentPathBulk.reverse(),
           joinedBulk = reversedBulk.join('L'),
      reversedPathArr = ["M",joinedBulk],
         reversedPath = reversedPathArr.join('');

      reversedAlong.attr("d", reversedPath)
                   .attr("id", "full-route-reversed")

      // dashed path initially blank
      reversedAlong.style("stroke-dasharray", dashStr)
                   .style("stroke-dashoffset", -length)
                   .style("opacity", 0.6)

      reversedAlong.transition()
                   .duration(t)
                   .styleTween("stroke-dashoffset",drawDashed)

    }

    function endall(transition,callback) {
      var n = 0;
      transition.each(function() { ++n; })
                .each("end", function() { if (!--n) callback.apply(this, arguments); });
    }

  // PROJECTIONS & PATHS

    function identityTransform(coordArr) {
      let k = identity.scale(),
         tx = identity.translate()[0],
         ty = identity.translate()[1],
         transformedArr = [];
      while (coordArr.length > 0) {
        let coord = coordArr.shift(),
        transformed = [coord[0] * k + tx, -coord[1] * k + ty];
        transformedArr.push(transformed.slice());
      }
      return transformedArr;
    }
    function projectionTransform(coordArr) {
      let transformedArr = [];
      while (coordArr.length > 0) {
        let coord = coordArr.shift(),
        transformed = projection(coord);
        transformedArr.push(transformed.slice());
      }
      return transformedArr;
    }
    function setPPBounding([wgsJson,ppJson], crs = "preprojected") {
      setBounding(ppJson, crs);
      return [wgsJson,ppJson];
    }
    function setBounding(received, crs = "wgs84") {
      let data;
      (Array.isArray(received)) ? data = received[0] : data = received;
      let boundingGJ = tj2gj(data); // includes fallback if data already gj
      if (crs === "preprojected") {
        console.log("fitting geoIdentity to given PP GJ")
        fitToExtent(identity,boundingGJ)
      } else {    // assume crs === "wgs84"
        console.log("fitting projection to given WGS GJ")
        fitToExtent(projection,boundingGJ)
      }
      return received;
    }
    function fitToExtent(fx,data,extent = extent0) {
      fx.fitExtent(extent,data);
    }
    function fitted(data,fx,extent = extent0) { // fitGJtoExtentUsingFX
      fx.fitExtent(extent,data);
      let fittedObj = {
        extent: extent,
        // bbox: nullPath.bounds(data),
        // center: nullPath.centroid(data),
        transform: getTransform(nullPath.bounds(data),extent)
        // scale: transform.k,
        // translate: getTranslate()
      };
      return fittedObj;
    };

  // ATTUNE FACTORS

    // function attuneRoute(received) {
    //
    //   // Rome2Rio is returning stations with slightly different coordinates than my original data, resulting in offset of returned route and underlaying railBase
    //   // solution? calculate scale/translate factors between two sets of stations points using orig/returned coordinates as bounds,
    //   // then use those factors to attune projection function before rendering
    //
    //   let ppStns = {
    //     from: g.select("#rail-stations").selectAll("path").filter(d => {
    //       return d.properties.city === received.from.shortName && (d.properties.province || d.properties.state) === received.from.regionCode;
    //     }),
    //     to: g.select("#rail-stations").selectAll("path").filter(d => {
    //       return d.properties.city === received.to.shortName && (d.properties.province || d.properties.state) === received.to.regionCode;
    //     })
    //   };
    //
    //   // start with lat/lon only; projection happens within path.bounds()
    //   let origPts = {
    //     from: {
    //       lng: ppStns.from.datum().properties.lon,
    //       lat: ppStns.from.datum().properties.lat
    //     },
    //     to: {
    //       lng: ppStns.to.datum().properties.lon,
    //       lat: ppStns.to.datum().properties.lat
    //     }
    //   },
    //     r2rPts = {
    //       from: {
    //         lng: received.from.lng,
    //         lat: received.from.lat
    //       },
    //       to: {
    //         lng: received.to.lng,
    //         lat: received.to.lat
    //       }
    //     }
    //
    //   // console.log(origPts)
    //   // console.log(r2rPts)
    //
    //   // console.log("orig data coordinate bounds transform")
    //   let origLineString = turf.lineString([[origPts.from.lng,origPts.from.lat],[origPts.to.lng,origPts.to.lat]]),
    //     origBounds = path.bounds(origLineString),
    //     origTransform = getTransform(origBounds);
    //   // console.log(origTransform)
    //
    //   // console.log("r2r coordinate bounds transform")
    //   let r2rLineString = turf.lineString([[r2rPts.from.lng,r2rPts.from.lat],[r2rPts.to.lng,r2rPts.to.lat]]),
    //     r2rBounds = path.bounds(r2rLineString),
    //     r2rTransform = getTransform(r2rBounds);
    //   // console.log(r2rTransform)
    //
    //   console.log("r2r => orig scale factors")
    //   let sF = origTransform.k/r2rTransform.k;
    //   console.log(sF)
    //
    //   console.log("r2r => orig translate factors")
    //   let txF = origTransform.x/r2rTransform.x,
    //       tyF = origTransform.y/r2rTransform.y;
    //   console.log([txF,tyF])
    //
    //   console.log("r2r => orig translate diff")
    //   let translateDiff = [
    //     (origTransform.x - r2rTransform.x),
    //     (origTransform.y - r2rTransform.y)
    //   ];
    //   console.log(translateDiff)
    //
    //   // update received data / routeObj
    //   received.adjustFactors = {
    //     scale: sF,
    //     translate: [txF,tyF]
    //     // translate: translateDiff
    //   },
    //   received.adjustPoint = function([x,y]) {
    //     let k = this.adjustFactors.scale,
    //        tx = this.adjustFactors.translate[0],
    //        ty = this.adjustFactors.translate[1];
    //     let adjustedPt = [ x / k / tx, y / k / ty]; // **closest
    //       // when used with tx == txF, ty == txF
    //     return adjustedPt;
    //   }
    //
    //   attuneFx(projection,"projection",sF,[txF,tyF]);
    //
    //   return received;
    //
    //   // accumulating data:
    //   // burlington -> vancouver
    //     // sf: 1.0006935273976958
    //     // tf: [ 0.9958824306841211, 0.9989666221629282 ]
    //     // tdiff: [ -0.24029694947043367, -0.3775123135125682 ]
    //   // burlington -> ann arbor
    //     // sf: 0.9982915274864625
    //     // tf: [ 0.9981176688637599, 1.0235940918333646 ]
    //     // tdiff: [ 6.221325162820449, -4.159399630463668 ]
    //
    // }

    // PREFER TO ADJUST FUNCTION YOU WILL BE USING LESS, LIKELY THE OPPOSITE OF THAT USED TO SET BOUNDS
    // (DEFAULT TO ADJUSTING PROJECTION)
    // MAKE SURE SETTING BOUNDS COMPLETE, *THEN* CALC & APPLY ATTUNE FACTORS
    /// OR ///
    // CALC & APPLY ATTUNE FACTORS, THEN FIT TO EXTENT
    function getScaleAtZoomLevel(zoomLevel, tileSize = 256) {
      return tileSize * 0.5 / Math.PI * Math.pow(2, zoomLevel);
    }
    function attuneIdentity([wgsJson,ppJson]) {
      attunePaths([wgsJson,ppJson],identity);
      return [wgsJson,ppJson];
    }
    function attuneProjection([wgsJson,ppJson]) {
      attunePaths([wgsJson,ppJson],projection);
      return [wgsJson,ppJson];
    }
    function attunePaths([wgsJson,ppJson],fx = projection) {

      let attuneFactors = calcAttuneFactors(wgsJson,ppJson);

      console.log(attuneFactors)
      // identity not technically a function so doesn't have access to Function.prototype.name... fudging for now
      let fxName;
      (fx.name) ? fxName = fx.name : fxName = "identity";

      let scaleFactor = attuneFactors[fxName].scale,
      translateFactors = attuneFactors[fxName].translate;

      attuneFx(fx,fxName,scaleFactor,translateFactors);

      return [wgsJson,ppJson];
    }
    function calcAttuneFactors(wgsJson,ppJson) {

      // RECEIVES TWO VERSIONS OF SAME DATA
        // One unprojected (EPSG:4326)
        // One preprojected (EPSG Varies)
        // Both typically were converted to GeoJSON using QGIS (later preprojected at same time), then converted to TopoJSON using Mapshaper CLI (-simplify resolution 1920x1600 -quantize 1e5)
      // EACH IS FITTED TO SAME PIXEL EXTENT 3 TIMES
      // RESULTING BBOX & CENTER PTS COMPARED
      // AVERAGE FACTORS CALCULATED

      let a = extent0[0],
          b = extent0[1],
         extent1 = [[0,0], [b[0]/2,b[1]/2]],
         extent2 = [[a[0]*2,a[1]*2], [b[0]*2,b[1]*2]];

      const extents = [extent0, extent1, extent2];

      let wgsGj = tj2gj(wgsJson),
           ppGj = tj2gj(ppJson);

      // returns array of objects, each containing bbox and center of respective dataset when fitted to specified extent
      let wgsData = dataMaker(wgsGj,projection,extents),
           ppData = dataMaker(ppGj,identity,extents);

      let iData = sampleFactors({a: wgsData, b: ppData}),
          pData = sampleFactors({a: ppData, b: wgsData});

      // FINAL ATTUNE FACTORS
      let attuneFactors = {
        identity: {
          scale: iData.scale.getAvg(),
          translate: iData.translate.getAvg()
        },
        projection: {
          scale: pData.scale.getAvg(),
          translate: pData.translate.getAvg()
        }
      }

      return attuneFactors;

    }
    function dataMaker(json,fx,extents) {
      let fittedData = [];
      for ( var i = 0; i < extents.length; i++ ) {
        fittedData.push(fitted(json,fx,extents[i]));
      }
      return fittedData;
    }

    function sampleFactors(data) {
      return {
        scale: {
          factors: getSFactors(data),
          getAvg() { return avg(this.factors) }
        },
        translate: {
          factors: getTFactors(data),
          getAvg() {
            return [avg(this.factors,0),avg(this.factors,1)]
          }
        }
      }
    }

    function getSFactors(fittedData){
      let sFactors = [];
      for (var i = 0; i < fittedData.a.length; i++) {
        sFactors[i] = factor(fittedData.a[i].transform.k,fittedData.b[i].transform.k);
      }
      return sFactors;
    }

    function getTFactors(fittedData){
      let tFactors = [];
      for (var i = 0; i < fittedData.a.length; i++) {
        let transA = [fittedData.a[i].transform.x, fittedData.a[i].transform.y],
            transB = [fittedData.b[i].transform.x, fittedData.b[i].transform.y];
        tFactors[i] = [factor(transA[0],transB[0]),factor(transA[1],transB[1])];
      }
      return tFactors;
    }

    function factor(a,b) {  // for iFactor, pass (wgs0,pp0)
      return +(b/a);        // for pFactor, pass (pp0,wgs0)
    }

    function attuneFx(fx,fxName,scaleFactor,translateFactors) {
      if (fx) {
        // store current fx settings, then multiply by passed factors to get new transform
        let oldScale = fx.scale(),
          oldTranslate = fx.translate(),
          newScale = oldScale * scaleFactor,
          newTranslate = [oldTranslate[0]*translateFactors[0], oldTranslate[1]*translateFactors[1]];

        console.log(`attuning ${fxName} function using
          scaleFactor ${scaleFactor}
          and
          translateFactors ${translateFactors}`)
        console.log(`old transform:
          scale: ${oldScale}
          translate: ${oldTranslate}`)
        console.log(`new transform:
          scale: ${newScale}
          translate: ${newTranslate}`)

        fx.scale(newScale)
          .translate(newTranslate)
      }
    }


//// GEOJSON + TOPOJSON HELPERS

    function tj2gj(data) {
      let gj;
      if (data["type"] == "Topology") {
        let key = Object.keys(data.objects)[0];
        gj = topojson.feature(data, data.objects[key]);
      } else {
        gj = data;
      }
      return gj;
    }
    function gj2tj(data) {
      let tj = topojson.topology(data.features,1e5);
      let objArr = Object.values(tj.objects);
      tj.objects = {
        countries: {
          type: "GeometryCollection",
          geometries: objArr
        }
      }
      return tj;
    }
    // converting from TopoJSON
    function getGj(source,key){
      return topojson.feature(source.tj, source.tj.objects[key]);
    }
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
        "features": data ? populateFeatures(data) : []  // ONLY IN THIS CONTEXT / CALLS ON POLYLINE.JS
      }
      return gj;
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
    function getArcPts(lineStr,distance,steps = 500) {
      let breaks = getBreaks(lineStr,distance,steps);
      return [...breaks].map(point => projection(point));
    }
    function getBreaks(lineString,distance,steps) {
      let breaks = new Set;
      if (lineString.geometry.coordinates.length > 0) {
        for (var i = 0; i < distance; i += distance / steps) {
          breaks.add(turf.along(lineString, i, { units: "miles" }).geometry.coordinates);
        }
      }
      return breaks;
    }

    function bbox2ProjBounds(bbox) {
      return [projection([bbox[0],bbox[1]]),projection([bbox[2],bbox[3]])];
    }

    function totalDistance(segments){
      let t = 0;
      for (var i = 0; i < segments.length; i ++) {
        t += segments[i].distance;
      }
      return t;
    }

    function getIntersecting(train,path,tprm,quadtree) {
      // console.log(train.node())
      // console.log(path.node())

      // as train moves along line, loop to continually check present position ::bufferedQueryPt:: against quadtree enrich data
        // trains: reveal as soon as buffer intersects
        // lines and polygons: once buffer intersects, query for actual intersect pts; if they don't exist, return nearestPointOnLine

      // as data returned (booleanIntersects), get geometry type and immediately pass specifics onto transition makers ("reveal" function)

      // change data class and remove from quadtree searchRemaining

        // polygons
          // get 2nd intersect or closest to it; calculate t based on time train will need to travel from i0 to i1; animate radial gradient outward from i0

        // lines
          // divide line into R and L; get 2nd intersect or closest to it; calculate t based on time train will need to travel from i0 to i1; keep t equal for both R and L lines, even as distance varies
          // watersheds: animateDashed within varying dashArrays and thickness; higher levels thinner and with more intricate/subtle patterns
          // rivers and streams: animatedSolid R and L with continual branching outward

        // points
          // grow circle r out from 0 + initial glow effect
          // flash tiny offset tooltip with basic info (name, category)
            // animate cursive writing?
          // alert => dashboard
          // log => logbook
          // keep circle; fade tooltip (but remains accessible on circle mouseover)

      var l = path.node().getTotalLength();
      // return function(d, i, a) {
      //   return function(t) {
      //     var p = path.node().getPointAtLength(t * l);
      //     // return "translate(" + tx + "," + ty + ") scale(" + k + ")";
      //   }
      // }
      console.log(l)

      console.log(quadtree)

      console.log(defs.node())

    }

    function i0i1(datum,route) {
      // let a = turf.lineString([[126, -11], [129, -21]]),
      //     b = turf.lineString([[123, -18], [131, -14]]);
      // var intersects = turf.lineIntersect(a,b);
      // return intersects;
    }
    function buffer(feature, radius = 0.5, options = { units: "degrees", steps: 12 }) {
      // keep radius consistent with pool of enrichData
      // ? re:steps (default much more)
      return turf.buffer(feature, radius, options);
    }
    function getT(route,i0,i1,getProjectedGjm) {
      // route and tprm constant per experience; don't force reevaluation?
      let segment = turf.lineSlice(i0,i1,route),
         distance = turf.length(segment, { units: "miles" }),
                t = distance * tprm;
      return t;
    }

//// ANIMATION
    function goTrain(point,fullPath,simpPath,tprm,tpsm,simpDistance,[firstThree,lastThree],enrichData) {

      // FOR OSHAWA
      console.log(firstThree)
      console.log(paddedBounds(firstThree))

      // scale of initial view
      let firstFrame = path.bounds(paddedBounds(firstThree)),
      firstTransform = getIdentity(getTransform(firstFrame)),
               scale = firstTransform.k;

      // calc first and last zoomIdentity based on stable k
      let firstIdentity = getIdentity(centerTransform(projection(firstThree[1]),scale)),
           lastIdentity = getIdentity(centerTransform(projection(lastThree[1]),scale));

      // currentView.scale = scale;

      console.log("FIRST FRAME")
      console.log(firstIdentity)

      // tFull is based on ms/simplified mile for tDelay calc reasons
      let tFull = tprm * simpDistance, // effective ms per simp mile * simp miles
         tDelay = (simpDistance > 300) ? tprm * 100 : tprm * 0,      // delay zoomFollow until train hits mm 100 (of fullSimp) IF route long enough
           tMid = tFull - (tDelay*2),  // tDelay doubled to account for stopping 100m from end
           tEnd = 3000;           // arbitrary time to zoom to start frame

      // zoom to First frame
      svg.transition().duration(tEnd*2) // .ease(d3.easeBounceIn)
        .call(zoom.transform, firstIdentity)
          .on("end", () => {
            // confirm g exactly in alignment for next transition
            g.attr("transform",firstIdentity.toString())
            // make quadtree (now that view/data pts will remain consistent)
            quadtree =
            makeQuadtree(enrichData.triggerPts,enrichData.withinBuffer);
            d3.timeout(() => {
              // if (confirm("Ready?")) {
                d3.timerFlush()
                // disable free zooming
                svg.on('.zoom',null)
                // call initial point transition
                goOnNow()
              // }
            }, 3000)
          })

      // let train = point.node();
      // const observerConfig = { attributes: true },
      //             observer = new MutationObserver(trainMoved);
      // observer.observe(train,observerConfig)
      // observer.disconnect()

      let mostRecent;
      function animate(elapsed) {

        // dispatch another move event
        dispatch.call("move", point, elapsed) // pass point @ elapsed

        // if train has stopped moving, stop timer
        if (mostRecent === point.attr("transform")) timer.stop() // {
        //   timer.stop();
        //   observer.disconnect();
        // }

        mostRecent = point.attr("transform");

      }

      function goOnNow() {
        // start at pt 0
        dispatch.call("depart", this, tFull) // depart.train?
        // set up transition along entire route
      	point.transition().delay(tEnd).duration(tFull).ease(d3.easeSinInOut)
    		 .attrTween("transform", translateAlong(fullPath))
         // point transition triggers additional elements
         .on("start", () => {
           // kick off global timer!
           timer = d3.timer(animate)
           // animateSolid(fullPath,tFull)
           fullPath.style("opacity", 0.6)
              .transition().duration(tFull).ease(d3.easeSinInOut)
                .styleTween("stroke-dasharray",tweenDash)
           // zoomFollow if necessary
           if (firstThree[1] !== lastThree[1]) {
             g.transition().delay(tDelay).duration(tMid).ease(d3.easeSinInOut)
              .attrTween("transform", zoomAlong(simpPath,scale))
                .on("end", () => {
                  // ensure final alignment
                  g.attr("transform",lastIdentity.toString())
                  // end MutationObserver
                  // observer.disconnect();
                })
            }
            // follow along checking for intersecting encounters
            // getIntersecting(point,fullPath,tprm,quadtree)
          })
         .on("end", () => {
           // inform d3 zoom behavior of final transform value and reenable free zooming
           svg.call(zoom.transform, lastIdentity)
           svg.call(zoom)
         });
      }

    }

    function pauseTrain(e){
      // console.log(g.interrupt())
      console.log(e)
      console.log(e.target)
      console.log(this)
      console.log(d3.event)
      console.log(g.interrupt())
      // console.log(point)
      // g.interrupt()
      // let px = +/translate\((.*?),/.exec(point.attr("transform"))[1],
      //     py = +/,(.*?)\)/.exec(point.attr("transform"))[1];
      // return [px,py];
    }

    let train = d3.select("#train-point")
    function departed(t) {
      console.log("train departing @ " + t)
      d3.timerFlush() // necessary?
      train.dispatch("depart")
    }

    let prevLocation, bufferExtent, prevExtent;
    let triggerPts = g.select("#trigger-pts").selectAll(".trigger-pt")
    function trainMoved() { // point,elapsed) {

    // alt trainMoved()
    // function trainMoved(mutationsList,observer) {
      // let triggerPts = g.select("#trigger-pts").selectAll(".trigger-pt")
      // for (var mutation of mutationsList) {
        // accessing translate values this way slightly more efficient than using point.attr("transform") + regex parser

        // let transformMatrix = mutation.target.transform.animVal[0].matrix,
        let transformMatrix = this.node().transform.animVal[0].matrix,
            currentLocation = [transformMatrix.e, transformMatrix.f];

        // use LngLat coords to calculate bufferExtent given radius in degrees ONE TIME ONLY
        if (!prevExtent) {
          let currentLngLat = projection.invert(currentLocation);
          bufferExtent = path.bounds(turf.buffer(turf.point(currentLngLat),0.5,{units: "degrees"}));
        // moving forward, translate initial bufferExtent along with train point
        } else {
          bufferExtent = shifted(prevExtent,prevLocation,currentLocation);
        }
        // regardless, store determined values as baseline for next transform
        prevLocation = currentLocation,
          prevExtent = bufferExtent;

        function shifted(extent,previousPt,currentPt){
          let tx = currentPt[0] - previousPt[0],
              ty = currentPt[1] - previousPt[1];
          return extent.map(d => { return [d[0]+tx, d[1]+ty]; })
        }

        let bufferVis = g.append("rect")
                         .datum(bufferExtent)
                         .classed("momentary-buffer-vis",true)
                         .attr("x", d => { return d[0][0]; })
                         .attr("y", d => { return d[0][1]; })
                         .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
                         .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
                         .style("fill","rebeccapurple")
                         .style("stroke","whitesmoke")
                         .style("stroke-width","0.2px")
                         .style("opacity", 0.4)

        // let bufferVis =
        // g.selectAll(".momentary-buffer")
        //   .data([extent])
        //   .enter().append("rect")
        //     .classed("momentary-buffer",true)
        //     .attr("x", function(d) { return d[0][0]; })
        //     .attr("y", function(d) { return d[0][1]; })
        //     .attr("width", function(d) { return d[1][0] - d[0][0]; })
        //     .attr("height", function(d) { return d[1][1] - d[0][1]; })
        //     .style("fill","steelblue")
        //     .style("stroke","whitesmoke")
        //     .style("stroke-width","0.2px")
        //     .style("opacity", 0.4)

        bufferVis.transition().duration(750)
          .style("opacity","0.6")
          .on("end", () => {
            bufferVis.transition().duration(750)
              .style("opacity","0")
              .on("end", () => {
                bufferVis.classed("none",true)
                bufferVis.exit().remove()
              })
          })

        // find all within buffer extent
        triggerPts.each( d => {
          d.scanned = d.selected = false; });  // resets all scanned/selected on every event

        searchQuadtree(quadtree, bufferExtent[0][0], bufferExtent[0][1], bufferExtent[1][0], bufferExtent[1][1]);
        triggerPts.classed("trigger-pt--scanned", d => { return d.scanned; });
        triggerPts.classed("trigger-pt--selected", d => { return d.selected; });

        // find nearest
        // let p = quadtree.find(currentLocation[0],currentLocation[1]);
        // triggerPts.classed("trigger-pt--nearest", d => { return d === p; })

      // }
    }

//// QUADTREE and DATA/INTERSECT QUERIES

    function searchQuadtree(quadtree, x0, y0, x3, y3) {
      // console.log(x0, y0)
      // console.log(x3, y3)
      quadtree.visit(function(node, x1, y1, x2, y2) {
        if (!node.length) {
          // console.log(x1, y1)
          // console.log(x2, y2)
          do {
            var d = node.data;
            d.scanned = true;
            d.selected = (d[0] >= x0) && (d[0] < x3) && (d[1] >= y0) && (d[1] < y3);
          } while (node = node.next);
        }
        return x1 >= x3 || y1 >= y3 || x2 < x0 || y2 < y0;
      });
    }

//// OUTPUT AND ALERT incl DASHBOARD

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
    d3.selectAll(".expand-trigger").on("click", e=> {
      expand(e.target.for); // controls?
      hide(e.target);  // hide the icon that prompted expansion, once expansion is attained
    });

    function expand(elementStr,direction = ["left"]) {

      let toExpand = d3.select(`#${elementStr}`),
        expandLabel = d3.select(`#${elementStr}-expand`),
        collapseLabel = d3.select(`#${elementStr}-collapse`);

      if (elementStr == "dashboard") {
        expandBtn = d3.select(`#${elementStr}-expand-btn`),
        collapseBtn = d3.select(`#${elementStr}-collapse-btn`);
        expandLabel.classed("h6", true);
        expandLabel.classed("h18 mb6-ml my-green", false);
        expandBtn.classed("none", true);
        collapseBtn.classed("none", false);
        d3.select("#dashplus").classed("my-green",false);
        d3.select("#sidebar-collapse").classed("mt6", true);
      } else {
        expandLabel.classed("none", true);
        collapseLabel.classed("none", false);
        collapseLabel.classed("mt0", true);
      }

      // regardless
      toExpand.classed(`disappear-${direction} none`, false);

      // remove previously set featured element-specific event listener
      thisWindow.on("resize.hidden", null);

    }

    function collapse(elementStr, direction = "left") {

      let toCollapse = d3.select(`#${elementStr}`),
        expandLabel = d3.select(`#${elementStr}-expand`),
        collapseLabel = d3.select(`#${elementStr}-collapse`);

      if (elementStr == "dashboard") {
        expandBtn = d3.select(`#${elementStr}-expand-btn`),
        collapseBtn = d3.select(`#${elementStr}-collapse-btn`);
        expandLabel.classed("h18 mb6-ml", true);
        expandLabel.classed("h6", false);
        expandBtn.classed("none", false);
        collapseBtn.classed("none", true);
        d3.select("#dashplus").classed("my-green",true);
        d3.select("#sidebar-collapse").classed("mt6", false);
      } else {
        collapseLabel.classed("none", true);
        expandLabel.classed("none", false);
        expandLabel.classed("mt0", true);
      }

      // regardless
      toCollapse.classed(`disappear-${direction}`, true);

      // set up event listener in case window expanded beyond mm while element hidden
      thisWindow.on("resize.hidden", function() {
        if (this.innerWidth < 800) {
          expand(elementStr,direction);
        }
      });

    }

    d3.selectAll(".hide-trigger").on("click", e => {
      hide(e.target.for); // controls? (for as attribute containing id of element to hide)
      // with the exception of the modal hide-trigger (and all submit buttons)
      if (e.target.type != "submit") {
        // expand something else? (expand-trigger icon?)
      }
    });

    function hide() {
      d3.select(this)
        .classed("none", true);
    }
    function show() {
      d3.select(this)
        .classed("none", false);
    }

  // UI DRIVEN
    function oOpen(elementStr) {
      // grab caller element
      let toOpen = d3.select(`#${elementStr}`);
      // change element visibility via class toggle
          toOpen.classed("none", false);
    }

    function xClose(elementStr) {
      // grab caller element's parent
      let toClose = d3.select(`#${elementStr}`);
      // change element visibility via class toggle
      toClose.classed("none", true);
      // in case veil is still obscuring underlayers
      d3.select('#veil').classed("none", true);
    }

//// OTHER EVENT LISTENERS & VISUAL AFFORDANCES

  // (always passed e event allowing access to e.target)

    // initial call to action
    thisWindow.on("load", function () {
      if (!('optionsReceived' in localStorage)) {
        initPrompt();
      }
    });

    // thisWindow.on("reload", *)
    // svg.on("move", rerender);
    // svg.on("viewreset", rerender);
    // thisWindow.on("resize.map", resize);

    d3.select("#getInitOptions").on("focus", function (e) { e.target.style.background = "palegoldenrod" })
                             .on("blur", function (e) { e.target.style.background = "#fafafa" })

  // Other mouseover
    // Tooltips (post-animation?)
    // .on("mouseenter", function(d) {
    //   d3.select(this).classed("hover", true).raise();
    //   tooltip.style("opacity", 1).html(d.name)  // eventually getTooltipContent(d)
    // })
    // .on("mouseout", function() {
    //   d3.select(this).classed("hover", false)
    //   tooltip.style("opacity", 0)
    // })

  // Buttons and functional icons

    d3.select("#play-pause").on("click", toggleState(experience.animating))

function toggleState(booElement){
  let playing = (booElement) ? false : true;
  (playing) ? pauseAnimation() : resumeAnimation()
}

//// OTHER HELPER FUNCTIONS

  // MATHS
    function avg(numArr, i){
      if (!(i === undefined)) {
        numArr = numArr.map(a => a[i]);
      }
      return numArr.reduce((a,b) => a+b) / numArr.length;
    }
    function floor(k) {
      return Math.pow(2, Math.floor(Math.log(k) / Math.LN2));
    }
    function perpendicular(angle) {
      (angle > 90) ? angle -= 90 : angle += 90;
      return angle;
    }
    // function bearing(a,b) {
    //   let atan = Math.atan(slope(a,b));
    //   let bearing = 90 - atan;         // convert to N as 0 degrees
    //   if (Math.sign(bearing) == -1) {  // if bearing is negative
    //     bearing +=360
    //   }
    //   return bearing;
    // }
    function slope(a,b) {
      let slope,
          dx = b[0]-a[0],
          dy = b[1]-a[1];
      (dy === 0) ? slope = 0 : slope = dy/dx;
      return slope;
    }

  // RESET, RESIZE, REDRAW
    function clearDOM() { }
    function resize() {

      console.log('resizing..')

      // update current dimensions
            height = parentWindow.clientHeight,
             width = parentWindow.clientWidth;

      // resize map container
      svg.attr("width", width)
         .attr("height", height)

      rerender()

    }
    // ON PAUSE
    // capture animation
    function pauseAnimation() {
      // capture pause state?
      let where = {};
      // pauseTrain(pausePt,+++)
      experience.animating = false;
    }
    function resumeAnimation() {
      if (experience.initiated) {
        // get resume point?
        experience.animating = true;
        // goTrain(resumePt,+++)
      } else {
        selectNew()
      }
    }
    function selectNew() {
      // if mid-animation, pause and confirm user intent
      if (experience.animating) {
        pauseAnimation()
        let confirmed = confirm('Do you wish to select a new route?');
        if (!confirmed) {
          resumeAnimation();
          return;
        }
      }
      // console.log('HERE')
      // in animation finished/canceled or select new confirmed
        // perform variety of resets
        d3.select("#submit-btn-txt").classed("none",false);
        d3.select("#submit-btn-load").classed("none",true);
        experience.initiated = false;
        // resetZoom();
        // open selection form
        oOpen('modal');
    }
  // DEFAULT PREVENTION
    function nozoom() {
      d3.event.preventDefault();
    }
    d3.select("#submit-btn").on("click", function() {
      d3.event.preventDefault();
      d3.select("#submit-btn-txt").classed("none",true);
      d3.select("#submit-btn-load").classed("none",false);
    })

  // THE PARSING OF THINGS
    function replaceCommas(string){
      let commaFree = string.replace(/\s*,\s*|\s+,/g, '%2C');
      return commaFree;
    }
    function sortDesc(compared) {
      return this.sort(function(a,b) {
        return b[compared] - a[compared];
      });
    }
    function sortAsc(compared) {
      return this.sort(function(a,b) {
        return a[compared] - b[compared];
      });
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
    function store(val){
      let bigVVal = capitalize(val);
      var element = d3.select(`#get${bigVVal}`);
      localStorage.setItem(val, element.value);
      var stored = localStorage.getItem(val);
      return stored;
    }

    function perfCheck(fx,params) {
      let t0 = performance.now();
      fx(params)
      let t1 = performance.now();
      let elapsed = t1 - t0;
      console.log(`${fx}-ing to ${params} took ${elapsed} milliseconds`)
    }

  // ERRORS
    function onError(error) {
      console.log(error);
    }

// })
