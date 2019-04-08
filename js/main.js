// (function () {

///////////////////////////
//// SETUP ENVIRONMENT ////
//// (global bindings) ////
///////////////////////////

//// INITIATE DATA LOAD

  // Typical Mapshaper CLI transform:
    // mapshaper *filein*.geojson name=*objectunits* \
    //     -o quantization=1e5 format=topojson mapshaped/*fileout*.json
    // then simplified and cleaned in browser for visual

  // background/reference
  var initBounds = d3.json("data/final/bounding.json"),
          admin0 = d3.json("data/final/admin0.json"),
          admin1 = d3.json("data/final/admin1.json"),
            land = d3.json("data/final/land.json"),
          places = d3.json("data/final/places.json"),
         // terrain = d3.buffer("data/final/terrain.tif"),
       hydroBase = d3.json("data/final/hydro_base.json"),
       urbanBase = d3.json("data/final/urban_areas.json"),
  // rail
        railBase = d3.json("data/final/railways.json"),
        railStns = d3.json("data/final/na_rr_stns.json"),
  // merged enrich data
     enrichPolys = d3.json("data/final/enrich_polys.json"),
     enrichLines = d3.json("data/final/enrich_lines.json"),
       enrichPts = d3.json("data/final/enrich_pts.json"),
  // quadtree ready
    quadtreeReps = d3.json("data/final/quadtree_search_reps.json"),
      triggerPts = d3.json("data/final/enrich_trigger_pts.json");

//// CURRENT STATE MANAGEMENT (NOT IDEAL)

  let experience = { initiated: false, animating: false }
  let togglesOff = { info: false, select: false }
  let panned = { flag: false, i: 0 }

//// KEEP ADJUSTABLE VARIABLES ACCESSIBLE: eventually some of these could be user-controlled via sliders and such

  var arcSteps = 500  // how fine tuned SVG path animation
    headlightRadius = 6,
    tpm = 80,  // time per mile; hard-coded goal of animated ms per route mile (more == slower) *** I WANT THIS USER ADJUSTABLE BUT tFULL uses it to set animation length at very begin, so not sure I can make this dynamic given current structure
    minT = tpm * 10,
    tPause = 2400,  // standard delay time for certain transitions
    viewFocusInt = 100,  // miles in/out to initially focus view, start/stop zoomFollow
    zoomDuration = tPause *2,  // zoom to frame transition duration
    zoomEase = d3.easeCubicIn,
    zoomFollowInit = 15, // hard coded scale seems to be widely appropriate given constant bufferExtent; ~12-18 good
    zoomAlongOptions = {padBottom: 1 + zoomFollowInit/10},
    relativeDim = 0.4;  // dimBackground level

//// READY MAP

// SVG & SIZING

  var padX = 0,
      padY = -18;

  var initial = calcSize();

  var extent0 = [[-initial.width/2, -initial.height/2],[initial.width/2, initial.height/2]],
   translate0 = [(initial.width + padX)/2, (initial.height + padY)/2],
       scale0 = 0.9;  // initial overview scale

  var svg = d3.select("#map").append("svg")
    .attr("width", initial.width)
    .attr("height", initial.height)
    .attr("preserveAspectRatio", "xMidYMid meet") // slice")
    .attr("viewBox", `0 0 ${initial.width} ${initial.height}`)

  // space to define elements for later <use></use>
  var defs = svg.append("defs");

  var background = svg.append("rect")
    .attr("id", "background")
    .attr("width", initial.width)
    .attr("height", initial.height)
    .style("fill", "none")
    .style("pointer-events", "all")
    .on("dblclick", function() {
      resetZoom()  // having this inside wrapper function avoids error from not yet having declared `active`
    })

  // all rendered/zoomable content
  var g = svg.append("g")
    .attr("id", "zoomable")

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

  var path = d3.geoPath().projection(projection);

  var line = d3.line().curve(d3.curveCardinal.tension(0));

// SLIDERS & OTHER USER CONTROLS

  // SET UP ZOOM BUTTON CONTROL
  let scaleExtent = [0,49], step = 6,
    zoomValues = d3.range(scaleExtent[0],scaleExtent[1],step);

  let min = Math.min(...zoomValues),
      max = Math.max(...zoomValues);
  d3.select("button#zoomIn")
    .attr("min", min)
    .attr("max", max)
  d3.select("button#zoomOut")
    .attr("min", min)
    .attr("max", max)

  d3.select("label#zoom").attr("value",scale0)
  d3.selectAll("button.zoom-btn").on('click', zoomClick);

// PAN/ZOOM BEHAVIOR

  var zoom0 = d3.zoomIdentity.translate(translate0[0],translate0[1]).scale(scale0)

  var active = d3.select(null);

  var zoom = d3.zoom()
    // .translateExtent(extent0)  // things eventually get wonky trying to combine these limits with responsive SVG
    // .scaleExtent([scale0*0.5, scale0*64])
    .on("zoom", zoomed)

  svg.call(zoom.transform, zoom0) // keep this line first
     .call(zoom)

//// COLORS

  const palette = ['#94417f','#CD5C5C','#fa8253','#ec934a','#c7993f','#dbd99f']

  const paletteScale = chroma.scale(palette).domain([1,0]).mode('lch') //.correctLightness();

  const riverBlue = "aquamarine",
         lakeBlue = "teal";

  const purple = '#c97b9f',
     purpleRed = '#94417f',
     orangeRed = '#f94545',
   peachOrange = '#f9b640',
   yellowPeach = '#ec934a',
    yellowGold = '#c7993f',
     goldGreen = '#b5be6a',
    groupGreen = '#8bc188',
     groupBlue = '#09a094';

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
      8: { base: "#8bc188" },
      9: { base: "#f3c28a" },
      10: { base: "#EEE8AA" }, // '#9dc579'
      11: { base: "#c9e1a9" },
      12: { base: "#d3cd80" },
      13: { base: "#8bc188" }, // '#b1d57b'
      14: { base: "#e96c53" },
      15: { base: "#b75b9f" }
    }
  };

  // GRADIENTS
  // append to svg <defs> and give each a unique id

  // used for current train point
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

  const outline1 = "rgba(76, 83, 91, .6)",  // could also be url(#pattern)s
        outline2 = "rgba(76, 83, 91, .3)"

// IMPORTED ICONS

  defs.append("image")
    .attr("id", "station-icon")
    .attr("xlink:href","../assets/station.svg")
    .attr("width", 3.2)
    .attr("height", 4)
    .attr("x",-1.6)
    .attr("y",-2)
  defs.append("image")
    .attr("id", "station-icon-sm")
    .attr("xlink:href","../assets/station.svg")
    .attr("width", 1.6)
    .attr("height", 2)
    .attr("x",-0.8)
    .attr("y",-1)

// DEFAULT OPTIONS

  let defaultOptions = {
    extent: extent0,
    scalePad: 0.1,
    padTop: 0,
    padRight: 0,
    padBottom: 0,
    padLeft: 0
  }
  let quadtreeDefaultOpts = {
    projectX: d => projection(d.geometry.coordinates)[0],
    projectY: d => projection(d.geometry.coordinates)[1]
  }

