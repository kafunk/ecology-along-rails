(function () {


  // SET UP ENVIRONMENT (global bindings)

    // MapboxGL
      // mapbox API access Token
        mapboxgl.accessToken = 'pk.eyJ1Ijoia2FmdW5rIiwiYSI6ImNqYmc3dXJzczMzZWIzNHFmcmZuNjY3azMifQ.9i48EOQl4WCGZQqKRvuc_g';

      // initialize map centered on conterminous US // NOTE mapboxgl uses long,lat coordinates
      //   var map = new mapboxgl.Map({
      //     container: 'map',
      //     style: 'mapbox://styles/kafunk/cjhzu1ypk2nhj2sn6qkg8e3x2?optimize=true',
      //     center: [-96.1,39.5],
      //     zoom: 3.2,
      //     minZoom: 3,
      //     maxZoom: 18,
      //     // maxBounds:([-140,20],[-50,59.5]),
      //     attributionControl: false
      //   });
      //
      // map.scrollZoom.disable()
      // map.addControl(new mapboxgl.NavigationControl());
      //    // .addControl(new mapboxgl.AttributionControl({
      //    //      compact: true}));


    // D3

      // calculate d3 projection
      var projection = d3.geoMercator()
        .center([100,50])
        .scale(240)
        .rotate([-180,0])
        // .translate([bbox.width/2, bbox.height/2])
        // .scale(scale);

      // define path function expression for later use
      var path = d3.geoPath()
        .projection(projection);

      // for now, just to make this fun
      // var color = d3.scaleThreshold()
      //     .domain(d3.range(2, 10))
      //     .range(d3.interpolateMagma[9]);

      // define width and height of our SVG
      var height = 600,
           width = 960;

      // // declare svg layer to manipulate with d3
      // var container = map.getCanvasContainer();
      var svg = d3.select('#map').append("svg")
        // necessary?
          .attr("width", width)
          .attr("height", height)

      // // we calculate the scale given mapbox state (derived from viewport-mercator-project's code) to define a d3 projection
      // function getProjection() {
      //   var bbox = document.body.getBoundingClientRect();
      //   var center = map.getCenter();
      //   var zoom = map.getZoom();
      //   // 512 is hardcoded tile size, might need to be 256 or changed to suit your map config
      //   var scale = (512) * 0.5 / Math.PI * Math.pow(2, zoom);
      //
      //   var projection = d3.geo.mercator()
      //     .center([center.lng, center.lat])
      //     .translate([bbox.width/2, bbox.height/2])
      //     .scale(scale);
      //
      //   return projection;
      // }


  // INITIATE DATA LOAD
    var railLinesJson = d3.json("../data/na-pass-rail-lines.json"),
        railNodesJson = d3.json("../data/na-pass-rail-nodes.json"),
          ecoBaseJson = d3.json("../data/na-ecoreg-iii-all.json"),
       ecoExtractJson = d3.json("../data/na-ecoreg-iv-extract.json"),
        hydroBaseJson = d3.json("../data/na-watersheds-all.json"),  // add rest of hydro polys here?
        huExtractJson = d3.json("../data/na-watersheds-extract.json");

        // more: hydrolines, pois incl bridges, tunnels, iNat

  // DRAW MAP BASE -- USE D3 FOR THIS? (D3 ONLY?) OR ADD TO MAPBOX STUDIO TILES?
    // make sure pertinent data files are completely loaded before sending data on to callback function
    Promise.all([railLinesJson,ecoBaseJson,hydroBaseJson]).then(drawBase, error);

    // catch errors, if any
    function error(error) {
      console.log(error)
    }

    // accepts the data array
    function drawBase(data) {

      // parse base topojson data as mesh
      console.log(data);
      // console.log(getLL(data[0]), project(data[0]))

      var railways = data[0],
         railnodes = data[1],
        watersheds = data[2],
        ecoregions = data[3];


      var allRoutes = topojson.mesh(data[0], data.objects.na-rail-all),
          hydroBase = topojson.mesh(data[1], data.objects.na-watersheds),
            ecoBase = topojson.mesh(data[2], data.objects.na-ecoregions);

      var path = d3.geoPath(),
          mesh = topojson.mesh(us),
          transform = topojson.transform(us);
      console.log(allRoutes);

      var baseData = {
        id0: {
          name: "hydro",
          dIndex : 0,
          objectClass: "na-watersheds"
        },
        id1: {
          name: "eco",
          dIndex : 1,
          objectClass: "na-ecoregions"
        },
        id2: {
          name: "rails",
          dIndex : 2,
          objectClass: "na-rails-all"
        }
      };

      function getMeshArray(dataGroups) {
        const meshArray = [];
        for (var group in dataGroups) {
          meshArray.push(topojson.mesh(data[group.dIndex], data.objects[group.objectClass], function(a, b) { return a !== b; }));
        }
        return meshArray;
      }

      //  create group for baselayer data with one path per layer type
      var baseLayers = svg.append("g")
        .selectAll("path.base")  // use mesh?
        .data(getMeshArray(baseData))
        enter().append("path").classed("base",true)
          .attr("d",path)
          // .attr("class", attribute) // ?
          // .attr("class", d => { return baseData.(d.id).name } // what is d.id?
          .attr("transform", "translate(0,40)") // what does this do?
          .style({
            fill: "#ccc",
            // "fill-opacity": 0.6,
            stroke: "#004d60",
            // "stroke-width": 1
          })

    }

  // INITIATE ANIMATED JOURNEY EXPERIENCE
    initNew(); // <====================== fun stuff starts here

    function initNew() {
      // get initial user options
      var selection = getRoute();

      // prep route specific data
      var newRoute = prepOverlay(selection);

      // initiate animation
      initExp(newRoute);
    }

    function getRoute(){
      // get user input! see koordinates example
      // toggle form overlay
      // listen for start selection to change

      // save start selection
      // var startPt = GET;
      // // save end selection
      // var endPt = GET;
      // match input nodes with route/line
      // collapse form, ease to give summarizing feedback ('Loading...')
      // return [start,end];
    }

    function prepOverlay(selection) {

      // ensure data has loaded
      Promise.all([railNodes,ecoExtract,huExtract]).then( data => {
        // catch errors
        if (error) throw error;

        // parse all
        console.log(data);
        var waypoints = topojson.feature(data[0], data.objects.na-pass-rail-nodes),
          watershedExtract = topojson.feature(data[1], data.objects.watersheds-along-rail),
          ecoregExtract = topojson.feature(data[2], data.objects.ecoregions-along-rail);

        // append overlay data to svg as unrendered <defs> element
        // var overlayData = [];
        //   // classes: routeName,huc,
        //
        // getFeaturesArray()
        //
        var overlayers = svg.append("defs")
          .append("g")
          .attr("class",overlay)

        var hydroSelect = overlayers.append("g")
          .selectAll("path.hydro")
          .data(topojson.feature(hydroExtract,hydroExtract.objects.watersheds-along-rail).features)
          // .data(getFeaturesArray(overlayData))
          .enter().append("path").classed("overlay",true)
            .attr("d",path)
            .attr("fill", function (d) { return color(d.value) })

        // filter to user selection (? faster to integrate with above?)
        var thisRoute = {
          startPt: [],
          endPt: [],
          routeName: ''
          //etc
        };

        return thisRoute;

      });
    }

  // ANIMATION FUNCTIONALITY
    function initExp(newRoute){
      // attach data to DOM nodes
      // animate point along line
      // as point intersects new features, style them gradually
    }


  // EVENT LISTENERS

    // map.on("load",promptRoute());

    // keep d3 and mapbox visuals aligned
      // rerender d3 elements when view changes
      // map.on("viewreset", function() {
      //   render()
      // })
      // map.on("move", function() {
      //   render()
      // })

    // inform
      // update popups, tooltips, dashboard, log
    // adjust -- rewind,pause,switch to point en route
      // call on certain functions
    // reset
      // initNew();

    // add visual affordance and tooltip to POIs
    // .on("mouseover", function(d) {
    //   d3.select(this).classed("hover", true).raise();
    //   tooltip.style("opacity", 1).html(d.name)  // eventually getTooltipContent(d)
    // })
    // .on("mouseout", function() {
    //   d3.select(this).classed("hover", false)
    //   tooltip.style("opacity", 0)
    // })


    // listen for click of go button

    //
    function populateDropdowns(stations) {
      // access specific dropdown elements from markup
      var chooseStart = d3.select('#startSelect'),
            chooseEnd = d3.select('#endSelect');

      // start with start; end will depend on this
      var startPts = stations.unique().sort();  // '.unique' is not real code, fix this
      var endPts; // just declaring the var for now

      // create an option element for each start point
      chooseStart.selectAll('option')
        .data(startPts.sort())
        .enter().append('option')
          .text( d => { return d.stationName })
          .attr("value", d => { return d.franode })
        // listen for input
        .on('change', endPts = getEndPts());

      chooseEnd.selectAll('option')
        .data(endPts.sort())
        .enter().append('option')
          .text( d => { return d.stationName })
          .attr("value", d => { return d.franode })


      // inner function, stations var remains accessible
      function getEndPts() {

        // register (and validate?) selected start node
        var givenStart = chooseStart.property("value");

        // define hypothetical end pt possibilities
        var potentialEnds = allStations.unique().sort();

        // exclude certain end points, depending on..? within
        var endsToExclude = [];
        // if Alaska, Mexico, ?
          // exclude anything not on immediate route
        // otherwise: exclude anything TOO close?
          // exclude anything where path cannot be determined
          // or, pair with nodes on same route?

        return potentialEnds - endsToExclude; // subtracting arrays is unfortunately not a thing; fix this
      }
    }
  }
)

  // FORM: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/form
