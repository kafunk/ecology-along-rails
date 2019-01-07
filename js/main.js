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
      dash1 = "0.1 0.2",
      dash2 = "0.05 0.1",
   origDash = "4 8 16 8",
       line = d3.line().curve(d3.curveCardinal.tension(0)),
          t = 12000;  // default

  // var padX = -72,
  //     padY = -24;
  var padX = 0,
      padY = 0;

  var parentWindow = d3.select("#map-and-dash-pane").node(),
            // margin = { top: 0, bottom: 0, left: 0, right: 0},
            // height = parentWindow.clientHeight - margin.top - margin.bottom,
            //  width = parentWindow.clientWidth - margin.left - margin.right;
            height = parentWindow.clientHeight,
             width = parentWindow.clientWidth;

  var thisWindow = d3.select(window);

  var extent0 = [[-width/2, -height/2],[width/2, height/2]];

  var translate0 = [(width + padX)/2, (height + padY)/2];

  var scale0 = 0.9 // 1;

  let currentView = {
      scale: scale0
    },
    experience = {
      initiated: false,
      animating: false
    };

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
  // var path = d3.geoPath().projection(projection);
  var projPath = d3.geoPath().projection(projection);

  // pre-projected path generator
  var ppPath = d3.geoPath().projection(identity);

// SET UP PAN/ZOOM BEHAVIOR

  var zoom0 = d3.zoomIdentity.translate(translate0[0],translate0[1]).scale(scale0)

  var active = d3.select(null);

  var zoom = d3.zoom()
    .translateExtent(extent0)
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

// DECLARE A FEW MORE FREQUENTLY USEFUL BINDINGS FOR LATER ASSIGNMENT

  var cityState = d => { return d.city + ", " + d.state; }
  // routeSpec, initStats

// INITIATE DATA LOAD

  // Typical Mapshaper CLI transform:
    // mapshaper *filein*.geojson name=*objectunits* \
    //     -o quantization=1e5 format=topojson mapshaped/*fileout*.json
    // then simplified and cleaned in browser for visual

    // more: pois incl bridges, tunnels, iNat

    // background/reference
      var admin0 = d3.json("data/final/admin0.json"),
          admin1 = d3.json("data/final/admin1.json"),
      // terrain = d3.buffer("data/final/terrain.tif"),
       hydroBase = d3.json("data/final/hydro_base.json"),
       urbanBase = d3.json("data/final/urban_areas.json"), // add major roads?
    // rail
        railBase = d3.json("data/final/railways.json"),
        // passRail = d3.json("data/final/pass_railways.json"),
        railStns = d3.json("data/final/na_main_rr_stns.json"),
       // prBuffers = d3.json("data/final/pass_rail_buffers.json");
    // merged enrich data
       // enrichPolys = d3.json("data/final/enrich_polys.json"),
       // enrichPolys = d3.json("data/final/enrich_polys_slimmed.json"),
       // enrichLines = d3.json("data/final/enrich_lines.json"),
       // enrichLines = d3.json("data/final/enrich_lines_slimmed.json"),
       enrichPts = d3.json("data/final/enrich_pts.json");

  // SET BOUNDING BOX
    Promise.all([admin0])
           .then(setBounding,onError)

  // DRAW VECTOR BASE
    Promise.all([admin0,admin1,hydroBase,urbanBase,railBase,railStns]).then(drawBase, onError);


//////////////////////////
/////// FUNCTIONS ////////
//////////////////////////