// MORE DATA, CATEGORY ASSIGNMENT, ETC

  let readyAndWaiting = {}; // IMPORTANT! will be populated with filtered enrich features and accessed as associated trigger pts encountered en route

  let assocCols = {
    "pt": "A",
    "py": "B",
    "ln": "C"
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
  let encounteredPts = new Set(), // [],
    encounteredLines = new Set(), // [],
    encounteredPolys = new Set(), // [],
    uniqueEncounters = new Set(),
       allEncounters = {
         "A": [],
         "B": [],
         "C": []
       };

  let logGroups = new Set(),
       tagTypes = new Set(),
      symbolSet = new Set();

  let enrichCats = {  // enrichData categories/logTypes
    "ECOREGION": {
      divId: "ecoregions",
      fullTxt: "Ecoregions"
      // no keywords; CATEGORY === "Ecoregion"
      // subId = ecoZone + LEVEL
      // fill only, no texture;:
        // base color derived from one of 13 parent ecoZones
          // 5 shades/variations by level?
    },
    "WATERSHED": {
      divId: "watersheds",
      fullTxt: "Watersheds"
      // no keywords; CATEGORY === "Watershed"
      // subId = oceanId (no levels)
      // lines only, no texture:
        // same dash-array, 5 colors (per oceanId)
    },
    "LAKE": {
      divId: "lakes",
      fullTxt: "Lakes",
      textureType: "paths",
      textureProps: {d: "waves", background: lakeBlue, stroke: "mediumseagreen", thicker: 36, lighter: 24, shapeRendering: "crispEdges"}
      // no keywords, CATEGORY.startsWith("Lake")
    },
    "RIVER": {
      divId: "rivers",
      fullTxt: "Rivers"
      // no keywords, CATEGORY.startsWith("River")
      // lines only, no texture
        // color === riverBlue
    },
    "ROADLESS": {
      divId: "roadless-areas",
      fullTxt: "Inventoried Roadless Areas",
      textureType: "paths",
      textureProps: {d: "nylon", thicker: 36, lighter: 24, shapeRendering: "crispEdges"}
      // no keywords; DESCRIPTION (?) === "Inventoried Roadless Area"
    },
    "GRASSLAND": {
      divId: "grassland",
      fullTxt: "Grasslands",
      textureType: "lines",
      textureProps: {thicker: 36, lighter: 24, orientation: "1/8"}
    },
    "VOLCANO": {
      divId: "volcanoes",
      fullTxt: "Volcanoes",
      textureType: "paths",
      textureProps: {d: "caps", thicker: 36, lighter: 24, shapeRendering: "crispEdges"}
      // rarely used:  will either be protected area (and thus share protected area texturing) or be a simple pt to begin with
      // no keywords; CATEGORY.startsWith("Volcano")
    },
    "GEOTHERMAL": {
      divId: "geothermal-areas",
      fullTxt: "Other Geothermal Areas",
      textureType: "lines",
      textureProps: {thicker: 36, lighter: 24, orientation: "8/8"} // rarely used:  will either be protected area (and thus share protected area texturing) or be a simple pt to begin with
      // no keywords; CATEGORY === "Geothermal System"
    },
    "PA1": {  // must match one of EACH keyword category
      divId: "pa-grp1",
      fullTxt: "Protected Areas - Group 1",  // primary
      keywords1: ["national", "state", "provincial"].map(d => d.toUpperCase()),
      keywords2: ["park", "parks", "monument", "monuments", "seashore", "lakeshore", "forest", "forests", "refuge", "grassland", "grasslands"].map(d => d.toUpperCase()),
      // kw2Slimmed: [park*, monument*, forest*, grassland*],
      weight: 1,
      textureType: "paths",
      textureProps: {d: "hexagons", thicker: 36, lighter: 24, shapeRendering: "crispEdges"},
      getStroke(d) {
        let description = d.properties.DESCRIPTION.toUpperCase();
        if (description.match("NATIONAL")) {
          return outline1;
        } else if (description.match("STATE") || description.match("PROVINCIAL")) {
          return outline2;
        }
      }
    },
    "PA2": {
      divId: "pa-grp2",
      fullTxt: "Protected Areas - Group 2",  // secondary
      keywords: ["national", "state", "provincial", "park", "parks", "monument", "monuments", "seashore", "lakeshore", "forest", "forests", "refuge", "grassland", "grasslands", "reserve", "preserve", "conservation", "conservancy", "environmental", "critical", "wetland", "wetlands", "wilderness", "ecological", "biodiversity", "botanical", "study", "research", "science"].map(d => d.toUpperCase()), // ??
      // kwSlimmed: [park*, monument*, forest*, grassland*, conserv*, wetland*],
      weight: 2,
      textureType: "paths",
      textureProps: {d: "crosses", thicker: 36, lighter: 24, shapeRendering: "crispEdges"}
      // national, state, provincial, park, monument, etc matches will be disjoint from PA1 group above (matched only one keyword group, not both)
    },
    "PA3": {
      divId: "pa-grp3",
      fullTxt: "Protected Areas - Group 3",  // remaining
      weight: 3,
      textureType: "circles",
      textureProps: {complement: true, thicker: 36, lighter: 24}
      // no keywords; CATEGORY === "Protected Area" && DESCRIPTION !== "Inventoried Roadless Area"
    }
  },
         catKeys = Object.keys(enrichCats);

  let paTags = {  // protected area tags; not mutually exclusive with protected area categories, but mutually exclusive amongst each other; catalogued in order of first preference / weight
    "geo": {
      divId: "pa-geo",
      fullTxt: "Geothermal",  // or likely so
      keywords: ["geothermal", "geologic", "geological", "volcano", "volcanoes", "volcanic", "stratovolcano", "stratovolanic", "stratovolcanoes", "lava", "lavas", "dome", "domes", "cone", "cones", "cinder", "cinders", "maar", "maars", "caldera", "calderas", "tuff ring", "tuff rings", "pyroclastic", "geyser", "geysers", "hot spring", "hot springs", "hot well", "hot wells", "sulphur", "sulphuric", "boiling", "mount", "mt"].map(d => d.toUpperCase()),
      // kwSlimmed: [geo*, volcan*, strato*, lava*, dome*, cone*, cinder*, maar*, caldera*, tuff*, geyser*, pyro*, sulphur*, /^(hot)\s+/, /\s+(cone)\s*/],  // these regexes don't necessary work yet!
      weight: 1,
      color: orangeRed
    },
    "hab": {
      divId: "pa-hab",
      fullTxt: "Habitat",
      keywords: ["habitat", "habitats", "wildlife", "den", "dens", "breeding", "migratory", "migration", "critical", "gathering", "species", "sccc", "fish", "fauna", "range", "ranges", "nest", "nesting", "pupping", "grounds"].map(d => d.toUpperCase()), // ALSO, HABITAT FLAG!
      // kwSlimmed: [habitat*, den*, migrat*, nest*, range*],
      weight: 2,
      color: goldGreen
    },
    "water": {
      divId: "pa-water",
      fullTxt: "Water-Related",
      keywords: ["wetland", "wetlands", "sea", "seashore", "seashores", "lake", "lakeshore", "lakeshores", "beach", "beaches", "coast", "coasts", "coastal", "marine", "estuary", "estuarine", "estuaries", "riparian", "spring", "springs", "water", "waters", "waterway", "waterways", "creek", "creeks", "stream", "streams", "river", "rivers", "confluence", "lake", "lakes", "bog", "bogs", "marsh", "marshes", "delta", "deltas", "tributary", "tributaries", "rapid", "rapids", "cove", "coves", "rio", "río"].map(d => d.toUpperCase()),
      // kwSlimmed: [water*, wetland*, sea*, stream*, creek*, bog*, lake*, beach*, coast*, estuar*, spring*, river*, lake*, delta*, tributar*, rapid*, marsh*, cove*],
      weight: 3,
      color: groupBlue
    },
    "wild": {
      divId: "pa-wild",
      fullTxt: "Other Wildlands",
      keywords: ["wild", "wilds", "wildland", "wildlands", "wilderness", "ecology", "ecological", "grassland", "grasslands", "biodiverse", "biodiversity", "refuge", "refuges", "botanical"].map(d => d.toUpperCase()),
      // kwSlimmed: [wild*, ecolog*, grass*, biodivers*, refuge*],
      weight: 4,
      color: yellowGold
    },
    "sci": {
      divId: "pa-sci",
      fullTxt: "Science & Research",
      keywords: ["experiment", "experimental", "study", "studies", "station", "stations", "research", "science", "scientific", "school", "schools"].map(d => d.toUpperCase()),
      // kwSlimmed: [experiment*, stud*, station*, scien*, school*],
      weight: 5,
      color: peachOrange
    },
    "rec": {
      divId: "pa-rec",
      fullTxt: "Recreational",
      keywords: ["recreation", "recreational", "trail", "trails", "greenway", "greenways"].map(d => d.toUpperCase()),
      // kwSlimmed: [recreat*, trail*, greenway*],
      weight: 6,
      color: purpleRed
    },
    "rpc": {
      divId: "pa-rpc",
      fullTxt: "Otherwise Reserved/Preserved/Conserved",
      keywords: ["reserve", "reserves", "preserve", "preserves", "conservation", "conservancy", "conservancies", "easement", "easements"].map(d => d.toUpperCase()),
      // kwSlimmed: [reserve*, preserve*, conserv*, easement*],
      weight: 7,
      color: yellowPeach
    },
    "general": {
      divId: "pa-gen",
      fullTxt: "Other Primary",
      keywords: ["national","state","provincial","park"].map(d => d.toUpperCase()),
      weight: 8,
      color: groupGreen,
    },
    "other": {
      divId: "pa-other",
      fullTxt: "Other - Secondary",  // vaguest
      keywords: ["nature", "natural", "open", "scenic", "historic", "blm", "land", "lands", "area", "areas", "protection", "protected"].map(d => d.toUpperCase()),  // only match if no better fit
      // kwSlimmed: [natur*, land*, area*, protect*],
      weight: 9,
      color: purple
    }
    // ANYTHING LEFTOVER??
  },
      paKeys = Object.keys(paTags),
    tagWords = Object.values(paTags).map(d => d.keywords);

// AS YET EMPTY, ZERO, OR UNDEFINED

  let prevLocation, prevRotate, prevExtent, searchExtent;

  let mm = 0, accumReset = 0, geoMM;

  let totalMiles, totalTime, minPerMile;

  let timer, routeQuadtree; // observer

  var labels = [];

// FUNCTION EXPRESSIONS

  var labelLayout = d3.forceSimulation(labels)
    // .force('collision', rectCollide().size(d => [d.label.length, 1])) // size is relative estimate based on number of letters long (x constant letters high)
    // .force('collision', d3.forceCollide().radius(1))
    .force('x', d3.forceX().x(d => d.x0).strength(100))
    .force('y', d3.forceY().y(d => d.y0).strength(100))
    // .on('tick', updateLabelPositions)
    .stop()  // will control ticks manually as labels are added

  const cityState = d => {
    let region = d.state || d.province;
    return d.city + ", " + region;
  }

// CUSTOM DISPATCH BEHAVIOR

  let dispatch = d3.dispatch("depart","move","encounter","arrive","force")
    .on("depart.train", departed)
    .on("move.train", trainMoved)
    .on("encounter.trigger", encountered)
    .on("arrive.train", arrived)
    .on("force.tick", updateLabelPositions)

// MAKE DASHBOARD RESIZABLE from http://jsfiddle.net/meetamit/e38bLdjk/1/

  var childResizers = d3.selectAll('.child-resizer'),
    siblingResizers = d3.selectAll(".sibling-resizer");

  var childResize = d3.drag()
    .on('drag', childDrag);
  var siblingResize = d3.drag()
    .on('drag', siblingDrag);

  childResizers.call(childResize)
  siblingResizers.call(siblingResize)

  // ensure no event listener conflicts between resizer divs and nearby collapse btns (https://bl.ocks.org/mbostock/a84aeb78fea81e1ad806)
  d3.select("#dash-collapse-btn")
    .on("touchstart", nozoom)
    .on("touchmove", nozoom)
  d3.select("#about-collapse-btn")
    .on("touchstart", nozoom)
    .on("touchmove", nozoom)

// OTHER WORTHWHILE

  const miles = { units: "miles" }  // used repeatedly within turf.js method calls

/////////////////////////////
////// ACTION! FINALLY //////
/////////////////////////////

//// PREPARE MAP LAYERS

  // SET BOUNDING BOX
  initBounds.then(data => {
    projection.fitExtent(extent0,topojson.feature(data,data.objects.bounds))
  }, onError)

  // DRAW VECTOR BASE
  Promise.all([admin0,admin1,land,places,hydroBase,urbanBase,railBase,railStns]).then(drawBase, onError);

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
   continentMesh = getMesh(sourceData.land,"land"),
   countriesMesh = getMesh(sourceData.countries,"countries"),
      statesMesh = getMesh(sourceData.states,"states");

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
      .attr("d", path(continentMesh))
      .style("stroke","#004c4c")
      .style("stroke-width",0.2)
      .style("opacity",1)
      .style("stroke-opacity",0.8)
      .style("fill","dimgray")

    hydroBase.append("path")
      .attr("id", "lake-mesh")
      .attr("d", path(lakeMesh))
      .style("fill","cyan")
      .style("stroke","teal")
      .style("stroke-width",0.1)
      .style("opacity",0.6)
      .style("stroke-opacity",1)

    urbanBase.append("path")
      .attr("id", "urban-areas")
      .attr("d", path(urbanMesh))
      .attr("stroke","silver")
      .attr("fill","gainsboro")
      .style("stroke-width",0.1)
      .style("opacity",0.6)

    // STROKED MESH
    adminBase.append("path")
      .attr("id","country-borders")
      .attr("d", path(countriesMesh))
      .style("fill","none")
      .style("stroke","yellowgreen")
      .style("stroke-width",0.6)

    adminBase.append("path")
      .attr("id","state-borders")
      .attr("d", path(statesMesh))
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
        .attr("d", path)
        .style("fill","none")
        .style("stroke","teal")
        .style("stroke-width", d => { return d.properties.strokeweig })

    railBase.append("g")
      .attr("id", "railways")
      .selectAll("path")
      .data(sourceData.railways.gj.features)
      .enter().append("path")
        .attr("d", path)
        .attr("stroke-width", d => { return (8/(d.properties.scalerank * 4)) }) // 10/(d.properties.scalerank ** 2)
        .attr("stroke","lightslategray")
        .style("fill", "none")
        .style("opacity",1)

    // POINT FEATURES
    urbanBase.selectAll("circle")
      .data(sourceData.places.gj.features)
      .enter().append("circle")
        .attr("r", d => d.properties.scalerank * 0.01)
        .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
        .property("name", d => { return cityState(d.properties); })
        .property("orig-stroke-opacity",0.8)
        .style("fill", "yellowgreen")
        .style("stroke", "mediumseagreen")
        // .style("stroke-width", d => d.properties.scalerank * 0.01)
        .on("mouseenter", onMouseenter)
        .on("mouseout", onMouseout)

    railBase.append("g")
      .attr("id", "rail-stations")
      .selectAll("use")
      .data(sourceData.stations.gj.features)
      .enter().append("use")
        .attr("xlink:href", "#station-icon")
        .attr("x", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("y", d => { return projection(d.geometry.coordinates)[1]; })
        .property("name", d => { return cityState(d.properties); })
        .style("opacity", 1)
        .on("mouseenter", onMouseenter)
        .on("mouseout", onMouseout)

    // // sort stations by city name
    // let sorted = sourceData.stations.gj.features.sort( (a,b) => {
    //   return a.properties.city > b.properties.city;
    // });

    let shuffled = shuffle(sourceData.stations.gj.features);

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

    d3.timerFlush() // necessary?

    // opt0 == from, opt1 == to

    let testOpt0 = opt0.split(', '),  // note space after comma
        testOpt1 = opt1.split(', ');
    if (testOpt0[testOpt0.length-1] === 'CHI') {
      opt0 = testOpt0.slice(0, testOpt0.length-1).join(" ");
    }
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

      // debugging rare error from turf.js
      if (!Array.isArray(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat()) || raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat().length < 2) {
        console.log("problem!")
        console.log(raw)
        console.log(raw.routes[0].segments)
        console.log(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)))
        console.log(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates))
        console.log(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat())
      }

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
      thisRoute.to.coords = getCoords()
      thisRoute.from.coords = getCoords()

      function getSteps(steps = 500) {  // controlled simplification of route; returns one coord for every (inMiles/steps) miles
        let chunkLength = Math.max(1,Math.round(inMiles/steps)),  // must be at least 1 to avoid errors (happens when getting arcPts on very short routes) but Math.ceil too frequently results in double-length milemarker segments
          lineChunks = turf.lineChunk(mergedGJ,chunkLength,miles).features,
          firstCoords = lineChunks.map(d=>d.geometry.coordinates[0]),
          lastChunk = lineChunks[lineChunks.length-1].geometry.coordinates,
          lastCoord = lastChunk[lastChunk.length-1];
        return firstCoords.concat([lastCoord]);
      }

      function truncatedProject(coords) {
        return coords.map(d => projection(turf.truncate(turf.point(d),{precision:5,mutate:true}).geometry.coordinates));
      }

      // likely will not need all this information
      function storeSegmentDetails(segment) {
        return {
            agency: (segment.agencies) ? raw.agencies[segment.agencies[0].agency] : null,
          lineName: (segment.agencies) ? segment.agencies[0].lineNames[0] : null,
        lineString: polyline.toGeoJSON(segment.path),
          distance: kmToMi(segment.distance),
             stops: segment.stops,
         departing: raw.places[segment.depPlace],
          arriving: raw.places[segment.arrPlace]
        }
      }

      function getCoords() {
        this.coords = [this.lng,this.lat]
        return this.coords
      }

      return thisRoute;

    }

    // Relate route waypts/nodes/links to spatially intersecting (given buffer) data for interesting and illuminating route experience
    function enrichRoute(chosen) {

      let headlightDegrees = 1.5; // was 0.5; play around with approximate conversion of degrees -> pixels given path? (some combo of path.measure() and projection.invert()?)

      // keep radius consistent with filtered pool of enrichData
      chosen.bufferedRoute = turf.buffer(chosen.lineString, headlightDegrees, {units: "degrees", steps: 12});

      // // optional buffer viz
      // g.append("path")
      //  .attr("id","route-buffer")
      //  .attr("d", line(chosen.bufferedRoute.geometry.coordinates[0].map(d => projection(d))))
      //  .attr("fill","slateblue")
      //  .attr("stroke","black")

      let possFeatures = Promise.all([quadtreeReps,initBounds]).then(getIntersected,onError);

      // bind all trigger points to the DOM for en route intersection
      Promise.all([possFeatures,triggerPts]).then(([idList,pts]) => {

        const onList = d => {
          return idList.has(d.properties.id)
        }

        const withinBuffer = d => {
          return turf.booleanPointInPolygon(d,chosen.bufferedRoute);
        }

        let quadData = topojson.feature(pts, pts.objects.triggerPts).features.filter(onList).filter(withinBuffer)

        let options = {
          bounding: chosen.bufferedRoute
        }

        routeQuadtree = makeQuadtree(quadData,options)

        // // optional grid visualization:
        // visualizeGrid(routeQuadtree) (also toggle commented out in searchQuadtree())

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

        // // optional data viz; toggle commented out areas in searchQuadtree(), too, for full experience
        // visualizeGrid(quadtree);
        // bindQuadtreeData(quadtree);

        let searchExtent = padExtent(path.bounds(chosen.bufferedRoute))  // add x padding to initial quadtree searchExtent to ensure initial filter sufficiently broad; uncomment below for visual

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
        //   .datum(path.bounds(chosen.bufferedRoute))
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
        console.log("quadtree #1 construction + search took", Math.floor(end-begin))

        console.log("total filtered from pool by quadtree #1:",filteredEnrich.length)

        let possibleFeatures = new Set(filteredEnrich.map(d => d.properties.id));

        console.log("unique possibleFeatures by id:",[...possibleFeatures].length)

        enrichPts.then(pts => {
          console.log("all pts loaded by",Math.floor(performance.now()))
          topojson.feature(pts, pts.objects.enrichPts).features.filter(d => { return possibleFeatures.has(d.properties.id) }).forEach(pt => {
            readyAndWaiting[pt.properties.id] = pt;
          })
        })
        enrichLines.then(lines => {
          console.log("all lines loaded by",Math.floor(performance.now()))
          topojson.feature(lines, lines.objects.enrichLines).features.filter(d => { return possibleFeatures.has(d.properties.id) }).forEach(line => {
            readyAndWaiting[line.properties.id] = line;
          })
        })
        enrichPolys.then(polys => {
          console.log("all polys loaded by",Math.floor(performance.now()))
          topojson.feature(polys, polys.objects.enrichPolys).features.filter(d => { return possibleFeatures.has(d.properties.id) }).forEach(poly => {
            readyAndWaiting[poly.properties.id] = poly;
          })
        })

        return possibleFeatures;

      }

    }

  }