//// PREPARE MAP LAYERS

  // DATA: OVERLAY / DEFS //

  // DATA: MESH / BASE //
  function drawBase(data) {

    // console.log(data)

    // presimplified and converted as relevant/possible
    let sourceData = new Object();

    data.forEach(datum => {
      if (datum["type"] == "Topology") {
        let oKey = Object.keys(datum.objects)[0],  // object key
           sdKey = oKey;                           // sourceData key (to distinguish multiple TJ's with objects of same name)
        if (sourceData[sdKey]) { sdKey += "2" };
        // regardless
        sourceData[sdKey] = {
          tj: datum
        },
        sourceData[sdKey].gj = getGj(sourceData[sdKey],oKey);
      } else {  // if not topojson, assume already geojson
        sourceData[datum.name] = {
          gj: datum
        }
      }
    });

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
      .attr("d", projPath(continentMesh))
      .style("stroke","darkslategray")
      .style("stroke-width",0.2)
      .style("stroke-opacity",0.8)
      .style("fill","dimgray")

    // var lakeMesh =
    hydroBase.append("path")
      .attr("id", "lake-mesh")
      .attr("d", projPath(lakeMesh))
      .style("fill","cyan")
      .style("stroke","teal")
      .style("stroke-width",0.1)
      .style("opacity",0.6)
      .style("stroke-opacity",1)

    // var urbanAreas =
    urbanBase.append("path")
      .attr("id", "urban-areas")
      .attr("d", projPath(urbanMesh))
      .attr("stroke","silver")
      .attr("fill","gainsboro")
      .style("stroke-width",0.1)
      .style("opacity",0.4)

    // STROKED MESH
    // var countryBorders =
    adminBase.append("path")
      .attr("id","country-borders")
      .attr("d", projPath(countriesMesh))
      .style("fill","none")
      .style("stroke","yellowgreen")
      .style("stroke-width",0.6)

    // var stateBorders =
    adminBase.append("path")
      .attr("id","state-borders")
      .attr("d", projPath(statesMesh))
      .style("fill","none")
      .style("stroke","magenta")
      .style("stroke-width",0.4)
      .style("stroke-dasharray", "0.2 0.4")

    // var passRailways =
    // railBase.append("path")
    //   .attr("id","pass-railways")
    //   .attr("d", projPath(passRailMesh))
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
        .attr("d", projPath)
        .style("fill","none")
        .style("stroke","teal")
        .style("stroke-width", d => { return d.properties.strokeweig })

    // var railways =
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




//// AN OPTIMISTIC OUTLINE

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
            overallBearing: turf.bearing([places[0].lng,places[0].lat],[places[1].lng,places[1].lat]),
            gj: gj,
            getPath() { return g.select("#full-route").attr("d"); },
            getPathLength() { return this.getPath().node().getTotalLength(); },
            // getBounds() { return projPath.bounds(this.lineString); },
            // PATH NODES / SEGMENTS (to interpolate b/t orig and destination at regular, arbitrary intervals)
            getMileMarkers() {
              let miles = Math.floor(this.totalDistance);
              this.mileMarkers = [...getBreaks(this.lineString,this.totalDistance,miles)].map(point => projection(point));
              return this.mileMarkers;
            }
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

        // zoom to bounds of chosen route
        let routeBounds = getIdentity(getTransform(projPath.bounds(chosen.lineString),extent0,0.4));

        // control timing with transition start/end events
        svg.transition().duration(sT*2).ease(d3.easeCubicIn)
          .call(zoom.transform, routeBounds)
          .on("start", () => {
            drawRoute(chosen,sT);
            prepareEnvironment();
          })
          .on("end", () => {
            // confirm g transform where it should be
            g.attr("transform", routeBounds.toString())
            // pause to prepareUser, then initiate animation (incl zoom to firstFrame)
            prepareUser();
            d3.timeout(() => {
              initAnimation(chosen);
            }, sT);
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

          // e.g. 'You have chosen to travel from {ptA} to {ptB} on {railCompany}'s {lineName} line. IRL, this route would take you about {travelTime} to complete, but we are going to more a little more quickly. Keep your eye on the dashboard and journey log for more details as the journey unfolds in {countdown?... until data loads?}'
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
        //   .delay(sT/2)
        //   .duration(sT * 2)
        //   .style("opacity", 1)
        //   .on("end", show)

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

        // remove non-chosen station points
        var allStns = g.select("#rail-stations").selectAll("circle");

        // segment start/ends only; could easily be changed to include more
        let stnsEnRoute = new Set();
        received.segments.forEach(segment => {
          stnsEnRoute.add(segment.departing);
          stnsEnRoute.add(segment.arriving);
        });

        // keep relevant station points
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
      function enrichRoute(chosen) {

        // keeps radius consistent with fitlered pool of enrichData
        let bufferedRoute = turf.buffer(chosen.lineString, 0.5, {units: "degrees", steps: 12}); // ? re: steps (default much more)

        g.append("path")
          .attr("id","route-buffer")
          .attr("d", line(bufferedRoute.geometry.coordinates[0].map(d => projection(d))))
          .attr("fill","none")
          .attr("stroke","none")
          // .attr("fill","slateblue")
          // .attr("stroke","black")

        // filterAndJoin returns enriched route object
        let enriched = Promise.all([/*enrichPolys,enrichLines,*/enrichPts]).then(filterAndJoin,onError);

        return enriched;

        function filterAndJoin(data) {

          // console.log(data)

          // let allPolys = topojson.feature(data[0], data[0].objects.enrichPolys),
          //     allLines = topojson.feature(data[1], data[1].objects.enrichLines),
          //       allPts = topojson.feature(data[2], data[2].objects.enrichPts);

          // POINTS
          let allPts = topojson.feature(data[0], data[0].objects.enrichPts);

          let filteredPts = allPts.features.filter(d => {
            return turf.booleanPointInPolygon(d.geometry,bufferedRoute);
          });

          // LINES
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

          // ADD ALL FILTERED ENRICH DATA TO <DEFS> ELEMENTS
          // include full geometry, relevant properties, and type-spec id for triggerPt crosswalk
          populateDefs(filteredPts/*,filteredLines,filteredPolys*/)

          // NARROW FULL GEOMETRIES DOWN TO SPECIFIC TRIGGER/INTERSECTION PTS FOR SPATIAL SEARCH ALGORITHM
          // let triggerPts = getTriggerPts(filteredPts,filteredLines,filteredPolys,chosen.lineString,bufferedRoute)
          let triggerPts = filteredPts;  // temporary while polys/lines out of this

          // ADD ENRICH DATA TO CHOSEN ROUTE OBJ & RETURN
          chosen.enrichData = {
            triggerPts: triggerPts,
          withinBuffer: bufferedRoute
          }

          // console.log(chosen)

          return chosen;

        }

        // append overlay data to svg <defs> element
        function populateDefs(pts/*,lines,polys*/) {

          var enrichLayer = defs.append("g")
            .attr("id","enrich-layer")

          // var enrichPolys = enrichLayer.append("g")
          //     .attr("id", "enrich-polygons")
          //     .attr("class", "enrich polys extract overlay group")
          //   .selectAll("path")
          //   .data(polys)
          //   .enter().append("path")
          //     .attr("d", projPath)
          //     .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
          //     .classed("enrich poly waiting", true)
          //     .style("fill", d => { return d3.interpolateSinebow(Math.random()); })
          //     .style("stroke", "none")
          //    // .on("intersected", highlightPoly)
          //
          // var enrichLines = enrichLayer.append("g")
          //     .attr("id", "enrich-lines")
          //     .attr("class", "enrich lines extract overlay group")
          //   .selectAll("path")
          //   .data(lines)
          //   .enter().append("path")
          //     .attr("d", projPath)
          //     .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY })
          //     .classed("enrich line waiting", true)
          //     .style("stroke", d => { return d3.interpolateWarm(Math.random()); })
          //     .style("stroke-width", 1.6)
          //     .style("fill", "none")
          //    // .on("intersected", highlightLine)

          var enrichPoints = enrichLayer.append("g")
            .attr("id", "enrich-pts")
            // .attr("class", "enrich points extract overlay group")
            .selectAll(".enrich-pt")
            .data(pts)
            .enter().append("circle")
              .classed("enrich-pt waiting", true)
              .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
              .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
              .attr("r", 1)
              .attr("class", d => { return d.properties.NAME + " " + d.properties.CATEGORY + " " + d.properties.TYPE})
              .style("fill", d => { return d3.interpolateCool(Math.random()); })
              .style("stroke", d => { return d3.interpolateGreys(Math.random()); })
              .style("stroke-width", "0.4px")
             // .on("intersected", highlightPt)

          console.log(pts)
          console.log(enrichLayer.node())
          console.log(enrichPoints.nodes())
          console.log(g.node())

        }

        function getTriggerPts(pts,lines,polys,route,buffer) {

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

      function initAnimation(routeObj) {

        // SETUP
        let point = g.select("#train-point"),
             path = g.select("#full-route");

        // get zoomFollow object including simplified zoomArc, pace, and first/last zoom frames
        let zoomFollow = getZoomFollow();  // pass routeObj, optional focus int (default = 100)
          // arcSlice
          // firstFrame
          // lastFrame
          // pace

        // bind zoomArc to DOM for tracking only (not visible)
        let zoomArc = g.append("path")
          .attr("id", "zoom-arc")
          .datum(zoomFollow.arcSlice.geometry.coordinates.map(d => projection(d)))
          .attr("d", line)
          .style("fill","none")
          .style("stroke","none")
          // uncomment below for visual of zoomArc
            // .style("stroke", "rebeccapurple")
            // .style("stroke-width",1)

        // final user prompt/countdown??
        // if (confirm("Ready?")) {
          experience.animating = true;  // global flag that experience in process
          goTrain(point,path,zoomArc,tprm,tpsm,simpLength,firstLast,routeObj.enrichData);
        // }

        function getZoomFollow(int = 100) { // also requires access to routeObj
                                            // int = miles in/out to focus view, start/stop zoomFollow

          let zoomFollow = {
            arcSlice: [],
            firstFrame: [],
            lastFrame: [],
            pace: {
              tpm: 20,  // time per mile; hard-coded as goal of animated ms per route mile (more == slower)
              tpsm: getTpsm()  // based on tpm, calculated per simplified miles
            }
          }

          let fullLength = Math.floor(routeObj.totalDistance),
             simpOptions = {tolerance: 1, highQuality: false, mutate: true},
                fullSimp = turf.simplify(routeObj.lineString, simpOptions);

          let simpSlice,
              firstLast,
              simpLength = Math.floor(turf.length(fullSimp, {units: "miles"}));

          if (simpLength > 300) {
            firstLast = getFirstLast(fullSimp,int);

            simpSlice = turf.lineSlice(firstLast[0][1],firstLast[1][1],fullSimp);

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

          return zoomFollow;

          function getTpsm() {
            return zoomFollow.pace.tpm * fullLength / simpLength;
          }

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

      // TRANSLATE ONLY
      function zoomAlong(path,k = currentView.scale) {
        var l = path.node().getTotalLength();
        return function(d, i, a) {
          return function(t) {
            // KEEP NODE P IN CENTER OF FRAME
            var p = path.node().getPointAtLength(t * l);
            // calculate translate necessary to center data within extent
            let tx = -k * p.x + width/2,
                ty = -k * p.y + height/2;
            // clip projected data to minimize shift/render calculations?
            let clipExtent = [[-(tx ** 2), -(ty ** 2)], [tx ** 2, ty ** 2]]; // extend for leeway around edges?
            identity.clipExtent(clipExtent)
            projection.clipExtent(clipExtent)
            return "translate(" + tx + "," + ty + ") scale(" + k + ")";
          }
        }
      }

    // UPDATE DATA LANDSCAPE / STRUCTURE
      // add new data layers to svg <defs>
        // function storeNew(overlayers) { }
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



  // AWAIT USER INTERACTION or OTHER NEW INFO
    // UPON RECEIPT...                            ===>  LOOP TO (*)(*)(*)


//////////////////////////
///// MORE FUNCTIONS /////
//////////////////////////

//// SVG

  // MAP DATA

    // QUADTREE / DEFS / SEARCH INTERSECTING
    function makeQuadtree(triggerData,bufferedRoute) {
      // search and nodes functions taken from https://bl.ocks.org/mbostock/4343214

      // get projected bounding box of chosen route
      let pathBox = projPath.bounds(bufferedRoute),
               x0 = pathBox[0][0], // xmin
               y0 = pathBox[0][1], // ymin
               x1 = pathBox[1][0], // xmax
               y1 = pathBox[1][1]; // ymax

      // console.log(pathBox)

      // initiate quadtree with specified x and y functions
      const projectX = d => { return projection(d.geometry.coordinates)[0] },
            projectY = d => { return projection(d.geometry.coordinates)[1] };

      quadtree = d3.quadtree(triggerData,projectX,projectY)
                   .extent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])

      // projection.clipExtent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])
      // identity.clipExtent([[x0 - 1, y0 - 1], [x1 + 1, y1 + 1]])

      ///// QUADTREE / TRIGGER NODES ADDED TO DOM
         // FULL GEOMETRIES WAITING IN DEFS (TO BE ACCESSED UPON TRIGGER)
      let grid = g.append("g")
                  .attr("id","quadnodes")
                  .selectAll(".quadnode")
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

      // console.log(d3.select("#enrich-pool"))

    }

    // OTF RENDERING
    // function dynamicallySimplify() {
    //   minZ = 1 / scale * scale;
    //   // minZi, minZp
    // }
    function redraw(layerGroupSelector){
      d3.selectAll(`g${layerGroupSelector}`) // could be # or .
        .selectAll("path")
          .attr("d",projPath)
    }
    function redrawMap() {
      g.selectAll("path.rendered.projectedOTF").attr("d", projPath);
      g.selectAll("path.rendered").attr("d", projPath);
    }
    function rerender(content = "map") {
      // select content from DOM
      // parse as necessary
      // redraw(content)
        // g.style / transform attr..
    }

  // ZOOM BEHAVIOR
    function dblclicked(d,i) {

      if (active.node() === this) return resetZoom();

      if (d3.event.defaultPrevented) return; // panning, not zooming

      active.classed("active", false);

      active = d3.select(this).classed("active", true);

      zoomTo(projPath.bounds(d))
        // make sure upper-most (clickable) layer is in accordance with path function, or adjust bounds() caller accordingly

    }

    function zoomed() {

      var transform = d3.zoomTransform(this) // .scale(0.8);

      let k = transform.k,
         tx = transform.x,
         ty = transform.y;

      // let abs = v => { return Math.abs(v) },
      //   clipExtent = [[-abs(tx), -abs(ty)], [abs(tx), abs(ty)]];

      let clipExtent = [[-(tx ** 2), -(ty ** 2)], [tx ** 2, ty ** 2]]; // extended for leeway around edges

      identity.clipExtent(clipExtent)
      projection.clipExtent(clipExtent)

      g.style("stroke-width", 1 / (k*k) + "px");

      g.attr("transform", "translate(" + tx + "," + ty + ") scale(" + k + ")");

    }

    function zoomTo(bounds,k) {

      let transform = getTransform(bounds);

      let zoom1 = d3.zoomIdentity
        .translate(transform.x,transform.y)
        .scale(k || transform.k)

      svg.transition().duration(750)
        .call(zoom.transform, zoom1)

    }

    function getTransform(bounds, extent = extent0, padding = 0.1) {

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

    // function setPPBounding([wgsJson,ppJson], crs = "preprojected") {
    //   setBounding(ppJson, crs);
    //   return [wgsJson,ppJson];
    // }
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

    function getScaleAtZoomLevel(zoomLevel, tileSize = 256) {
      return tileSize * 0.5 / Math.PI * Math.pow(2, zoomLevel);
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

    function getIntersecting(train,path,tprm,quadtree) {

      // COMBAK

      // console.log(train.node())
      // console.log(path.node())
      // console.log(tprm)

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

      // console.log(l)

      console.log(quadtree)

      console.log(defs.node())

    }

//// ANIMATION
    function goTrain(point,fullPath,simpPath,tprm,tpsm,simpDistance,[firstThree,lastThree],enrichData) {

      // scale of initial view
      let firstFrame = projPath.bounds(turf.lineString(firstThree)),
      firstTransform = getIdentity(getTransform(firstFrame,extent0,0.4)),
               scale = firstTransform.k;

      // calc first and last zoomIdentity based on stable k
      let firstIdentity = getIdentity(centerTransform(projection(firstThree[1]),scale)),
           lastIdentity = getIdentity(centerTransform(projection(lastThree[1]),scale));

      // tFull is based on ms/simplified mile for tDelay calc reasons
      let tFull = tprm * simpDistance, // effective ms per simp mile * simp miles
         tDelay = (simpDistance > 300) ? tprm * 100 : tprm * 0,      // delay zoomFollow until train hits mm 100 (of fullSimp) IF route long enough
           tMid = tFull - (tDelay*2),  // tDelay doubled to account for stopping 100m from end
           tEnd = 3000;           // arbitrary time to zoom to start frame

      let x0 = firstFrame[0][0], // xmin
          y0 = firstFrame[0][1], // ymin
          x1 = firstFrame[1][0], // xmax
          y1 = firstFrame[1][1]; // ymax

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
            d3.timeout(() => {
              // if (confirm("Ready?")) {
                // d3.timerFlush() // necessary?
                // disable free zooming
                svg.on('.zoom',null)
                // call initial point transition
                goOnNow()
              // }
            }, 3000)
          })

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
                })
            }
            // follow along checking for intersecting encounters
            getIntersecting(point,fullPath,tprm,quadtree)
          })
         .on("end", () => {
           // inform d3 zoom behavior of final transform value and reenable free zooming
           svg.call(zoom.transform, lastIdentity)
           svg.call(zoom)
         });
      }
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
    }

    let train = d3.select("#train-point");
    function departed(t) {
      console.log("train departing @ " + t)
      d3.timerFlush() // necessary?
      train.dispatch("depart")
    }

    let prevLocation, bufferExtent, prevExtent;
    let triggerPts = g.select("#trigger-pts").selectAll(".trigger-pt");
    function trainMoved() { // point,elapsed) {

        let transformMatrix = this.node().transform.animVal[0].matrix,
            currentLocation = [transformMatrix.e, transformMatrix.f];

        // use LngLat coords to calculate bufferExtent given radius in degrees ONE TIME ONLY
        if (!prevExtent) {
          let currentLngLat = projection.invert(currentLocation);

          bufferExtent = projPath.bounds(turf.buffer(turf.point(currentLngLat),0.5,{units: "degrees"}));

          console.log(currentLngLat)
          console.log(bufferExtent)
          console.log(turf.point(currentLngLat),0.5,{units: "degrees"});
          console.log(turf.buffer(turf.point(currentLngLat),0.5,{units: "degrees"}));

        // moving forward, translate initial bufferExtent along with train point
        } else {
          bufferExtent = shifted(prevExtent,prevLocation,currentLocation);
        }
        // regardless, store determined values as baseline for next transform
        prevLocation = currentLocation,
          prevExtent = bufferExtent;

        function shifted(extent,previousPt,currentPt) {
          let tx = currentPt[0] - previousPt[0],
              ty = currentPt[1] - previousPt[1];
          return extent.map(d => { return [d[0]+tx, d[1]+ty]; })
        }

        // temporary visual of train buffer that will eventually trigger unveiling of eco encounters en route
        let bufferVis = g.append("rect")
                         .datum(bufferExtent)
                         .classed("momentary-buffer-vis",true)
                         .attr("x", d => { return d[0][0]; })
                         .attr("y", d => { return d[0][1]; })
                         .attr("width", d => { return Math.abs(d[1][0] - d[0][0]); })
                         .attr("height", d => { return Math.abs(d[1][1] - d[0][1]); })
                         .style("fill","steelblue")
                         .style("stroke","whitesmoke")
                         .style("stroke-width","0.2px")
                         .style("opacity", 0.4)

        // these buffers appear much bigger served from githubPages than from my local atom liveserver..  problem solving this
        console.log(bufferVis.node())

        bufferVis // .lower()
            .transition().duration(750)
            .style("opacity","0.6")
            .on("end", () => {
              bufferVis.transition().duration(750)
                .style("opacity","0")
                .on("end", () => {
                  bufferVis.classed("none",true)
                  bufferVis.remove() // no need for exit() bc datum was appended, not joined?
                })
            })

        // this.raise()

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

//// BUTTONS & FUNCTIONAL ICONS

  // use remoteControl.js for most

  function selectNew() {
    // if mid-animation, pause and confirm user intent
    if (experience.animating) {
      pauseAnimation() // remoteControl.pause()
      let confirmed = confirm('Do you wish to select a new route?');
      if (!confirmed) {
        resumeAnimation(); // remoteControl.play()
        return;
      }
    }
    // in animation finished/canceled or select new confirmed
      // perform variety of resets
      d3.select("#submit-btn-txt").classed("none",false);
      d3.select("#submit-btn-load").classed("none",true);
      experience.initiated = false;
      // resetZoom();
      // open selection form
      oOpen('modal');
  }

//// OTHER EVENT LISTENERS & VISUAL AFFORDANCES

  // (can be passed e event allowing access to e.target and e.type)

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

    // d3.select("#play-pause").on("click", remoteControl.playPause(e))


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

    parent.on("mouseenter", function(d) {
    //     d3.select(this).classed("hover", true).raise();
    //     tooltip.style("opacity", 1).html(d.name)  // eventually getTooltipContent(d)
    //   })
    })

    parent.on("mouseover", onMouseover())
    // parent.on('mouseover', function(e) {
    //   e.target.setStyle({
    //     color: 'greenyellow',
    //     fillColor: 'honeydew',
    //     fillOpacity: 0.7
    //   }).bringToFront()
    //   .openTooltip();
    // });
      function onMouseover() {
        d3.select(this).classed("hover", true).raise();
        tooltip.style("opacity",1).html(getTooltipContent(d))
      }

    parent.on("mouseout", onMouseout())
    // parent.on('mouseout', function(e) {
    //   d3.select(this).classed("hover", false)
    //   //     tooltip.style("opacity", 0)
    //   dataLayer.resetStyle(e.target);
    //   e.target.setStyle({
    //     // fillColor: colorize(percentVal)
    //   }).closeTooltip();
    // });
      function onMouseout() {
        d3.select(this).classed("hover", false) // remove the class
        tooltip.style("opacity", 0)  // hide the element
      }
  }

  function updateTooltip() { }
  function getTooltipContent(d) {
    // var content = '<span class="category">Facility Name: </span>' +
    // '<span class="align-r">' + titleCase(d.Facility_Name) + '</span>' +
    // '<br /><span class="category">Location: </span>' +
    // '<span class="align-r">' + titleCase(d.City) + ', ' + d.State + '</span>' +
    // '<br /><span class="category">2018 Percent Voter Turnout: </span>' +
    // '<span class="align-r">' + Math.floor(d.Total).toLocaleString() +
    // ' metric tons</span>'
    // return content;
  }
  function positionTooltip(event) {
    // update the position of the tooltip relative to location of mouse event (offset 10,-30)
    tooltip.style("left", (d3.event.pageX + 10) + "px")
      .style("top", (d3.event.pageY - 30) + "px");
  }
  // function raiseTooltip(d,i,e) {
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

// PIZAZZ: COLOR

// PIZAZZ: TRANSITIONS

// Map animation, experience, encounters, triggers

  // spur data refresh?, start/end/midpoint?
  // on.("encountered", output(encounter)) // FIXME PSEUDOCODE
    // temp popups/tooltips fade in/out
    // legend-log populated
    // dashboard/trackers updated
    //

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
    // function sortDesc(compared) {
    //   return this.sort(function(a,b) {
    //     return b[compared] - a[compared];
    //   });
    // }
    // function sortAsc(compared) {
    //   return this.sort(function(a,b) {
    //     return a[compared] - b[compared];
    //   });
    // }
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
    // function store(val){
    //   let bigVVal = capitalize(val);
    //   var element = d3.select(`#get${bigVVal}`);
    //   localStorage.setItem(val, element.value);
    //   var stored = localStorage.getItem(val);
    //   return stored;
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