//// INITIATE EXPERIENCE

  function initExp(chosen) {

    experience.initiated = true;

    let bounds = path.bounds(chosen.lineString),
      boundsTransform = getTransform(bounds);  // first iteration used to get scale @ framed full route (k used to confirm not overzooming)

    if (boundsTransform.k <= zoomFollowInit) {
      // preferred
      routeBoundsIdentity = getIdentity(boundsTransform);
    } else {
      // backup, avoids severe transform bug on tiny routes where calculated transform would overzoom default zoomFollowInit
      let centroidTransform = centerTransform(path.centroid(chosen.lineString),zoomFollowInit);
      routeBoundsIdentity = getIdentity(centroidTransform);
    }

    // either way, transform north to make space for dash
    let quarterDash = d3.select("#dash").node().clientHeight/4;
    routeBoundsIdentity.y -= quarterDash;

    // control timing with transition start/end events
    svg.transition().duration(zoomDuration).ease(zoomEase)
      .call(zoom.transform, routeBoundsIdentity)
      .on("start", prepEnvironment)
      .on("end", () => {  // MAJOR SLOWDOWN SOMEWHERE AROUND HERE
        // keep zoomClick btns in line
        d3.select("label#zoom").attr("value",zoomFollowInit)
        // confirm g transform where it should be
        g.attr("transform", routeBoundsIdentity.toString())
        // pause to prepareUser, then initiate animation (incl zoom to firstFrame)
        prepareUser();
        d3.timeout(() => {
          initAnimation(chosen,routeBoundsIdentity);
        }, tPause);
      })

    function prepEnvironment() {

      setupDash(chosen)

      // collapse about pane  // COMBAK: anyway to have svg preserveAspectRatio be "slice" in this moment only?
      collapse("about", collapseDirection(window.innerWidth))
      resize()

      setupEnrichLayer()

      drawRoute(chosen, tPause);

      function setupDash(chosen) {

        // ROUTE SUMMARY
        // agency names & lines
        let agencies = [...new Set(chosen.segments.map(d => {
          if (d.lineName && d.agency.name) {
            let lineName = exRedundant(d.lineName,d.agency.name);
            let fullText = (lineName) ? `'s ${lineName} Line` : '';
            return `<a target="_blank" href="${d.agency.url}">${d.agency.name}${fullText}</a>`
          }
        }))].filter(d => d !== undefined);

        let agencyHtml = `<span class="txt-em">via</span> `
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
        d3.select("#from").append("span")
          .classed("flex-child",true)
          .text(chosen.from.shortName)
        d3.select("#to").insert("span")
          .classed("flex-child",true)
          .text(chosen.to.shortName)
        d3.select("#via").insert("div")
          .html(agencyHtml)
          .style("stroke","dimgray")

        // WIDGETS
        initElevation()
        initOdometer()
        initClock()
        initCompass()

        // chosen.overallBearing

        // NARRATION
        // remove placeholder text from #encounters and change header text (for now)
        d3.selectAll(".placeholder").remove()
        d3.select("#narration-header").select("h5")
          .text("Currently passing:")

        function exRedundant(lineName,agencyName){
          let regex = new RegExp(`${agencyName}\\s*`)
          return lineName.replace(regex,'').replace('Line','')
        }

        function initElevation() {

          getElevation([chosen.from.lng,chosen.from.lat]).then(elevation => {

            d3.select("#elevation").append("span")
              .attr("id","current-feet")
              .classed("flex-child txt-s txt-m-mxl txt-mono",true)
              .text(elevation)

            d3.select("#elevation").append("span")
              .classed("flex-child txt-compact txt-xs txt-s-mxl",true)
              .html(`feet above<br> sea level`)

          });

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

        function initClock() {

          totalTime = Math.round(chosen.totalTime),  // in minutes
         minPerMile = totalTime / totalMiles;

          d3.select("#clock").append("span")
            .attr("id","current-time")
            .classed("flex-child txt-s txt-m-mxl txt-mono",true)
            .text("0")

          d3.select("#clock").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl ml6 mr-neg3",true)
            .html(`of ${totalTime}<br> transit minutes<br> elapsed`)

        }

        function initCompass() {

          let azimuth0 = getAzimuth(0);

          d3.select("#compass").append("span")
            .attr("id","current-bearing")
            .classed("flex-child txt-s txt-m-mxl txt-mono",true)
            .text(azimuth0)

          d3.select("#compass").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl",true)
            .text("degrees")

          d3.select("#compass").append("span")
            .attr("id","current-quadrant")
            .classed("flex-child txt-xs txt-s-mxl mt-neg1",true)
            .text(getQuadrant(azimuth0))

        }

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

        var journey = g.append("g")
          .attr("id", "journey")
        var route = journey.append("g")
          .attr("id", "route")

        // separately add relevant station points (those with stops) using R2R return data
        journey.append("g").attr("id", "station-stops")
          .selectAll("use")
          .data(received.allStops.slice(2))  // first 2 elements are begin/end pts, represented twice
          .enter().append("use")
            .attr("xlink:href", "#station-icon-sm")
            .attr("x", d => { return projection([d.lng,d.lat])[0]; })
            .attr("y", d => { return projection([d.lng,d.lat])[1]; })
            .style("opacity", 0.6)
            .property("name", d => d.shortName)
            .property("orig-opacity", 0.6)  // specified for mouseenter->mouseout reset
            .on("mouseenter", onMouseenter)
            .on("mouseout", onMouseout)

        // remove all rail station points; fade opacity out as station-stops fade in
        g.select("#rail-stations").selectAll("use")
          .transition().duration(t)
            .style("opacity", 0)
            // .on("start", () => { // CULPRIT OF MAJOR SLOW DOWN!! WHY?
            //   g.select("#station-stops").selectAll("use")
            //     .transition().duration(t)
            //       .style("opacity",stnOpacity)
            // })
            .on("end", () => {
              g.select("#rail-stations").selectAll("*").remove()
            })

        let arcPts = received.arcPts;

        // LINE/ROUTE
        // faint underlying solid
        route.append("path")
          .attr("d", line(arcPts))
          .style("fill","none")
          .style("stroke","honeydew")
          .style("opacity",0.6)
          .style("stroke-width",0.4)

        // setup path for stroke-dash interpolation
        var fullRoute = route.append("path")
          .attr("id", "full-route")
          .attr("d", line(arcPts))
          .style("fill", "none")
          .style("stroke", "#682039")  // "#222834" is background
          .style("stroke-width", 0.3)
          .style("opacity",0)
          .style("stroke-dasharray", "0.8 1.6")

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
        //   .style("stroke", "yellowgreen")
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

    // get zoomFollow object including simplified zoomArc (if applicable) and first/last zoom frames
    let zoomFollow = getZoomFollow(routeObj);

    // bind zoomArc to DOM for tracking only (not visible)
    let zoomArc;
    if (zoomFollow.arc.length) {
      zoomArc = g.append("path")
        .attr("id", "zoom-arc")
        .datum(zoomFollow.arc.map(d => projection(d)))
        .attr("d", line)
        .style("fill","none")
        // // toggle below for visual of zoomArc
        // .style("stroke","none")
        // .style("stroke", "rebeccapurple")
        // .style("stroke-width",1)
    }

    // final user prompt/countdown??
    // if (confirm("Ready?")) {
      goTrain(zoomFollow,zoomArc,routeBoundsIdentity); // initiate movement!
    // }

    function getZoomFollow(routeObj) {

      let zoomFollow = {
        necessary: true, // default
        focus: viewFocusInt,
        limit: viewFocusInt * 2,
        arc: [],
        firstThree: [],
        lastThree: [],
        fullFull: routeObj.lineString,
        fullSimp: getSimpRoute(routeObj.lineString),
        fullDist: routeObj.totalDistance,
        get simpDist() { return Math.round(turf.length(this.fullSimp, miles)) },
        get tpsm() /* t per simplified mile */ { return tpm * Math.round(this.fullDist) / this.simpDist }
      }

      if (zoomFollow.simpDist > zoomFollow.limit) {

        let firstLast = getFirstLastThree(zoomFollow.fullSimp,zoomFollow.focus);

        zoomFollow.firstThree = firstLast[0],
         zoomFollow.lastThree = firstLast[1];

        zoomFollow.arc = turf.lineSlice(zoomFollow.firstThree[1],zoomFollow.lastThree[1],zoomFollow.fullSimp).geometry.coordinates;

        // make sure firstLast focus coords align exactly with zoomFollow.arc start/stop (as returned by turf.lineSlice()); prevents stutter at moment of zoomAlong "takeoff"
        zoomFollow.firstThree[1] = zoomFollow.arc[0],
         zoomFollow.lastThree[1] = zoomFollow.arc[zoomFollow.arc.length-1];

      } else {

        // short route, first/last frames identical; no zoomAlong necessary
        zoomFollow.necessary = false;

      }

      return zoomFollow;

      function getFirstLastThree(fullSimp,focusInt = 100) {

        // turf.along() sometimes returns same three coordinates for distance minus int * 2, distance minus int, & distance; also turf.along(fullLine,fullDist) !== last point of fullLine?; reversing instead!

        let fullSimpReversed = turf.lineString(fullSimp.geometry.coordinates.slice().reverse());

        let firstThree = threePts(fullSimp,focusInt),
             lastThree = threePts(fullSimpReversed,focusInt).reverse();

        return [firstThree,lastThree];

        // returns three points along route; origin | trailing corner, zoom focus, leading corner | destination
        function threePts(line,int,i = 0) {

          let pt0 = turf.along(line,int*i,miles).geometry.coordinates,
            pt1 = turf.along(line,int*i+int,miles).geometry.coordinates,
            pt2 = turf.along(line,int*i+2*int,miles).geometry.coordinates;

          // return rounded
          return [pt0,pt1,pt2].map(c => c.map(d => +d.toFixed(5)));

        }

      }

    }

  }

  function goTrain(zoomFollow,zoomArc,routeBoundsIdentity) {

    let t = zoomDuration, // even if no need to zoom to different frame (tiny route), still need this time to turn on headlights/dimBackground/etc
      tFull = tpm * zoomFollow.fullDist,
      tDelay, tMid, firstIdentity, lastIdentity;

    let headlights = g.select("#headlights"),
          semiSimp = g.select("#semi-simp"),
             point = g.select("#train-point"),
          fullPath = g.select("#full-route"),
          azimuth0 = headlights.property("azimuth0");

    if (zoomFollow.necessary) {  // calculate transforms and timing from firstFrame to lastFrame (at initial zoomFollow scale)

      firstIdentity = getIdentity(centerTransform(projection(zoomFollow.firstThree[1]),zoomFollowInit,zoomAlongOptions))

      lastIdentity = getIdentity(centerTransform(projection(zoomFollow.lastThree[1]),zoomFollowInit,zoomAlongOptions))

      tDelay = zoomFollow.tpsm * zoomFollow.focus,  // use tpsm to delay zoomFollow until train hits mm <zoomFollow.focus> (tps(implified)m because focusPt is calculated from simplified route)
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
        // disable wheel-/mouse-related zooming while retaining manual pan ability
        svg.on("wheel.zoom",null)
        svg.on("scroll.zoom",null)
      })
      .on("end", () => {
        // keep zoom buttons up to date
        d3.select("label#zoom").attr("value",firstIdentity.k)
        // confirm g exactly in alignment for next transition
        g.attr("transform",firstIdentity.toString())
        // call initial point transition, passing simplified path
        goOnNow(zoomArc,lastIdentity)
      })

    function dimBackground(t) {

      let dimMore = [d3.select("#continent-mesh"),d3.select("#railways"),d3.select("#rivers"),d3.select("#lake-mesh"),d3.select("#urban-areas"),d3.select("#country-borders")]

      let dimLess = [d3.select("#state-borders")];

      dimMore.forEach(selection => {
        let currentOpacity = selection.style("opacity")
        selection.transition().duration(t)
          .style("opacity", currentOpacity * relativeDim / 2)
        });

      dimLess.forEach(selection => {
        let currentOpacity = selection.style("opacity")
        selection.transition().duration(t)
          .style("opacity", currentOpacity * relativeDim * 2)
        });

    }

    function goOnNow(simpPath,lastIdentity) {
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
              .attrTween("transform", zoomAlong(simpPath))
          }
        })
        .on("end", () => {
          // dispatch custom "arrive" event
          dispatch.call("arrive", this)
          // inform d3 zoom behavior of final transform value (transition in case user adjusted zoom en route)
          svg.transition().duration(zoomDuration).ease(zoomEase)
            .call(zoom.transform, lastIdentity)
            .on("end", () => {
              // confirm g transform in alignment
              g.attr("transform",lastIdentity.toString())
              // reenable integrated free zooming and panning
              svg.call(zoom)
            })
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
          // adjust dash (& associated) padding so long as #about collapsed on mxl
          d3.select("#attribution").classed("mr24-mxl", true)
          d3.select("#dash-content").classed("px30-mxl",true)
          d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",true)
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
          d3.select("#dash-content").classed("px30-mxl",false)
          d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",false)
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
    return (width > 1199) ? "right" : "down";
  }

//// GEOJSON + TOPOJSON HELPERS

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

  function getRotate(p0,p1,isInitial = false) {
    // TODO refactor/cleanup
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
    let options = {tolerance: tolerance, highQuality: false, mutate: false},
     simplified = turf.simplify(full, options);
    // make sure simp routes have detail of at least 5 coordinates, otherwise leads to zoomFollow issues eg ABQ->VAN,BC
    while (simplified.geometry.coordinates.length < 5) {
      options.tolerance -= 0.1;
      simplified = turf.simplify(full, options);
    }
    return simplified;
  }

//// ZOOM BEHAVIOR

  function zoomed() {

    var transform = d3.zoomTransform(this);

    let k = transform.k,
       tx = transform.x,
       ty = transform.y;

    g.style("stroke-width", 1 / (k*k) + "px");

    g.attr("transform", "translate(" + tx + "," + ty + ") scale(" + k + ")");

    // keep zoom buttons up to date
    d3.select("label#zoom").attr("value",k)

    if (d3.event.sourceEvent && experience.animating) {
      // panning only
      panned.flag = true,
      panned.transform = transform;
      ++panned.i;
    }

  }

  function zoomClick() {

    // this.parentNode holds stable zoom value shared by both zoomIn and zoomOut buttons
    let direction = (this.id === "zoomIn") ? 1 : -1;

    let oValue = +d3.select(this.parentNode).attr("value"),
      newValue = oValue + step * direction;

    if (newValue <= d3.select(this).attr("max") && newValue >= d3.select(this).attr("min")) {

      d3.select(this.parentNode).attr("value", newValue);

      // get current transform
      let currentTransform = getCurrentTransform(g);
      // get current center pt by working backwards through centerTransform() from current transform
      let centerPt = getCenterFromTransform(currentTransform);
      // get identity of centered transform at new zoom level
      let zoom1 = getIdentity(centerTransform(centerPt,newValue));
console.log(zoom1)
      svg.transition().duration(400).ease(zoomEase)
         .call(zoom.transform, zoom1)
         .on("end", () => {
           g.attr("transform", zoom1.toString())
         })

    } else {

      // offer visual affordance (little shake) that zoom limit reached
      d3.select(this).classed("limit-reached",true)
      d3.timeout(() => {
        d3.select(this).classed("limit-reached",false);
      }, 300);

    }

  }

  function getCurrentTransform(selection) {
    let transform = selection.node().transform.animVal;
    return {
      x: transform[0].matrix.e,
      y: transform[0].matrix.f,
      k: transform[1].matrix.a
    };
  }

  function getCenterFromTransform(transform) {
    // get current center by working backwards through centerTransform() from current transform
    let pt0 = (transform.x - translate0[0]) / -transform.k,
        pt1 = (transform.y - translate0[1]) / -transform.k;
    return [pt0,pt1];
  }

  function getTransform(bounds, options) {

    options = {...defaultOptions, ...options};

    let b0,b1;

    // accept bbox, path.bounds(), or SVG bbox
    if (bounds.length === 4) {
      b0 = [bounds[0],bounds[1]],
      b1 = [bounds[2],bounds[3]]
    } else {
      b0 = bounds[0] || [bounds.x,bounds.y],
      b1 = bounds[1] || [bounds.width,bounds.height]
    }

    // account for any padding
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

  // returns d3.zoomIdentity while providing option for stable k
  function getIdentity(atTransform,k) {
    let identity = d3.zoomIdentity
      .translate(atTransform.x || atTransform[0], atTransform.y || atTransform[1])
      .scale(k || atTransform.k)
    return identity;
  }

  // returns transform centering point at predetermined scale
  function centerTransform(pt,scale,options) {

    options = {...defaultOptions, ...options}  // overkill, but simplest

    pt[0] = pt[0] + options.padRight - options.padLeft
    pt[1] = pt[1] + options.padBottom - options.padTop

    let tx = -scale * pt[0] + translate0[0], // initial.width/2,
        ty = -scale * pt[1] + translate0[1]  // initial.height/2;

    return {x: tx, y: ty, k: scale};

  }

  function resetZoom() {

    active.classed("active", false);
    active = d3.select(null);

    svg.transition().duration(zoomDuration/4) // .ease(d3.easeLinear)
      .call(zoom.transform, zoom0)

  }

  function nozoom() {
    d3.event.preventDefault();
  }

//// DRAG BEHAVIOR

  function childDrag() {

    // Determine resizer position relative to resizable parent
    let y = this.parentNode.getBoundingClientRect().height - d3.event.y

    // Ensure calculated height within bounds of grandparent SVG (plus padding) and, optionally, greater than minimum height
    y = Math.min(svg.node().clientHeight - 96 ,Math.max(72, y));

    // apply new sizing to relative parent (#resizable) of absolute content (.resizer)
    d3.select(this.parentNode).style('height', y + 'px');

  }

  function siblingDrag() {  // as is, adjusts height only

    let prevHeight = this.previousElementSibling.getBoundingClientRect().height,
        nextHeight = this.nextElementSibling.getBoundingClientRect().height;

    let prevMin = 0, prevMax = Infinity, nextMin = 0, nextMax = Infinity;

    // get new prevSibling height, within bounds
    let prevY = prevHeight + d3.event.dy;
    prevY = Math.min(prevMax,Math.max(prevMin, prevY));

    // get new nextSibling height, within bounds
    let nextY = nextHeight - d3.event.dy;
    nextY = Math.min(nextMax,Math.max(nextMin, nextY));

    // style prev sibling
    d3.select(this.previousElementSibling).style('height', prevY + 'px');

    // style next sibling
    d3.select(this.nextElementSibling).style('height', nextY + 'px');

  }

//// QUADTREE / DATA / INTERSECT QUERIES

  function makeQuadtree(data,options) {
    // search and nodes functions taken from https://bl.ocks.org/mbostock/4343214

    options = {...quadtreeDefaultOpts,...options};

    // get projected bounding box of passed geoJSON
    let pathBox = path.bounds(options.bounding),
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
        // .on("mouseenter", onMouseenter)
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

          // // for visualization purposes only
          // g.selectAll(".quadtree-data").selectAll(`.quad-datum.${d.properties.id}`).classed("quad-datum--scanned",true)

          d.selected = (d0 >= x0) && (d0 < x3) && (d1 >= y0) && (d1 < y3);

          if (d.selected) {

            // // for visualization purposes only
            // g.selectAll(".quadtree-data").selectAll(`.quad-datum.${d.properties.id}`).classed("quad-datum--selected",true)

            // for flagged, en route trigger-pts only
            if ((g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).node()) && (g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).classed("trigger-pt"))) {

              if (!uniqueEncounters.has(d.properties.id)) {
                uniqueEncounters.add(d.properties.id)
                dispatch.call("encounter", d)
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

    let headlights = g.select("#headlights"),
      currentRotate = headlights.node().transform.animVal[1].angle,
      currentLocation = currentTrainLocation(this),
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

  function currentTrainLocation(selection) {
    let trainTransform = selection.node().transform.animVal[0].matrix;
    return [trainTransform.e, trainTransform.f];
  }

  function departed() {
    let departed = performance.now();
    d3.timerFlush()
    experience.animating = true;
    // output elsewhere?
    console.log("train departing @ " + departed)
  }

  function arrived() {
    let arrived = performance.now();
    timer.stop()
    experience.animating = false;
    // avoid slight tracker disconnects at end
    d3.select("#current-miles").text(totalMiles)
    d3.select("#current-time").text(totalTime)
    // output elsewhere?
    console.log("train arrived @ " + arrived)
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
  function zoomAlong(path) {
    let centerAdjust, i = 0;
    var l = path.node().getTotalLength();
    return function(d, i, a) {
      return function(t) {
        // KEEP NODE P IN CENTER OF FRAME @ CURRENT ZOOM LEVEL K
        var p = path.node().getPointAtLength(t * l),
            k = d3.select("label#zoom").attr("value");
        // if user has manually zoomed (without wheel) or panned svg since animation start, offset zoomAlong center by translate values
        if (panned.flag) {
          // calculate new centerAdjust if new or in-progress pan event; otherwise, use most recently calculated centerAdjust value
          if (panned.i > i) {
            let currentCenter = getCenterFromTransform(panned.transform);
            centerAdjust = [currentCenter[0] - p.x, currentCenter[1] - p.y];
            ++i;
          }
          p.x += centerAdjust[0],
          p.y += centerAdjust[1];
        }
        // calculate translate necessary to center data within extent
        let centered = centerTransform([p.x,p.y],k,zoomAlongOptions)
        svg.call(zoom.transform, getIdentity(centered))
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
        gj = readyAndWaiting[id], // get associated feature
      baseT;

    if (!gj) console.log(this) // py508, py12, py51, py315

    // get and save logGroup/category and protected area tags
    let logGroup = getGroup(gj),
          subTag = getTag(gj,logGroup);
    gj.properties.logGroup = logGroup,
      gj.properties.subTag = subTag;

    if (id.startsWith('pt')) {

      baseT = gj.properties.SNAP_DISTANCE;
      revealPt(gj,baseT)

    } else {

      let triggerPt = this.geometry.coordinates,
        allCoords = turf.coordAll(gj.geometry),
        i0 = turf.nearestPointOnLine(turf.lineString(allCoords),triggerPt),
        index0 = i0.properties.index,
        gjA,
        gjB;

      if (["River","River (Intermittent)"].includes(gj.properties.CATEGORY)) {

        // store first and last points of flattened line geometry
        let index1A = 0,
            index1B = allCoords.length-1;
        let i1A = turf.point(allCoords[index1A]),
            i1B = turf.point(allCoords[index1B]);

        if (turf.distance(i0,i1A,miles) < 100) {

          // call it good, don't break enrichLine down into smaller features
          baseT = turf.length(gj.geometry,miles)
          revealLine(gj,baseT)

        } else if (turf.distance(i0,i1B,miles) < 100) {

          // triggerPt is very close to the end of the line as written; reverse coords so that it animates outward(-ish) from route
          let reversed;

          if (gj.geometry.type === "MultiLineString") {

            reversed = turf.multiLineString(reverseNested(gj.geometry.coordinates), gj.properties)

          } else {

            reversed = turf.lineString(gj.geometry.coordinates.reverse(), gj.properties)

          }

          baseT = turf.length(reversed,miles)
          revealLine(reversed,baseT)

        } else {

          if (gj.geometry.type === "MultiLineString") {
            let split = splitMultiString(triggerPt,gj);
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

          let centroid = turf.centroid(gj.geometry)

          // let spine = turf.lineString([i0,i1])
          let spine = turf.lineString([i0,centroid,i1].map(d=>d.geometry.coordinates)),
               area = turf.convertArea(turf.area(gj.geometry),"meters","miles");

          baseT = Math.round(Math.sqrt(Math.sqrt(area)))
          revealPolygon(gj,spine,baseT)

        } else {

          // shift line geometry to start (and end) at i0
          if (gj.geometry.type === "MultiLineString") {

            let split = splitMultiString(triggerPt,gj);

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
           lengthA = turf.length(gjA, miles),
           lengthB = turf.length(gjB, miles),
             baseT = [lengthA,lengthB];

        gjA.properties = {...gj.properties}
        gjB.properties = {...gj.properties,...{oid: origId, id: origId + "-2"}}

        if (gjA.geometry.coordinates.length) revealLine(gjA,baseT[0]);
        if (gjB.geometry.coordinates.length) revealLine(gjB,baseT[1]);

      }

    }

    function getGroup(gj) {

      // SWING ONE
      let catMatch;
      if (gj.properties.CATEGORY) {
        if (gj.properties.CATEGORY === "Ecoregion") {
          return {
            divId: `eco-${gj.properties.ECOZONE}`,
            fullTxt: `Ecozone: ${getEcozone(gj.properties.ECOZONE)}`,
            color: colorAssignments.ecoregions[gj.properties.ECOZONE].base
          };
        } // else
        catMatch = gj.properties.CATEGORY.toUpperCase(),
        catIndex = catKeys.findIndex(startsWith,catMatch);
        if (catIndex >= 0) {
          return enrichCats[catKeys[catIndex]];
        }
      }

      // SWING TWO
      let descrMatch = '';
      if (gj.properties.DESCRIPTION) {
        descrMatch = gj.properties.DESCRIPTION.toUpperCase(),
        descrIndex = catKeys.findIndex(startsWith,descrMatch);
        if (descrIndex >= 0) {
          return enrichCats[catKeys[descrIndex]];
        }
      }

      // FINAL SWING
      if (catMatch === "PROTECTED AREA") {  // it must be; get tier
        if (enrichCats["PA1"].keywords1.some(match,descrMatch) && enrichCats["PA1"].keywords2.some(match,descrMatch)) {
          return enrichCats["PA1"];
        } else if (enrichCats["PA2"].keywords.some(match,descrMatch)) {
          return enrichCats["PA2"];
        } else {
          return enrichCats["PA3"];
        }
      } else {
        console.log("WHAA??")
        console.log(catMatch,descrMatch,catKeys)
        console.log(gj.properties)
      }

      function match(text) {
        return this.match(text) // || text.match(this);
      }
      function startsWith(text) {
        return text.startsWith(this) || this.startsWith(text);
      }

    }

    function getTag(gj,logGroup) {

      if (gj.properties.CATEGORY === "Ecoregion" &&  (unromanize(gj.properties.LEVEL) > 1)) {

        return { divId: `eco-${gj.properties.ECOZONE}-${gj.properties.LEVEL}`,
          fullTxt: `Level ${gj.properties.LEVEL} Ecoregions`,
          color: getBaseColor(gj.properties.ECOZONE,gj.properties.LEVEL)
        };

      } else if (logGroup.fullTxt === "Watersheds") {

        return { divId: `drain-${gj.properties.OCEAN_ID}`,
          fullTxt: `Draining to the ${getDrain(gj.properties.OCEAN_ID)}`,
          color: colorAssignments.watersheds[gj.properties.OCEAN_ID].base
        };

      } else if (logGroup.fullTxt && logGroup.fullTxt.startsWith("Protected Area")) {

        if (gj.properties.flag === "habitat") return paTags["hab"];

        // else
        let paDescr = gj.properties.DESCRIPTION.toUpperCase(),
           tagIndex = tagWords.findIndex(someMatch,paDescr);

        if (tagIndex < 0) {
          // try with name
          let name = gj.properties.NAME.toUpperCase();
          tagIndex = tagWords.findIndex(someMatch,name);
          if (tagIndex < 0) /*STILL*/ console.log(gj.properties)
        }

        return paTags[paKeys[tagIndex]];

        function someMatch(arr) {
          return arr.some(match,this);
          function match(text) {
            return this.match(text);
          }
        }

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
          .property("name", formatName)
          .property("category", d => d.properties.CATEGORY)
          .property("description", d => d.properties.DESCRIPTION)
          .property("more-info", d => d.properties.MORE_INFO)
          .property("baseT", d => d.properties.SNAP_DISTANCE)
          .property("log-group", d => d.properties.logGroup)
          .property("sub-tag", d => d.properties.subTag)
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
              update.on("mouseenter", onMouseenter)
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
                    .attr("d", path)
                    .attr("id", d => d.properties.id)
                    .property("name", formatName)
                    .property("category", d => d.properties.CATEGORY)
                    .property("level", d => d.properties.LEVEL)
                    .property("log-group", d => d.properties.logGroup)
                    .property("sub-tag", d => d.properties.subTag)
                    .property("orig-opacity", lineOpacity)
                    .property("orig-stroke-opacity", lineOpacity)
                    .style("fill", getFill)
                    .style("stroke", getStroke)
                    .style("stroke-width", getStrokeWidth)
                    .style("stroke-dasharray", "none")
                    .style("stroke-linecap", "round")
                    .style("opacity", lineOpacity)
                    .on("mouseenter", onMouseenter)
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
          .attr("d", path)
          .attr("id", d => d.properties.id)
          .property("name", formatName)
          .property("category", d => d.properties.CATEGORY)
          .property("level", d => d.properties.LEVEL)
          .property("more-info", d => d.properties.MORE_INFO)
          .property("description", d => d.properties.DESCRIPTION)
          .property("log-group", d => d.properties.logGroup)
          .property("sub-tag", d => d.properties.subTag)
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
          .on("mouseenter", onMouseenter)
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

  function formatName(d) {

    if (!d.properties.NAME) return;

    // else
    let pre = (["River","Ecoregion","Watershed","Grassland"].includes(d.properties.CATEGORY) && (d.properties.flag !== "noThe")) ? `The ` : ``;

    return pre + d.properties.NAME;

  }

//// OUTPUT AND ALERT incl DASHBOARD

  function output(encountered) {

    let darkText = "#333",
       lightText = "#ddd";

    if (encountered.property("name")) {

      // get encountered group A, B, or C
      let col = assocCols[encountered.property("id").slice(0,2)];

      allEncounters[col].unshift(encountered) // array of selections

      updateOutput(allEncounters[col].slice(),col)

      // flashLabel(encountered) // pausing on this for now

      log(encountered)

      function updateOutput(encounters,col) { // allEncounters) {
        // https://observablehq.com/@d3/selection-join

        const t = d3.transition().duration(750);

        // HOW TO SMOOTH OUT SCROLL?
        d3.select(`#encounters-${col}`).selectAll(".encounter")
          .data(encounters, d => d.property("id"))
          .join(
            enter => enter.append("div")
              .classed("flex-child encounter txt-compact mx3 my3 px3 py3", true)
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

      }

      function flashLabel(encountered) {

        // set the initial position of label to the feature's centroid
        let center = path.centroid(encountered.datum()),
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

      function log(encountered) {

        let group = encountered.property("log-group"),
              tag = encountered.property("sub-tag");

        logGroups.has(group.divId) ? addToCount(group.divId) : addNewGroup(encountered,group);

        if (tag) {
          tagTypes.has(tag.divId) ? addToCount(tag.divId) : addNewGroup(encountered,tag,false,tagTypes,group.divId,6);
        }

        function addToCount(id) {

          // access current
          let logCount = d3.select("#legend-log-content").select(`#${id}`).select("span.log-count"),
               current = logCount.text()

          // add one & update
          logCount.text(+current+1)

        }

        function addNewGroup(encountered,group,isParent = true,parentSet = logGroups,parentDivId = "legend-log-content",padLeft = 0) {

          parentSet.add(group.divId);

          let symbol = styleToSymbol(encountered,group);

          symbolSet.add(symbol.id)

          let newItem = d3.select(`#${parentDivId}`).append("div")
            .classed("flex-child flex-child--grow flex-child--no-shrink hmin18 hmin24-mm legend-log-item relative",true)
            .html(getLogHtml(group,symbol.id,isParent))
            .style("opacity", 0)  // initially

          // when child element, ensure caret-toggle of parent group is visible
          if (!isParent) d3.select(`#${parentDivId}`).classed("hide-triangle",false).classed("show-triangle",true)

          // transition whole line into full opacity
          newItem.transition().duration(300)
            .style("opacity", 1)

          // ** FIXME! **
          // add fill to new HTML element within newItem // COMBAK NOT WORKING
          let patch = d3.select("#legend-log-content").select(`#${group.divId}`).select("span.log-symbol");
          // AKA newItem.select(`#${symbol.id}`)

          // // works for simple colors
          // patch.style("background",symbol.fill)
          // // works always
          // patch.classed("bg-red",true)
          // // NEVER works
          // patch.style("fill",symbol.fill)
          // // doesn't help anything
          // let formattedFill = (symbol.fill.startsWith("rgb")) ? chroma(symbol.fill).hex() : symbol.fill.replace(/"/g,'').replace(/`/g,'').replace(/'/g,'').replace(/' '/g,'')

          newItem.select(`#${symbol.id}`)
            // .style("fill", symbol.fill) // formattedFill)
            .style("background", symbol.fill) // formattedFill)
            .style("background-image", symbol.fill) // formattedFill)
            // .style("stroke",symbol.stroke)
            // .style("stroke-width",symbol.strokeWidth)
            // .style("stroke-dasharray",symbol.strokeDashArray)
            // .style("stroke-opacity",1)
            // .style("opacity",1)

          function getLogHtml(group,fillId,isParent) {

            let initCount = 1,
              s = (padLeft > 0) ? 18 : 24;

            let html,
              innerHtml = `<span id="${fillId}" class="flex-child flex-child--no-shrink h${s} w${s} log-symbol"></span>
              <label class="flex-child flex-child--grow log-name px3">${group.fullTxt}</label>
              <span class="flex-child flex-child--no-shrink log-count">${initCount}</span>`

            // COMBAK same ID used on two elements
            if (isParent) {
              html = `<details id="${group.divId}" class="flex-parent flex-parent--column hide-triangle">
                <summary id="${group.divId}" class="flex-parent flex-parent--space-between-main flex-parent--center-cross border-t border-b border--dash hmin24">
                  ${innerHtml}
                </summary>
              </details>`
            } else {
              html = `<div id="${group.divId}" class="flex-parent flex-parent--space-between-main flex-parent--center-cross legend-log-child-item border-l py3">
                ${innerHtml}
              </div>`
            }

            return html;

          }

          function styleToSymbol(encountered,group) {

            // element will already be styled appropriately at this point; turn style to symbol
            let divId = (encountered.property("sub-tag")) ? encountered.property("sub-tag").divId : encountered.property("log-group").divId;

            let tFill, s = 24;
            if (encountered.property("category") === "Watershed") {

              let arr = encountered.style("stroke-dasharray").split(', ').slice(0,4).map(d => d*10);

              s = arr.slice().reduce((a,b) => a+b);

              tFill = textures.paths()
                .d(s => `
                    M 0, ${s}
                    l ${(arr[0] / s)},${(-arr[0] / s)}
                    M ${(arr[0] + 1) / s},${(-arr[0] - 1) / s}
                    l ${(arr[1] / s)},${(-arr[1] / s)}
                    M ${(arr[1] + 1) / s},${(-arr[1] - 1) / s}
                    l ${(arr[2] / s)},${(-arr[2] / s)}
                    M ${(arr[2] + 1) / s},${(-arr[2] - 1) / s}
                    l ${(arr[3] / s)},${(-arr[3] / s)}
                    M ${(arr[3] + 1) / s},${(-arr[3] - 1) / s}
                    l ${s}, 0
                  `)
                .size(s)
                .stroke(encountered.style("stroke"))
                // .strokeWidth(1) // encountered.style("stroke-width"))
                .shapeRendering("crispEdges")

              svg.call(tFill);

            } else if (encountered.property("category").startsWith("River")) {

              tFill = textures.paths()
                .d(s => `M 0, ${s} l ${s},0`)
                .size(s)
                .stroke(encountered.style("stroke"))
                .strokeWidth(encountered.style("stroke-width"))
                .shapeRendering("crispEdges")

              svg.call(tFill);

            }

            let symbol = {
              id: divId + "-sym",
              fill: (tFill) ? tFill.url() : encountered.style("fill"),
              stroke: encountered.style("stroke"),
              strokeWidth: encountered.style("stroke-width")
              // strokeOpacity: encountered.style("orig-stroke-opacity"),
              // opacity: encountered.style("orig-opacity")
            }

            return symbol;

          }

        }

      }

    }

  }

  function trackerUpdate(i) {

    let coordsNow = geoMM[i],
            miles = i + 1,
             // pace = getPace();
             time = Math.round(miles * minPerMile);

    if (coordsNow) {  // avoids error at end

      getElevation(coordsNow).then(elevation => {
        d3.select("#current-feet").text(elevation)
      });

      let azimuth = getAzimuth(i);
      d3.select("#current-bearing").text(azimuth)
      d3.select("#current-quadrant").text(getQuadrant(azimuth))

    }

    d3.select("#current-miles").text(miles)
    d3.select("#current-time").text(time)

  }

  function getMM(t) {
    // if tpm variable, current mm is would be pace calculation - previous total (already elapsed, cannot undo)
    let atPace = Math.floor(t/tpm);
    mm = (accumReset) ? atPace - accumReset : atPace;
    return mm;
  }

  // function adjustTPM() {
  //   // account for trackerUpdate which calculates milemarker using elapsed time
  //   accumReset += mm;  // cumulative total of elapsed at all TPMs thus far
  // }

  function getPace() {
    return tpm;
  }

  function getElevation([lng,lat]) {

    let query = `https://elevation-api.io/api/elevation?key=QYpeoaa1-v5DsYaHKdPsI-d2e2UD9l&points=(${lat},${lng})`

    let elevation = d3.json(query).then(response => {
      return metersToFeet(response.elevations[0].elevation);
    }, onError);

    return elevation;

    function metersToFeet(m) {
      return Math.round(m * 3.281);
    }

  }

  function getAzimuth(i) {  // returns rounded/approximate value

    let prevPt = geoMM[i-1] || geoMM[i],
        nextPt = geoMM[i+1] || geoMM[i];

    return Math.round(turf.bearingToAzimuth(turf.bearing(prevPt,nextPt)));

  }

  function getQuadrant(bearing) {
    var quadrants = {
      // quadrant: range (array cannot be key?)
      "NE": [0,90],
      "SE": [90,180],
      "SW": [180,270],
      "NW": [270,360]
    }
    let sought = Object.values(quadrants).find(d => {
      return (bearing < Math.max(...d) && bearing >= Math.min(...d));
    });
    return Object.keys(quadrants).find(key => quadrants[key] === sought);
  }

//// HTML/CSS VISIBILITY MANAGEMENT

  function expand(elementStr,direction = ["up"]) {

    if (d3.event && d3.event.defaultPrevented) return; // dragged

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
        if (window.innerWidth > 1199) {
          d3.select("#section-wrapper").classed("relative", true);
          d3.select("#attribution").classed("mr24-mxl", false)
          d3.select("#dash-content").classed("px30-mxl",false)
          d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",false)
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

    if (d3.event && d3.event.defaultPrevented) return; // dragged

    d3.select(`#${elementStr}`).classed(`disappear-${direction}`, true);
    d3.select(`#${elementStr}-expand`).classed("none", false);
    d3.select(`#${elementStr}-collapse`).classed("none", true);

    // size- and element-specific toggles upon expand/collapse of various elements
    if (elementStr === "about") {
      if (window.innerWidth > 1199) {
        d3.select("#section-wrapper").classed("relative", false)
        d3.select("#attribution").classed("mr24-mxl", true)
        d3.select("#dash-content").classed("px30-mxl",true)
        d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",true)
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
    d3.select("#journey").selectAll("*").remove()
    // open selection form
    toggleModal('get-options')

  }

//// STYLES

  function getFill(d) {
    let props = d.properties, // shorthand
     geomType = props.id.slice(0,2);
    if (props.logGroup[props.subTag] && props.logGroup[props.subTag][geomType]) {
      return props.logGroup[props.subTag][geomType].texture.url();
    } else if (props.logGroup[geomType]) {
      return props.logGroup[geomType].texture.url();
    } else if (props.logGroup.textureType) {
      let textured;
      if (props.subTag && props.subTag.color) {
        if (geomType === "pt") {
          let textureOpts = {...props.logGroup.textureProps, ...{background: props.subTag.color, stroke: "whitesmoke"}};
          textured = getTexture(props.logGroup.textureType,textureOpts)
        } else {
          let textureOpts = {...props.logGroup.textureProps, ...{fill: "transparent", stroke: props.subTag.color}};
          textured = getTexture(props.logGroup.textureType,textureOpts)
        }
        props.logGroup[props.subTag] = { [geomType]: { texture: textured } }
      } else {
        textured = getTexture(props.logGroup.textureType,props.logGroup.textureProps);
        props.logGroup[geomType] = { texture: textured }
      }
      // svg.call(texture);
      return textured.url();
    } else if (props.CATEGORY === "Ecoregion") {
      if (props.LEVEL === "I") {
        return colorAssignments.ecoregions[props.ECOZONE].base;
      } else {
        return getSimilarColor(chroma(colorAssignments.ecoregions[props.ECOZONE][props.LEVEL].base).rgb(),unromanize(props.LEVEL))
      }
      // RADIAL GRADIENT, PIXEL->PIXEL FLOODING ETC COMING SOON
    } else if (props.id.startsWith("ln")) {  // only lake lines filled
      return "none";
    } else if (props.subTag && props.subTag.color) {
      return props.subTag.color;
    } else {
      console.log("???:",d.properties.NAME,"/",d.properties.DESCRIPTION,"/",props.logGroup,"/",props.subTag)
      return paletteScale(random());
    }
  }

  function getStroke(d) {
    let props = d.properties; // shorthand
    if (props.logGroup.divId === "pa-grp1") {
      return props.logGroup.getStroke(d);
    } else if (props.CATEGORY === "Watershed") {
      return colorAssignments.watersheds[props.OCEAN_ID].base;
    } else if (props.CATEGORY === "Ecoregion") {
      return chroma(colorAssignments.ecoregions[props.ECOZONE].base).brighten(2)
    } else if (props.CATEGORY.startsWith("River")) {
      return riverBlue;
    } else if (props.CATEGORY.startsWith("Lake")) {
      return lakeBlue;
    } else if (props.subTag && props.subTag.color) {
      return props.subTag.color;
    } else if (props.CATEGORY.startsWith("Grass")) {
      return yellowGold;
    } else {
      console.log("???:",d.properties.NAME,d.properties.DESCRIPTION)
      return paletteScale(random());
    }
  }

  function getStrokeWidth(d) {
    if (d.properties.STROKEWIDTH) {
      return d.properties.STROKEWIDTH + "px";
    } else if (d.properties.LEVEL) {
      return 0.25/(unromanize(d.properties.LEVEL)) + "px";
    } else {
      return 0.1 + "px";
    }
  }

  function getTexture(type,props) {
    let textured = textures[type]()
    Object.keys(props).forEach(d => {
      textured[d](props[d])
    })
    svg.call(textured);
    return textured;
  }

  function getBaseColor(ecozone,level) {

    if (!colorAssignments.ecoregions[ecozone][level]) {

      // derive getSimilarColor as base for this ecozone+level combination
      colorAssignments.ecoregions[ecozone][level] = {
        base: getSimilarColor(chroma(colorAssignments.ecoregions[ecozone].base).rgb(),unromanize(level))
      }

    }

    return colorAssignments.ecoregions[ecozone][level].base;

  }

  function getSimilarColor([r,g,b],level) {

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

    return chroma(options[level]).hex();

    function adjusted(c) {

      // lower levels vary more drastically, though all should be distinct
      let factor = 1/level,
        i = random(factor * 90, factor * 60)  // upper,lower

      // ensure return value is between 0 and 255
      return Math.max(0,Math.min(255,(c + (Math.random() < 0.5 ? -i : i))))

    }

  }

//// TOOLTIPS

  function onMouseenter(d) {

    // visual affordance for element itself
    d3.select(this) // .classed("hover", true) //.raise();
      .transition().duration(100)
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
      tooltip.transition().duration(100)
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
      <span class="name-ii txt-compact txt-em txt-xs txt-s-mxl ">Level ${d.property("level")} Ecoregion</span >
      `
    }

    if (d.property("more-info")) {
      mainOut += `
      <br />
      <span class="more-info txt-compact txt-xs txt-s-mxl">${d.property("more-info")}</span>
      `
    }

    return pre + mainOut + post;

  }

  function getName(d) {

    let name = `${d.property("name")}`
    if (d.property("category") === "Lake") {
      // do nothing; name already includes type "Lake"
    } else if (d.property("id").startsWith("ln")) {
      name += ` ${d.property("category")}`
    } else if (d.property("description")) {
      name += ` ${d.property("description")}`
    }

    return name;

  }

  function onMouseout(d) {

    // reset visual affordances; note opposite defaults
    let resetStrokeOpacity = d3.select(this).property("orig-stroke-opacity") || 0,
      resetOpacity = d3.select(this).property("orig-opacity") || 1;

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
  function clearDOM() {

    // d3.select("g.parent").selectAll("*").remove();
    // d3.select("div.parent").html("");

  }

  function endAll(transition,callback) {
    var n = 0;
    transition.each(function() { ++n; })
              .each("end", function() { if (!--n) callback.apply(this, arguments); });
  }

  // PARSE, CONVERT, ASSOCIATE
  function replaceCommas(string) {
    let commaFree = string.replace(/\s*,\s*|\s+,/g, '%2C');
    return commaFree;
  }

  function kmToMi(km) {
    return turf.convertLength(km,"kilometers","miles");
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

  function getDrain(oceanId) {
    let drainsTo = {
      10: "Arctic Ocean",
      20: "Atlantic Ocean",
      30: "Gulf of Mexico",
      40: "Hudson Bay",
      50: "Pacific Ocean"
    };
    return drainsTo[oceanId];
  }

  function getEcozone(zoneId) {
    let ecozones = {
       1: "The Arctic Cordillera",
       2: "The Tundra",
       3: "The Taiga",
       4: "The Hudson Plain",
       5: "The Northern Forests",
       6: "The Northwestern Forested Mountains",
       7: "The Marine West Coast Forest",
       8: "The Eastern Temperate Forests",
       9: "The Great Plains",
      10: "The North American Deserts",
      11: "Mediterranean California",
      12: "The Southern Semi-Arid Highlands",
      13: "The Temperate Sierras",
      14: "The Tropical Dry Forests",
      15: "The Tropical Wet Forests"
    };
    return ecozones[zoneId];
  }

  // BROADLY APPLICABLE OR NOT AT ALL
  function shuffle(array) {
    // https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
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

  // AMENDED D3 FUNCTION if I use forceCollide to position labels
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

// DONE:
// speedometer -> clock
// about text edits
// add quadrant to bearing tracker
// organize/edit notes

//// INCOMPLETE TASKS AND NOTES ////

// LITTLE THINGS
  // make timing of split lines the same again; no fun / disorienting for one to wait for the other
  // line-dash ease slower at end
  // new color for modal
  // change projection to equidistant (instead of equal area)
  // some other summarizing info to right of agency/line summary; then reduce text within widgets (eg '102 of 3207 miles elapsed' => '102 miles elapsed')

// LITTLE BUT STUMPING ME RIGHT NOW
  // turn #dash, #about, and #modal expand/collapse into transitions (ESP switch between dash/about at begin) (*)

// MEDIUM
  // automatically order legend log categories
  // ecozones, protected areas their own group? or combine all PAs
  // more interesting icons for point data?
    // NPS svg
    //  maki: all -11, -15: volcano, mountain, park, park-alt1, information, marker, marker-stroked, circle, circle-stroked, bridge, heart
    // assembly #icon-mountain icon -- mount, mountain, mt, mtn

// MAJOR!! *** = NEED HELP!
  // *** performance improvement! (see ideas below) ***

// WISHLIST/FUN (*) == highlights
  // polygon radial animation / so fancy (see styling notes below; must first make a determination re: transitioning to canvas) (*)
  // add autocomplete/suggestions to R2R search
  // add underlying shaded relief terrain layer (*)
    // http://www.shadedrelief.com/birds_eye/gallery.html?
  // more data-driven styling (what though?)
  // visualizing all number data within dash:
    // elevation grid/tracker
    // compass needle
    // better clock/odometer visual approximations
  // ability to control pace of train (WOULD HAVE TO BE ADJUSTED BEFORE ANIMATION BEGINS SINCE TIMING OF TRANSITIONS PREDETERMINED)
  // orig options matches sorted by distance
  // add more enrich data (mostly pts): tunnels, bridges, iNaturalist, glaciers, species-specific polygons (habitat/range, https://www.worldwildlife.org/publications/wildfinder-database)
  // animate rivers in direction of flow: http://www.hydrosheds.org/download

// GIVING UP ON:
  // use x/y to transition-collapse down from tooltip/element itself into dash/log
  // journey log separates from dash and grows with content on wider screens, overtaking #about (if #about toggled)
  // ability to replay, ff?, rewind??? (dash/animate back)
    // would need so much help with state management stuff: animation frame, rendered reveal -- and questions about local/session storage (R2R returns, processed/filtered enrichData) ***
  // ability to takeSnapshot()=> save inner screenshot in log
  // ability to "select random" in prompt route

// MAAAAYBE
  // new train icon that rotates along with headlights
  // verbose console errors (in Chrome)
    // "[Violation] Forced reflow while executing JavaScript took 39ms"
      // https://gist.github.com/paulirish/5d52fb081b3570c81e3a
  // create toggle structure for page layout such that DOM responsivity requires less conditional logic; preset toggle groups for  various panes/panels (integrating all the if/else logic within calcSize(), expand(), and collapse() into styles.css doc; creating style groups to toggle on/off)
    // https://developer.mozilla.org/en-US/docs/Web/Events/toggle
    // css states?

////

// PERFORMANCE IMPROVEMENT IDEAS
  // removing unneeded elements from DOM as animation progresses (not sure what this would be)
  // removing everything from DOM at end of experience (WHY DOES MY COMPUTER HUM FOR 5 MINUTES POST EVERY ANIMATION)
  // use path.measure() or path.area() instead of turf.length() calculations to determine animation variables? how would pixel units translate to time?
  // taken from github issue notes:
    // redraw SVG (supported by use of `clipExtent()` or similar?) at certain moments within script
    // appropriately truncate coordinates and other values wherever possible
    // slim library imports / take only what I need
  // search/filter dynamically on backend? is this possible? goal: avoid bringing all of north america's enrichData into the browser every time
  // dynamically simplify map geometries?
  // is any of this invalidation stuff application, or relevant only within the context of Observable?
    // https://beta.observablehq.com/@mbostock/disposing-content
    // invalidation.then(() => cancelAnimationFrame(request));
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
  // polygon transitions: ideally, if I do end up using canvas, something akin to https://observablehq.com/@mbostock/randomized-flood-fill
  // if SVG, advanced play:
    // CSS filters: blur(),brightness(),hueRotate()
    // mix-blend-mode, filters: sepia(), blur(), drop-shadow(), grayscale()
    // backdrop filters? (not much browser compatability?)
    // SVG filters: feGaussianBlur, etc
  // basic transitions can also interpolate between:
    // visibility: visible and visibility: hidden
    // opacity [0, 1]
    // colors
    // location
    // size

// CODE CLEAN
  // be super consistent and clear including '' vs "", use of var/const/let, spacing, semicolons, etc
  // refactor, optimize, condense, DRY, improve structure

// ISSUES
  // keeping zindexes in line on small screen sizes (modal vs attribution, toggle buttons)
  // remaining open github issues (form focus issue: use focus-within?)
  // several more interspersed COMBAKs, FIXMEs, TODOs
  // PROBLEM CITIES (R2R issue)
    // FIX?? they are important ones:
      // Sault Ste Marie, ON
      // Charleston, SC
      // Cincinnatti, OH
      // Greenville, SC
      // Grand Junction, CO
      // Saskatoon, SK
      // Memphis, TN
      // Burlington, IA
    // REMOVE:

// BACKBURNER ISSUES
  // author txt bunches up on small screens when making font-weight of links bold (currently links simply unbolded)
  // add circle size reference to legend? (radius as representative of orig area for all polygons (under a certain threshold) I collapsed into their centroids)
  // label mess (currently commented out)


////////

// NOTES FOR RICH:
// I would recommend starting with all functions toggled close for program outline overview / reduced overwhelm
// I have left in a few commented-out visualizations of my process in case it helps you understand how the script is working
// Would appreciate general impressions, feedback, what works, what doesn't, the little things I am no longer seeing after all these months
// Would also appreciate any tips you have re: priority features I still hope to add, including:
  // a pause button
  // ability to select route visually, by clicking on city/rail stn locations from map
  // visualizing all number data tracker within dashboard (compass, elevation grid)
  // mousing over log/narration elements highlights all within map
// Most importantly, I still need specific help with certain issues including, in order of current importance:
  // resolving textured symbol output (apparent issue with .style("fill") on newly created symbol span -- see FIXME note within addNewGroup() function)
  // clearing everything necessary/possible upon 'select new route'
  // determining if/how I should go about converting visualization from SVG => 2D Canvas or even webGL
  // implementing anything else possible to improve performance (see old notes above, github issue#1)
