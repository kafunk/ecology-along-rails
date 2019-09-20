(function () {

///////////////////////////
//// SETUP ENVIRONMENT ////
///////////////////////////

//// INITIATE DATA LOAD

  // background/reference
  var admin0 = d3.json("data/final/admin0.json"),
      admin1 = d3.json("data/final/admin1.json"),
      rivers = d3.json("data/final/rivers.json"),
       lakes = d3.json("data/final/lakes.json"),
   urbanBase = d3.json("data/final/urban_areas.json"),
      places = d3.json("data/final/places.json"),
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

//// STATE MANAGEMENT & SEMI-GLOBALS

  // SET/RESET WITHIN restoreState0
  var timer, currentRoute, zoomAlongState, experience, transformAdjustments, togglesOff, transitionResume, encounteredPts, encounteredLines, encounteredPolys, uniqueEncounters, allEncounters, logGroups, tagTypes, symbolSet, logBackgrounds;

  // SET/RESET ELSEWHERE
  var currentBounds;
  var clickedOnce = false;
  var dblclickFilter;
  var svgLoaded = false; // prevents errors if initial screen load is < 500 (via size adjustments within collapse of about pane)
  var zoomAlongOptions;
  var trainPt, headlights, zoomArc, fullPath;  // nodes
  var fullLength, zoomLength, tFull, tPad;  // node properties
  var eased, routeDashInterpolator;  // interpolator fns
  // var accumReset = 0;  // (if I try to make train speed adjustable)

  // PERSISTENT ACROSS ROUTES
  var quadtree0;
  var state0 = {}; // restorable?
  var routeHx = {};
  var patterns = {};
  var data0;
  var bounds0;
  var firstLastOptions;

  // OTHER WORTHWHILE
  const miles = { units: "miles" }  // used repeatedly within turf.js method calls
  const tau = 2 * Math.PI;

  // ADJUSTABLE VARIABLES: eventually some of these could be user-controlled via sliders and such
  var scaleExtentFactor = 128, // breadth of scaleExtent
    arcSteps = 500,  // how fine tuned SVG path animation
    headlightRadius = 2,
    trainPtRadius = 0.8,
    arcSpan = 0.16 * tau, // (in radians)
    tpm = 20,  // time per mile; hard-coded goal of animated ms per route mile (more == slower) *** I WANT THIS USER ADJUSTABLE BUT tFull uses it to set animation length at very begin, so not sure I can make this dynamic within current structure
    minT = tpm * 10,
    tPause = 2400,  // standard delay time for certain transitions
    viewFocusInt = 100,  // miles in/out to initially focus view, start/stop zoomFollow
    maxInitZoom = 48,
    maxFollowZoom = 64, // limit active zoomAlongTransform scale
    maxFeatureZoom = 600,
    zoomDuration = tPause,  // zoom to frame transition duration
    trainEase = d3.easeSinInOut,
    relativeDim = 0.4,  // dimBackground level; lower values => greater dim
    reverseCut = 2, // duration of reversed experience relative to typical experience
    pyIgnore = ["grassland","lakes"],
    ptIgnore = ["pa-grp1","pa-grp2","pa-grp3"],
    symInvert = ["volcanoes","inv-roadless","other-np-geo"],  // logGroups.divIds; specific to converting styles -> legend-log swatches and narrative output backgrounds
    dimMore = ["#continent-mesh",["#railways","path"],["#rivers","path"],"#lake-mesh","#lake-mesh2","#country-mesh","#urban-mesh",["#cities","circle"]],
    dimLess = ["#state-mesh"],
    zoomInFactor = 1.25,
    zoomOutFactor = 0.75,
    radiusScale = d3.scaleSqrt()
                    .domain([7000000,100000000])
                    .range([0.08,0.2]),
    levelScale = d3.scaleSqrt()
                    .domain([1,4])
                    .range([0.075,0.025]);

  // FUNCTION EXPRESSIONS
  var cityState = d => {
    let region = d.state || d.province;
    return d.city + ", " + region;
  }

//// READY MAP

// SVG + SIZING

  var initial = calcSize();

  var width = initial.width,
    height = initial.height,
    extent0 = [[0,0],[width,height]];

  var svg = d3.select("#map").append("svg")
    .attr("id", "svg")
    .attr("width", width)
    .attr("height", height)

  svgLoaded = true;

  var hiddenSvg = d3.select("#map").append("svg")
    .attr("width",0)
    .attr("height", 0)

  var background = svg.append("rect")
    .attr("id", "background")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("fill", "none")
    .classed("point-all opacity75 bg-lighten25 no-zoom absolute top left",true)
    .on("dblclick", () => {
      // d3.event.stopPropagation();  // intended to prevent play/pause/etc if other active svg click event listeners; useless because reaches here AFTER togglePause(); also interferes with collapsing modal on dblclick
      resetZoom();
    })

  var g = svg.append("g")

  // inject external SVG files into local svg element
  d3.xml('./assets/station.svg').then(data => svg.node().append(d3.select(data).select("symbol").node()))

  d3.xml('./assets/noun_train.svg').then(data => svg.node().append(d3.select(data).select("symbol").node()))

// PROJECTIONS & PATHS

  // EPSG:102010
  var projection = d3.geoConicEquidistant()
    .rotate([96,0])
    .parallels([20,60])
    .translate([width/2, height/2])

  var reflectedY = d3.geoIdentity()
    .reflectY(true)

  var path = d3.geoPath().projection(projection),
      line = d3.line().curve(d3.curveCardinal.tension(0));

  var reflectedPath = d3.geoPath()
    .projection(reflectedY)

// PAN/ZOOM BEHAVIOR

  d3.select("button#zoom-in")
    .on('click', zoomClick)
    .on('mouseenter', highlightBtn)  // triggering mouseover style changes programmatically remedies bug of #zoom-in's hover state being triggered concurrent to #zoom-out's
    .on('mouseleave', removeHighlight);
  d3.select("button#zoom-out")
    .on('click', zoomClick)
    .on('mouseenter', highlightBtn)
    .on('mouseleave', removeHighlight)

  var zoom = d3.zoom()
    .on("zoom", zoomed)
    .filter(() => {
      // dbl-clicking on background does not trigger zoom (but rather resets it)
      return !(d3.event.type === "dblclick" && d3.event.path[0].classList.contains('no-zoom'))
    })

//// COLORS

  const palette = ['#94417f','#CD5C5C','#fa8253','#ec934a','#c7993f','#dbd99f']

  const paletteScale = chroma.scale(palette).domain([1,0]).mode('lch') //.correctLightness();

  const riverBlue = chroma("steelblue").alpha(0.8), // steelblue,cadetblue
         lakeBlue = "teal";

  const purple = '#c97b9f',
     purpleRed = '#94417f',
     orangeRed = '#f94545',
       darkRed = '#7a290e',
   peachOrange = '#f9b640',
     peachPink = '#dd8069',
    yellowGold = '#c7993f',
      darkGold = '#785d2b',
     goldGreen = '#b5be6a',
    groupGreen = '#8bc188',
     groupBlue = '#09a094',
     greenGrey = '#6f794c';

  let colorAssignments = {
    watersheds: {
      // oceanId: { base: baseColor }
      10: { base: "#E0FFFF" },
      20: { base: "#a1d7df" },
      30: { base: "#87CEEB" },
      40: { base: "#20B2AA" },
      50: { base: "#8c99cd" } // "#2F4F4F" }
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

  const outline1 = "rgba(76, 83, 91, .6)",  // could also be url(#pattern)s
        outline2 = "rgba(76, 83, 91, .3)"

// DEFAULT OPTIONS

   var defaultOptions = {
    init: {
      get width() { return width; },
      get height() { return height; },
      get extent0() { return [[0,0],[width,height]]; },
      padTop: 0,
      padRight: 0,
      padLeft: 0,
      padBottom: 0
    },
    get boundsTransform() { return {...this.init, ...this.spec.bounds} },
    get centerTransform() { return {...this.init, ...this.spec.center} },
    spec: {
      bounds: { scalePad: 0.05 }, // needs to stay here for zoom0
      center: { }
    },
    quadtree: {
      projectX: d => projection(d.geometry.coordinates)[0],
      projectY: d => projection(d.geometry.coordinates)[1]
    }
  }

// MORE DATA, CATEGORY ASSIGNMENT, ETC

  let geomAssoc = {
    "pt": {
      encounterCol: "A",
      groupId: "#enrich-pts",
      groupClass: ".enrich-pt",
      get logDiv() { return d3.select("#encounters-A") },
      get logCanvas() { return d3.select("#encounters-A").select("canvas#pts") },
      get set() { return encounteredPts; }
    },
    "py": {
      encounterCol: "B",
      groupId: "#enrich-polygons",
      groupClass: ".enrich-polygon",
      get logDiv() { return d3.select("#encounters-B") },
      get logCanvas() { return d3.select("#encounters-B").select("canvas#polys") },
      get set() { return encounteredPolys; }
    },
    "ln": {
      encounterCol: "C",
      groupId: "#enrich-lines",
      groupClass: ".enrich-line",
      get logDiv() { return d3.select("#encounters-C") },
      get logCanvas() { return d3.select("#encounters-C").select("canvas#lines") },
      get set() { return encounteredLines; }
    }
  },
     geomGrpIds = ["#encounters-A","#encounters-B","#encounters-C"];

  let contentAssoc = {
    "modal-about": {
      btn: "info",
      opp: "get-options"
    },
    "get-options": {
      btn: "select",
      opp: "modal-about"
    },
    opposites: {
      up: "down",
      down: "up",
      right: "left",
      left: "right"
    }
  }

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
      textureProps: {d: "waves", background: lakeBlue, stroke: "mediumseagreen", thicker: 24, lighter: 18, shapeRendering: "crispEdges"},
      htmlAdjust: { thicker: 1.25, heavier: 10 }
      // no keywords, CATEGORY.startsWith("Lake")
    },
    "RIVER": {
      divId: "rivers",
      fullTxt: "Rivers"
      // no keywords, CATEGORY.startsWith("River")
      // lines only, no texture
        // color === riverBlue
    },
    "INVENTORIED ROADLESS": {
      divId: "inv-roadless",
      fullTxt: "Inventoried Roadless Areas",
      textureType: "paths",
      textureProps: {d: "nylon", stroke: greenGrey, thicker: 48, lighter: 36, shapeRendering: "crispEdges"},
      ptTextureProps: {d: "nylon", thicker: 72, lighter: 48, background: greenGrey},
      htmlAdjust: { thicker: 0.8, heavier: 14 }
      // no keywords; DESCRIPTION (?) === "Inventoried Roadless Area"
    },
    "GRASSLAND": {
      divId: "grassland",
      fullTxt: "Grasslands",
      textureType: "lines",
      textureProps: {thicker: 48, lighter: 24, stroke: darkGold, orientation: "2/8"},
      htmlAdjust: { thicker: 2, heavier: 6 }
    },
    "VOLCANO": {
      divId: "volcanoes",
      fullTxt: "Volcanoes",
      textureType: "paths",
      textureProps: {d: "caps", thicker: 48, lighter: 24, stroke: darkRed, shapeRendering: "crispEdges"},
      ptTextureProps: {d: "caps", thicker: 108, lighter: 48, background: darkRed, shapeRendering: "crispEdges"},
      htmlAdjust: { thicker: 1.2, heavier: 12 }
      // no keywords; CATEGORY.startsWith("Volcano")
    },
    "GEOTHERMAL": {
      divId: "other-np-geo",
      fullTxt: "Other Non-protected Geothermal Areas",
      textureType: "lines",
      textureProps: {thicker: 60, lighter: 12, stroke: "greenyellow", orientation: "6/8"},
      ptTextureProps: {thicker: 108, lighter: 60, background: "greenyellow", orientation: "6/8"},
      htmlAdjust: { thicker: 2, heavier: 6 }
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
      textureProps: {d: "hexagons", thicker: 72, lighter: 42, shapeRendering: "crispEdges"},
      ptTextureProps: {d: "hexagons", thicker: 96, lighter: 48, shapeRendering: "crispEdges"},
      htmlAdjust: { thicker: 2, lighter: 0 }
    },
    "PA2": {
      divId: "pa-grp2",
      fullTxt: "Protected Areas - Group 2",  // secondary
      keywords: ["national", "state", "provincial", "park", "parks", "monument", "monuments", "seashore", "lakeshore", "forest", "forests", "refuge", "grassland", "grasslands", "reserve", "preserve", "conservation", "conservancy", "environmental", "critical", "wetland", "wetlands", "wilderness", "ecological", "biodiversity", "botanical", "study", "research", "science"].map(d => d.toUpperCase()), // ??
      // kwSlimmed: [park*, monument*, forest*, grassland*, conserv*, wetland*],
      weight: 2,
      textureType: "paths",
      textureProps: {d: "crosses", thicker: 48, lighter: 30, shapeRendering: "crispEdges"},
      ptTextureProps: {d: "crosses", thicker: 84, lighter: 48},
      htmlAdjust: { thicker: 1.2, lighter: 1 }
      // national, state, provincial, park, monument, etc matches will be disjoint from PA1 group above (matched only one keyword group, not both)
    },
    "PA3": {
      divId: "pa-grp3",
      fullTxt: "Protected Areas - Group 3",  // remaining
      weight: 3,
      textureType: "circles",
      textureProps: { complement: true, thicker: 54, lighter: 24 },
      ptTextureProps: { complement: true, thicker: 72, lighter: 36 },
      htmlAdjust: { thinner: 18, lighter: 0, radius: 1.8 , size: 8 }
      // no keywords; CATEGORY === "Protected Area" && DESCRIPTION !== "Inventoried Roadless Area"
    }
  },
         catKeys = Object.keys(enrichCats);

  let paTags = {  // protected area tags; not mutually exclusive with protected area categories, but mutually exclusive amongst each other; catalogued in order of first preference / weight
    "geo": {
      divId: "geo",
      fullTxt: "Geothermal",  // or likely so
      keywords: ["geothermal", "geologic", "geological", "volcano", "volcanoes", "volcanic", "stratovolcano", "stratovolanic", "stratovolcanoes", "lava", "lavas", "dome", "domes", "cone", "cones", "cinder", "cinders", "maar", "maars", "caldera", "calderas", "tuff ring", "tuff rings", "pyroclastic", "geyser", "geysers", "hot spring", "hot springs", "hot well", "hot wells", "sulphur", "sulphuric", "boiling", "mount", "mt"].map(d => d.toUpperCase()),
      // kwSlimmed: [geo*, volcan*, strato*, lava*, dome*, cone*, cinder*, maar*, caldera*, tuff*, geyser*, pyro*, sulphur*, /^(hot)\s+/, /\s+(cone)\s*/],  // these regexes don't necessarily work yet!
      weight: 1,
      color: darkRed // orangeRed
    },
    "hab": {
      divId: "hab",
      fullTxt: "Habitat",
      keywords: ["habitat", "habitats", "wildlife", "den", "dens", "breeding", "migratory", "migration", "critical", "gathering", "species", "sccc", "fish", "fauna", "range", "ranges", "nest", "nesting", "pupping", "grounds"].map(d => d.toUpperCase()), // ALSO, HABITAT FLAG!
      // kwSlimmed: [habitat*, den*, migrat*, nest*, range*],
      weight: 2,
      color: goldGreen
    },
    "water": {
      divId: "water",
      fullTxt: "Water-Related",
      keywords: ["wetland", "wetlands", "sea", "seashore", "seashores", "lake", "lakeshore", "lakeshores", "beach", "beaches", "coast", "coasts", "coastal", "marine", "estuary", "estuarine", "estuaries", "riparian", "spring", "springs", "water", "waters", "waterway", "waterways", "creek", "creeks", "stream", "streams", "river", "rivers", "confluence", "lake", "lakes", "bog", "bogs", "marsh", "marshes", "delta", "deltas", "tributary", "tributaries", "rapid", "rapids", "cove", "coves", "rio", "río"].map(d => d.toUpperCase()),
      // kwSlimmed: [water*, wetland*, sea*, stream*, creek*, bog*, lake*, beach*, coast*, estuar*, spring*, river*, lake*, delta*, tributar*, rapid*, marsh*, cove*],
      weight: 3,
      color: groupBlue
    },
    "wild": {
      divId: "wild",
      fullTxt: "Other Wildlands",
      keywords: ["wild", "wilds", "wildland", "wildlands", "wilderness", "ecology", "ecological", "grassland", "grasslands", "biodiverse", "biodiversity", "refuge", "refuges", "botanical"].map(d => d.toUpperCase()),
      // kwSlimmed: [wild*, ecolog*, grass*, biodivers*, refuge*],
      weight: 4,
      color: yellowGold
    },
    "sci": {
      divId: "sci",
      fullTxt: "Science & Research",
      keywords: ["experiment", "experimental", "study", "studies", "station", "stations", "research", "science", "scientific", "school", "schools"].map(d => d.toUpperCase()),
      // kwSlimmed: [experiment*, stud*, station*, scien*, school*],
      weight: 5,
      color: peachOrange
    },
    "rec": {
      divId: "rec",
      fullTxt: "Recreational",
      keywords: ["recreation", "recreational", "trail", "trails", "greenway", "greenways"].map(d => d.toUpperCase()),
      // kwSlimmed: [recreat*, trail*, greenway*],
      weight: 6,
      color: purpleRed
    },
    "rpc": {
      divId: "rpc",
      fullTxt: "Otherwise Reserved/Preserved/Conserved",
      keywords: ["reserve", "reserves", "preserve", "preserves", "conservation", "conservancy", "conservancies", "easement", "easements"].map(d => d.toUpperCase()),
      // kwSlimmed: [reserve*, preserve*, conserv*, easement*],
      weight: 7,
      color: peachPink
    },
    "general": {
      divId: "gen",
      fullTxt: "Other - Primary",
      keywords: ["national","state","provincial","park"].map(d => d.toUpperCase()),
      weight: 8,
      color: groupGreen,
    },
    "other": {
      divId: "other",
      fullTxt: "Other - Secondary",  // vaguest
      keywords: ["nature", "natural", "open", "scenic", "historic", "blm", "land", "lands", "area", "areas", "protection", "protected"].map(d => d.toUpperCase()),  // only match if no better fit
      // kwSlimmed: [natur*, land*, area*, protect*],
      weight: 9,
      color: purple
    }
  },
      paKeys = Object.keys(paTags),
    tagWords = Object.values(paTags).map(d => d.keywords);

// CUSTOM DISPATCH BEHAVIOR

  let dispatch = d3.dispatch("depart","encounter","arrive","reverse","unencounter","reverseArrived")
    .on("depart.train", departed)
    .on("encounter.trigger", encountered)
    .on("arrive.train", arrived)
    .on("reverse.train", () => departed(true))  // reverseFlag = true;
    .on("unencounter.trigger", unencountered)
    .on("reverseArrived.train", reverseArrived)

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

/////////////////////////////
////// ACTION! FINALLY //////
/////////////////////////////

//// PREPARE MAP LAYERS

  // SET BOUNDING BOX
  admin0.then(data => {
    data0 = getMesh(data,"countries");
    bounds0 = {
      get bounds() { return path.bounds(data0); },
      get domEdge() {
        if (!this._domEdge) this._domEdge = longerEdge(this.bounds);
        return this._domEdge;
      }
    }
    resetZoom(true)  // state0 == true;
    restoreState0(true)  // init == true;
  }, onError)

  // DRAW VECTOR BASE
  Promise.all([admin0,admin1,lakes,rivers,places,urbanBase,railBase,railStns]).then(drawBase, onError);

  function drawBase(data) {

    // CONVERT TJ'S TO GJ'S AS NECESSARY
    let sourceData = tjToGj(data);

    // MESH SELECT
    let continentMesh = getMesh(sourceData.countries.tj,"countries",outerlines()),
        countriesMesh = getMesh(sourceData.countries.tj,"countries",innerlines()),
           statesMesh = getMesh(sourceData.states.tj,"states"),
             lakeMesh = getMesh(sourceData.lakes.tj,"lakes"),
            urbanMesh = getMesh(sourceData.urbanAreas.tj,"urbanAreas");

    // define svg groups
    var baselayers = g.append("g")
      .attr("class", "base basemap baselayers")
    var adminBase = baselayers.append("g")
      .attr("id", "admin-base")
    var hydroBase = baselayers.append("g")
      .attr("id", "hydro-base")
    var urbanRailBase = baselayers.append("g")
      .attr("id", "urban-rail-base")

    // FILLED MESH
    adminBase.append("path")
      .attr("id", "continent-mesh")
      .attr("d", path(continentMesh))
      .style("stroke","#004c4c")
      .style("stroke-width",0.2)
      .style("stroke-opacity",0.8)
      .style("fill","dimgray")

    hydroBase.append("path")
      .attr("id", "lake-mesh")
      .attr("d", path(lakeMesh))
      .style("fill","cyan")
      .style("opacity",0.4)
      .style("stroke","darkcyan")
      .style("stroke-width",0.05)
      .property("orig-opacity",0.4)

    hydroBase.append("path")
      .attr("id", "lake-mesh2")
      .attr("d", path(lakeMesh))
      .style("fill","yellowgreen")
      .style("opacity",0.12)
      .style("stroke","black")
      .style("stroke-width",0.1)
      .property("orig-opacity",0.12)

    urbanRailBase.append("path")
      .attr("id", "urban-mesh")
      .attr("d", path(urbanMesh))
      .attr("stroke","silver")
      .attr("fill","gainsboro")
      .style("stroke-width",0.025)
      .style("opacity",0.4) // 0.8
      .style("stroke-opacity",1)
      .property("orig-opacity",0.4)
      .property("orig-stroke-opacity",1)

    // STROKED MESH
    adminBase.append("path")
      .attr("id","country-mesh")
      .attr("d", path(countriesMesh))
      .style("fill","none")
      .style("stroke","#222834")
      .style("stroke-width", 0.4)

    adminBase.append("path")
      .attr("id","state-mesh")
      .attr("d", path(statesMesh))
      .style("fill","none")
      .style("stroke","magenta")
      .style("stroke-width",0.21)
      .style("stroke-dasharray", "0.2 0.2")

    // STROKED FEATURES
    hydroBase.append("g")
      .attr("id", "rivers")
      .selectAll("path")
      .data(sourceData.rivers.gj.features)
      .enter().append("path")
        .attr("d", path)
        .style("fill", "none")
        .style("stroke", riverBlue)
        .style("opacity", 0.8)
        .style("stroke-width", d => d.properties.strokeweig * 0.6)
        .property("orig-opacity", 0.8)

    urbanRailBase.append("g")
      .attr("id", "railways")
      .selectAll("path")
      .data(sourceData.railways.gj.features)
      .enter().append("path")
        .attr("d", path)
        .attr("stroke-width", d => { return (8/(d.properties.scalerank * 10)) })
        .attr("stroke","lightslategray")
        .style("fill", "none")

    // POINT FEATURES
    urbanRailBase.append("g")
      .attr("id","cities")
      .selectAll("circle")
      .data(sourceData.places.gj.features)
      .enter().append("circle")
        .attr("r", d => Math.max(0.05,0.25 / (d.properties.scalerank + 1)))
        .attr("cx", d => { return projection(d.geometry.coordinates)[0]; })
        .attr("cy", d => { return projection(d.geometry.coordinates)[1]; })
        .property("name", d => { return cityState(d.properties); })
        .property("orig-stroke-opacity",0.8)
        .property("orig-stroke","mediumseagreen")
        .style("fill", "yellowgreen")
        .style("stroke", "mediumseagreen")
        // .style("stroke-width", d => 1 / d.properties.scalerank * 0.01)
        .on("mouseenter", onMouseenter)
        .on("mouseout", onMouseout)

    let stations = urbanRailBase.append("g")
      .attr("id", "rail-stations")
      .selectAll("use")
      .data(sourceData.stations.gj.features)
      .enter().append("use")
        .attr("xlink:href", "#station-icon")
        .attr("x", d => { return projection(d.geometry.coordinates)[0] - 0.75; })
        .attr("y", d => { return projection(d.geometry.coordinates)[1] - 1; })
        .attr("width", 1.5)
        .attr("height", 2)
        .property("name", d => { return cityState(d.properties); })
        .style("opacity", 0.8)
        .style("stroke-opacity", 0.6)
        .style("fill","lightsalmon")
        .style("stroke","indianred")
        .style("stroke-width","1px")
        .property("orig-opacity",0.8)
        .property("orig-stroke","indianred")
        .property("orig-stroke-opacity",0.6)
        .property("orig-stroke-width","1px")
        .on("mouseenter", onMouseenter)
        .on("mouseout", onMouseout)

    // sort stations by city name
    let sorted = sourceData.stations.gj.features.sort((a, b) => {
      var localA = a.properties.city.toLowerCase(),
          localB = b.properties.city.toLowerCase();
      if (localA < localB) return -1;
      if (localA > localB) return 1;
      return 0; // default return value (no sorting)
    });

    // let shuffled = shuffle(sourceData.stations.gj.features);

    // create new allStations array by extracting sorted, slimmed railStns properties
    // var allStations = shuffled.map( (d,i) => {
    var allStations = sorted.map((d,i) => {
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

  async function showLrgControls(childId,fnString = "flashClose",duration = 100) {

    d3.select("#center-controls").classed("none",false)
    if (childId) d3.select("#center-controls").select(`#${childId}`).classed("none",false)

    let promise = new Promise(async (resolve, reject) => {
      let innerPromise = new Promise(async (resolve1, reject1) => {
        d3.timeout(async () => {
          let gatekeeper = await eval(fnString)(childId)
          resolve1()
        }, duration);
      })
      let gatekeeper = await innerPromise;
      resolve()
    })

    return await promise;

    async function flashClose(childId) {

      let promise = new Promise(async (resolve,reject) => {
        d3.select("#center-controls")
          .transition().duration(300)
          .style("opacity",0)
          .on("end",function() {
            resolve();
            d3.select(this)
              .classed("none",true)
              .style("opacity", 1)
            if (childId) d3.select(this).select(`#${childId}`).classed("none",true)
          })
      })

      let gatekeeper = await promise;  // won't progress past this line until promise resolved
      return true;

    }

    async function awaitUserInput(childId) {

      let promise = new Promise(async (resolve,reject) => {

        svg.on("click", () => {
          // FILTER DBLCLICKS
          if (clickedOnce) {
            clickedOnce = false;
            clearTimeout(dblclickFilter)
            return;  // user is dblclicking; ignore this event (dblclick event listeners proceed)
          } else {   // clicking for the first time in recent history
            dblclickFilter = setTimeout(function() {
              clickedOnce = false;
              proceedWithSingleClick();  // if no more clicks follow, proceed
            }, 150);
            clickedOnce = true;
          }
          async function proceedWithSingleClick() {
            svg.on("click",null);
            let gatekeeper = await animateCollapse(childId);
            resolve();
          }
        });

        window.onkeydown = function(e) {
          if (e.isComposing || e.keyCode !== 32) return;
          // else, set & unset additional listener
          e.preventDefault();  // spacebar shouldn't trigger any other recently pressed buttons, etc
          window.onkeyup = async function(e) {
            if (e.isComposing || e.keyCode !== 32) return;
            // else
            window.onkeydown = null;
            window.onkeyup = null;
            let gatekeeper = await animateCollapse(childId);
            resolve();
          }
        };

      })

      let gatekeeper = await promise;  // won't progress past this line until promise resolved

      d3.select("#play-lrg")
        .classed("opacity100",false)
        .classed("opacity75",true)

      return true;

    }

    async function animateCollapse(childId) {

      var slideLeft = false;

      var initBounds = d3.select("#center-controls").node().getBoundingClientRect()

      var targetBounds = d3.select("#play-pause-btn").node().getBoundingClientRect();

      var transform0 = `translate(0px,0px) scale(1,1)`,
          transform1 = `translate(${(targetBounds.x - initBounds.x) + (targetBounds.width - initBounds.width)/2}px,${(targetBounds.y - initBounds.y) + (targetBounds.height - initBounds.height)/2}px) scale(${targetBounds.width/initBounds.width},${targetBounds.height/initBounds.height})`

      var transformTween = d3.interpolateString(transform0,transform1);

      if (d3.select("#lrg-control-text").node()) {
        var textBounds = d3.select("#lrg-control-text").node().getBoundingClientRect(),
            transform2 = `translate(${-window.innerWidth}px,0px)`;
        slideLeft = d3.interpolateString(transform0,transform2)
      }

      let promise = new Promise(async (resolve,reject) => {
        d3.select("#center-controls")
          .transition().duration(1200)
            .styleTween('transform', d => transformTween)
            .on("start",function() {
              if (slideLeft) {
                d3.select("#lrg-control-text")
                  .transition().duration(1200) // delay(600).duration(600)
                  .styleTween('transform', d => slideLeft)
                  .on("end", function() {
                    d3.select(this)
                      .classed("hide-visually none",true)
                      .style("transform",null)
                    d3.timeout(() => {
                      d3.select("#center-controls-parent").classed("mb36",false)
                    },750);  // avoids flicker upon collapse
                  })
              }
            })
            .on("end",function() {
              d3.select(this).transition().delay(300).duration(500) // .delay(750).duration(750)
                .style("opacity", 0)
                .on("start", () => {
                  d3.select("#play-pause-btn").transition().duration(300) // .duration(750)
                    .style("opacity", 1)  // in case previously hidden
                })
                .on("end", function() {
                  resolve();
                  d3.select(this)
                    .classed("none", true)
                    .style("transform", null)
                    .style("opacity", 1)
                  if (childId) d3.select(this).select(`#${childId}`).classed("none",true)
                })
            })
      })

      let gatekeeper = await promise;  // won't progress past this line until promise resolved
      return true;

    }

  }

//// ON INITIAL LOAD

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

    // STORE IN state0; make sure event listeners & data included
    state0.opt0 = d3.select("#getOption0").node().innerHTML;
    state0.opt1 = d3.select("#getOption1").node().innerHTML;

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

    // fixable problem list:
    let fixable = [{ name: "grand junction" },{ name: "ann arbor" },{   name: "atlanta" },{ name: "memphis" },{ name: "charleston" },{ name: "cincinnatti", addition: "Amtrak" },{ name: "greenville" },{ name: "saskatoon", addition: "VIA Station" },{ name: "burlington" }]

    let index0 = fixable.findIndex(d => opt0.toLowerCase().startsWith(d.name)),
        index1 =  fixable.findIndex(d => opt1.toLowerCase().startsWith(d.name));

    if (index0 >= 0) opt0 = capitalize(fixable[index0].name) + " " + (fixable[index0].addition || "Amtrak Station");
    if (index1 >= 0) opt1 = capitalize(fixable[index1].name) + " " + (fixable[index1].addition || "Amtrak Station");

    let from = d3.json(`https://free.rome2rio.com/api/1.4/json/Autocomplete?key=&query=${opt0}`).then(extractCrux,onError),
          to = d3.json(`https://free.rome2rio.com/api/1.4/json/Autocomplete?key=&query=${opt1}`).then(extractCrux,onError),
     routeId,
     storedFlag;

    let selection = Promise.all([from,to]).then(([from,to]) => {
      routeId = getRouteId(from,to);
      if (routeHx[routeId]) storedFlag = true;
      return storedFlag ? "stored" : queryAPI(from,to);
    },onError);

    selection.then(results => {
      if (results == null) {  // if no rail-only routes found, reprompt user;
        toggleModal("get-options","open")
      } else {  // otherwise, proceed with drawing/zooming to chosen route
        toggleLoading();
        let processed = storedFlag ? Promise.resolve(routeHx[routeId]) : processReceived(results);
        processed.then(function(routeData) {
          // store as current
          currentRoute = routeData;
          // bind all trigger points to the DOM for en route intersection;
          bindQuadtreeData(currentRoute.quadtree,true) // triggerPtFlag === true
          // initiate experience
          initExp(storedFlag);
        }, onError);
      }
    }, onError);

    function extractCrux(results) {
      let topMatch = results.places[0];
      return topMatch ? {
        shortName: topMatch.shortName,
        lat: topMatch.lat,
        lng: topMatch.lng
      } : null;
    }

    function fightBack(opt0,opt1) {

    }

  }

  // provide user feedback that map content is loading
  function toggleLoading() {

    toggleModal()

    collapse("about");

    d3.select("#veil")
      .transition().duration(600)
        .attr("opacity", 0)
        .on("end", function() {
          d3.select(this).classed("none", true)
        })

    d3.select("#map-init-load")
      .attr("opacity",0)
      .classed("none", false)
      .transition().duration(300)
        .attr("opacity", 1)

  }

//// API / DATA-PROCESSING RELATED

  function queryAPI(opt0,opt1) {

    // save and parse user input
    var posA = opt0 ? `${opt0.lat}%2C${opt0.lng}` : null,
        posB = opt1 ? `${opt1.lat}%2C${opt1.lng}` : null,
       nameA = opt0 ? replaceCommas(opt0.shortName) : null,
       nameB = opt1 ? replaceCommas(opt1.shortName) : null;

    // define Rome2Rio API query string
    let apiCall = `https://free.rome2rio.com/api/1.4/json/Search?key=V8yzAiCK&oPos=${posA}&dPos=${posB}&oName=${nameA}&dName=${nameB}&oKind=station&dKind=station&noAir&noAirLeg&noBus&noFerry&noCar&noBikeshare&noRideshare&noTowncar&noMinorStart&noMinorEnd&noPrice`

    return d3.json(apiCall).then(validate,onError);

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

      // determining which route returns lead to rare error from turf.js
      if (!Array.isArray(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat()) || raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat().length < 2) {
        console.log("problem!")
        console.log(raw)
        console.log(raw.routes[0].segments)
        // places.length = 1 (singlular)
        // routes.name "Walk"
        // Jacksonville FL
        // transferDuration = 0, transitDuration = 0, vehicle = 0, arrPlace = 0 ,depPlace = 0, distance = 0;
        console.log(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)))
        // coordinates = single pt
        console.log(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates))
        console.log(raw.routes[0].segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat())
      }

      let route = raw.routes[0],
       mergedGJ = turf.lineString(route.segments.map(d=>polyline.toGeoJSON(d.path)).map(d=>d.coordinates).flat()),
        inMiles = Math.round(kmToMi(route.distance)),
      inMinutes = Math.round(route.totalTransitDuration); // not including transfers

      let thisRoute = {
        id: getRouteId(raw.places[0],raw.places[1]),
        from: raw.places[0],
        to: raw.places[1],
        totalMiles: inMiles,
        totalTime: inMinutes,
        minPerMile: inMinutes / inMiles,
        segments: route.segments.map(storeSegmentDetails),
        get relStops() {
          if (!this._relStops) this._relStops = getRelStops(this,raw.places);
          return this._relStops;
        },
        geoMM: getSteps(mergedGJ,inMiles),
        views: {
          data1: mergedGJ
        }
      }

      function storeSegmentDetails(segment) {
        return {
            agency: (segment.agencies) ? raw.agencies[segment.agencies[0].agency] : null,
          lineName: (segment.agencies) ? segment.agencies[0].lineNames[0] : null,
         departing: raw.places[segment.depPlace],
          arriving: raw.places[segment.arrPlace]
        }
      }

      function getRelStops(routeObj,allStops) {

        // COMBAK ensure routeObj actually updated from within here
        let stopSet = new Set();

        let toFromStns = allStops.filter(d => d.shortName.startsWith(routeObj.from.shortName) && d.kind === "station" || d.shortName.startsWith(routeObj.to.shortName) && d.kind === "station");

        if (toFromStns.length < 2) {

          let missing = [];

          if (!toFromStns.some(d => d.shortName.startsWith(routeObj.from.shortName))) missing.push(routeObj.from)

          if (!toFromStns.some(d => d.shortName.startsWith(routeObj.to.shortName))) missing.push(routeObj.to)

          missing.forEach(d => toFromStns.push(d));

        }

        toFromStns.forEach(d => d.toFrom = d.shortName.startsWith(routeObj.to.shortName) ? "to" : "from")

        let oTos = toFromStns.filter(d => d.toFrom === "to"),
          oFroms = toFromStns.filter(d => d.toFrom === "from"),
             tos = (oTos.length > 1) ? oTos.filter(d => ["Amtrak","VIA","Station"].some(match,d.shortName)) : oTos,
           froms = (oFroms.length > 1) ? oFroms.filter(d => ["Amtrak","VIA","Station"].some(match,d.shortName)) : oFroms;

        // avoid overfiltering
        if (tos.length < 1) tos = oTos;
        if (froms.length < 1) froms = oFroms;

        toFromStns = tos.concat(froms);

        toFromStns.forEach(d => {
          d.flagged = true;
          stopSet.add(d);
        })

        routeObj.segments.forEach(d => {
          stopSet.add(d.departing);
          stopSet.add(d.arriving);
        });

        return [...stopSet];

      }

      return thisRoute;

    }

    // Relate route waypts/nodes/links to spatially intersecting (given buffer) data for interesting and illuminating route experience
    function enrichRoute(chosen) {

      let headlightDegrees = 1.5; // was 0.5; play around with approximate conversion of degrees -> pixels given path? (some combo of path.measure() and projection.invert()?)

      // keep radius consistent with filtered pool of enrichData
      let bufferedRoute = turf.buffer(chosen.views.data1, headlightDegrees, {units: "degrees", steps: 12});

      let possFeatures = Promise.all([quadtreeReps,admin0]).then(getIntersected,onError);

      // store routeQuadtree plus all relevant pts, lines, and polys in chosen (currentRoute) object
      let enriched = Promise.all([possFeatures,triggerPts]).then(([idList,pts]) => {

        const onList = d => {
          return idList.has(d.properties.id)
        }

        const withinBuffer = d => {
          return turf.booleanPointInPolygon(d,bufferedRoute);
        }

        let quadData = topojson.feature(pts, pts.objects.triggerPts).features.filter(onList).filter(withinBuffer)

        let options = {
          bounding: bufferedRoute
        }

        chosen.quadtree = makeQuadtree(quadData,options)

        return Promise.all([enrichPts,enrichLines,enrichPolys]).then(data => {
          chosen.readyAndWaiting = {};
          data.forEach(geomGrp => {
            let key = Object.keys(geomGrp.objects)[0];
            let filtered = topojson.feature(geomGrp,geomGrp.objects[key]).features.filter(onList);
            filtered.forEach(datum => chosen.readyAndWaiting[datum.properties.id] = datum);
          })
          return chosen;
        });

      },onError)

      return enriched;

      function getIntersected([quadReps,quadBounds]) {

        // FIRST make a quadtree of all representative enrich data pts draped over North America

        let quadtreeData = topojson.feature(quadReps,quadReps.objects.searchReps).features,
              dataExtent = getMesh(quadBounds,"countries")

        if (!quadtree0) quadtree0 = makeQuadtree(quadtreeData,{bounding:dataExtent})

        let searchExtent = padExtent(path.bounds(bufferedRoute))  // add x padding to initial quadtree searchExtent to ensure initial filter sufficiently broad

        let filteredEnrich = searchQuadtree(quadtree0, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1])

        return new Set(filteredEnrich.map(d => d.properties.id));  // possibleFeatures

      }

    }

  }

  function getRouteId(from,to) {
    return from.shortName.slice(0,3).toLowerCase() + to.shortName.slice(0,3).toLowerCase() + `${from.lng}`.slice(0,5).replace('.','') + `${from.lat}`.slice(0,4).replace('.','') + `${to.lng}`.slice(0,5).replace('.','') + `${to.lat}`.slice(0,4).replace('.','')
  }

//// INITIATE EXPERIENCE

  function initExp(storedFlag = false) {

    experience.initiated = true;

    // prevent stray mouseover from upsetting opacity on stations I need to disappear
    g.select("#rail-stations").selectAll("use")
      .classed("point-none",true)

    prepareEnvironment().then(() => { // proceed

      currentRoute.views.routeBoundsIdentity = storedFlag ? currentRoute.views.routeBoundsIdentity : () => {

        // bottomPad0 == scale accommodation; bottomPad == actual shift
        let bounds1 = path.bounds(currentRoute.views.data1),
          bottomPad = getBottomPad(),
         dashHeight = d3.select("#dash").node().clientHeight,
         bottomPad0 = height < dashHeight * 2 ? bottomPad : dashHeight;  // map height must be at least twice that of dash to impact scale calculations

        // if fitting taller route into taller screen, no need for scalePad (bottomPad > 24 will take care of this)
        let scalePad = bottomPad0 > 24 && longerEdge(bounds1) === "height" ? 0 : 0.1,
            options0 = { scalePad: scalePad, padBottom: bottomPad0 },
                  k1 = getTransform(bounds1,options0).k;  // initial run used to confirm not overzooming

        let scale1 = Math.min(maxInitZoom,k1),
          options1 = { scale: scale1, padBottom: bottomPad };

        return getIdentity(getTransform(bounds1,options1));

      }

      // control timing with transition start/end events
      svg.transition().duration(zoomDuration)
        .call(zoom.transform, currentRoute.views.routeBoundsIdentity)
        .on("start", () => {
          currentBounds = {
            get bounds() { return path.bounds(currentRoute.views.data1); },
            get domEdge() {
              if (!this._domEdge) this._domEdge = longerEdge(this.bounds);
              return this._domEdge;
            }
          }
          transitionIn()
        })
        .on("end", () => {
          // pause (prepare user?), then zoom to firstFrame
          // prepareUser();
          d3.timeout(() => {
            onYourMarks(storedFlag);
          }, tPause);
        })

    })

    function prepareEnvironment() {

      let task1 = setupDash(),
          task2 = setupEnrichLayers(),
          task3 = drawRoute();

      return Promise.all([task1,task2,task3]);

      function setupDash() {

        // // store state0
        // state0.dash = d3.select("#dash").node().innerHTML;

        // ROUTE SUMMARY
        // agency names & lines
        let agencies = [...new Set(currentRoute.segments.map(d => {
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
          .classed("flex-child one-life",true)
          .text(currentRoute.from.shortName)
        d3.select("#to").insert("span")
          .classed("flex-child one-life",true)
          .text(currentRoute.to.shortName)
        d3.select("#via").insert("div")
          .classed("one-life",true)
          .html(agencyHtml)
          .attr("strokeStyle","dimgray")

        // WIDGETS
        initElevation()
        initOdometer()
        initClock()
        initCompass()

        d3.select("#dash").selectAll(".toggle-none").classed("none",false)

        if (experience.i < 1) dashInit0();

        return true;

        function exRedundant(lineName,agencyName){
          let regex = new RegExp(`${agencyName}\\s*`)
          return lineName.replace(regex,'').replace('Line','')
        }

        function initElevation() {
          getElevation([currentRoute.from.lng,currentRoute.from.lat]).then(elevation => d3.select("#elevation-val").text(elevation));
        }

        function initOdometer() {
          d3.select("#total-miles").text(`${currentRoute.totalMiles} miles`)
        }

        function initClock() {
          d3.select("#total-time").text(`${currentRoute.totalTime} minutes`)
        }

        function initCompass() {
          let azimuth0 = getAzimuth(0);
          d3.select("#compass-val").text(azimuth0)
          d3.select("#current-quadrant").text(getQuadrant(azimuth0))
        }

        function dashInit0() {
          // no need to do these things twice if user has setup dash before

          d3.select("#asl-abbr")
            .on("mouseover", function() {
              d3.select(this).append("div")
                .attr("class","tooltip px6 pt6 pb3 bg-darken75 color-lighten75 z5 point-none")
                .style("left", (d3.event.clientX + 6) + "px")
                .style("top", (d3.event.layerY + 36) + "px")
                .style("fill", "dimgray")
                .style("stroke", "whitesmoke")
                .text("above sea level") // abbr default too delayed
            })
            .on("mouseout", function() {
              d3.select(this).selectAll(".tooltip").remove();
            })

        }

      }

      function setupEnrichLayers() {

        // enrich content groups
        const enrichLayer = g.append("g")
          .attr("id","enrich-layer")
          .classed("one-life",true)

        enrichLayer.append("g").attr("id","enrich-polygons")
        enrichLayer.append("g").attr("id","enrich-lines")
        enrichLayer.append("g").attr("id","enrich-pts")

        return true;

      }

      function drawRoute() {

        var journey = g.append("g")
          .attr("id", "journey")
          .classed("one-life",true)
        var route = journey.append("g")
          .attr("id", "route")
        var train = journey.append("g")
          .attr("id", "train")

        let arcPts = getSimpRoute(turf.lineString(projectArray(truncateCoords(getSteps(currentRoute.views.data1,currentRoute.totalMiles,arcSteps)))),0.1).geometry.coordinates;
        // getSimpRoute(turf.lineString(currentRoute.arcPts),0.1).geometry.coordinates;

        // LINE/ROUTE

        // faint underlying solid
        route.append("path")
          .attr("d", line(arcPts))
          .style("fill","none")
          .style("stroke","honeydew")
          .style("opacity",0.6)
          .style("stroke-width",0.3)

        // setup path for stroke-dash interpolation
        var fullRoute = route.append("path")
          .attr("id", "full-route")
          .attr("d", line(arcPts))
          .style("fill", "none")
          .style("stroke", "#682039")  // "#222834" is background
          .style("stroke-width", 0.2)
          .style("opacity",0)

        // UNDERLYING TICKS/TIES
        let rrTies = route.append("g")
          .attr("id","rr-ties")
          .append("path")
          .attr("d", line(arcPts))
          .style("fill", "none")
          .style("stroke","gainsboro")
          .style("stroke-width",0.4)
          .style("stroke-dasharray", "0.075 0.25")

        // separately add relevant station points (those with stops) using R2R return data
        route.append("g").attr("id", "station-stops")
          .selectAll("use")
          .data(currentRoute.relStops.sort((a,b) => {
            // in case stop/start station overlaps with another, stop/start comes later to ensure drawn on top
            return a.flagged || !b.flagged ? 1 : -1;
          }))
          .enter().append("use")
            .attr("xlink:href", "#station-icon")
            .attr("x", d => {
              let halfWidth = (d.flagged) ? 0.75 : 0.5;
              return projection([d.lng,d.lat])[0] - halfWidth;
            })
            .attr("y", d => {
              let halfHeight = (d.flagged) ? 1 : 0.75;
              return projection([d.lng,d.lat])[1] - halfHeight;
            })
            .attr("width", d => d.flagged ? 1.5 : 1)
            .attr("height", d => d.flagged ? 2 : 1.5)
            .style("opacity", 0) // initially
            .style("fill", d => !d.flagged ? "black" : (d.toFrom === "from") ? "forestgreen" : "brown")
            .style("stroke", d => !d.flagged ? "dimgray" : "black")
            .style("stroke-width","0.3px") // 0.4
            .property("name", d => d.shortName)
            .property("orig-stroke", d => !d.flagged ? "dimgray" : "black")
            .property("orig-opacity", d => d.flagged ? 1 : 0.6)  // specified for mouseenter -> mouseout reset
            .property("orig-stroke-opacity",0.6)
            .property("orig-stroke-width","0.3px")
            .on("mouseenter", onMouseenter)
            .on("mouseout", onMouseout)

        // make headlights!
        let radians0 = 0, // start with unrotated sector
             sector0 = getSector(radians0,headlightRadius),
            // rotate0 =  getRotate(simpCoords[0],simpCoords[1]);
             rotate0 =  getRotate(arcPts[0],arcPts[1]);

        // add headlights as DOM node (opacity transitions in from 0)
        var headlights = train.append("path")
          .attr("id", "headlights")
          .attr("d", sector0)
          .attr("transform", "translate(" + arcPts[0] + ") rotate(" + rotate0 +")")
          .classed("point-none",true)
          .style("fill","lightyellow") // linearGradient fading outward?
          .style("opacity", 0)
          .property("rotate0", rotate0)

        // BIG GUY: TRAIN POINT IN MOTION
        var point = train.append("use")
          .attr("xlink:href", "#train-icon")
          .attr("id","train-point")
          .attr("x", 0 - 1.5)
          .attr("y", 0 - 1)
          .attr("width", 3)
          .attr("height", 3)
          .style("fill","#222834")
        	.style("stroke-width", 1)
          .style("stroke","#682039")
          .style("opacity", 0) // initially
          .attr("transform", "translate(" + arcPts[0] + ") rotate(" + rotate0 + ")")

        return true;  // done

      }

    }

    function transitionIn(t = tPause) {

      d3.select("#map-init-load").transition()
        .delay(t/2)
        .duration(t/2 - 200)
        .style("opacity", 0)
        .on("end", function() {
          d3.select(this).classed("none", true)
        })

      // remove all rail station points; fade opacity out as station-stops fade in
      g.select("#rail-stations").selectAll("use")
        .transition().duration(t)
          .style("opacity", 0)
          // .on("end", function() {
          //   d3.select(this).remove();
          // })

      // simultaneous-ish; cannot append as callback to a "start" listener above b/c then EACH use element would trigger new selectAll transition ( => crash)
      g.select("#station-stops").selectAll("use")
        .transition().duration(t)
          .style("opacity", d => d.flagged ? 1 : 0.6)

    }

    function prepareUser() {
      // provide feedback via overview of selected route
      // introduce dashboard and journey log
      // prompt for readiness or provide countdown?

      // e.g. 'You have chosen to travel from {ptA} to {ptB} on {railCompany}'s {lineName} line. IRL, this route would take you about {travelTime} to complete, but we are going to move a little more quickly. Keep your eye on the dashboard and journey log for more details as the journey unfolds in {countdown?... until data loads?}'
    }

  }

  function onYourMarks(storedFlag) {

    // get zoomFollow object including simplified zoomArc (if applicable) and first/last zoom frames
    currentRoute.zoomFollow = storedFlag ? currentRoute.zoomFollow : getZoomFollow();

    // need to remain accessible for animate():
    tFull = tpm * currentRoute.totalMiles;
    trainPt = g.select("#train-point");
    headlights = g.select("#headlights");
    fullPath = g.select("#full-route");

    if (currentRoute.zoomFollow.arc.length) {
      // bind zoomArc to DOM for tracking only (not visible)
      zoomArc = g.append("path")
        .attr("id", "zoom-arc")
        .classed("one-life",true)
        .datum(projectArray(currentRoute.zoomFollow.arc))
        .attr("d", line)
        .style("fill","none")
        .style("stroke","none")
        // // toggle below for visual of zoomArc
        // .style("stroke", "rebeccapurple")
        // .style("stroke-width",1)
      zoomLength = zoomArc.node().getTotalLength();
    }

    // FIRST/LAST IDENTITY CALCULATIONS //
    if (!firstLastOptions) firstLastOptions = {
      get padBottom() {
        let dashHeight = d3.select("#dash").node().clientHeight;
        return (height < dashHeight * 2) ? getBottomPad() : dashHeight;  // map height must be at least twice that of dash to impact scale calculations
      },
      get scale() {
        let options0 = { scalePad: 0.5, padBottom: this.padBottom };
        // first iteration used to get scale @ each identity (k averaged and used to confirm not overzooming)
        let k2 = getTransform(path.bounds(currentRoute.views.data2),options0).k,
            k3 = getTransform(path.bounds(currentRoute.views.data3),options0).k,
          avgK = (k2 + k3)/2,
             k = Math.ceil(Math.min(maxInitZoom,avgK));
        return k < currentRoute.views.routeBoundsIdentity().k ? currentRoute.views.routeBoundsIdentity().k : k;
      }
    }

    if (currentRoute.zoomFollow.necessary) {  // calculate transforms and timing from firstFrame to lastFrame (at initial zoomFollow scale)

      // let options1 = { padBottom: bottomPad }, // default scalePad
      //           k2 = getTransform(path.bounds(currentRoute.views.data2),options1).k,
      //           k3 = getTransform(path.bounds(currentRoute.views.data3),options1).k,
      //         avgK = (k2 + k3)/2;

      // assuming same scalePad, same bottomPad, same k2/k3/avgK
      // zoomAlongOptions less responsive/recalculating than firstLast for performance reasons
      // zoomAlongOptions = firstLastOptions;

      // reset each time
      zoomAlongOptions = {
        get padBottom() {
          if (!this._padBottom) this.setPadBottom();
          return this._padBottom;
        },
        get scale() {
          if (!this._scale) this.setScale();
          return this._scale;
        },
        set padBottom(val) {
          this._padBottom = val;
        },
        set scale(val) {
          this._scale = val;
        },
        setPadBottom() {
          this._padBottom = firstLastOptions.padBottom;
        },
        setScale() {
          this._scale = firstLastOptions.scale;
        }
      }

      // COMBAK recalc if already calculated?
      let p0 = zoomArc.node().getPointAtLength(0),
          p1 = zoomArc.node().getPointAtLength(zoomLength);

      // then calc final first/last frames at constant scale with center centered! (note diff fn call)
      currentRoute.views.firstIdentity = storedFlag ? currentRoute.views.firstIdentity : () => getIdentity(getCenterTransform([p0.x,p0.y],firstLastOptions))

      currentRoute.views.lastIdentity = storedFlag ? currentRoute.views.lastIdentity : () => getIdentity(getCenterTransform([p1.x,p1.y],firstLastOptions))

      tPad = currentRoute.zoomFollow.tpsm * currentRoute.zoomFollow.focus;  // use tpsm to delay zoomFollow until train hits <zoomFollow.focus>; tps(implified)m because focusPt is calculated from simplified route

    } else {
      // even if zoomFollow unnecessary, adjust bottomPad to accommodate dash
      sharedIdentity = () => getIdentity(getTransform(path.bounds(currentRoute.views.data1),firstLastOptions));
      currentRoute.views.firstIdentity = storedFlag ? currentRoute.views.firstIdentity : sharedIdentity;
      currentRoute.views.lastIdentity = storedFlag ? currentRoute.views.lastIdentity : sharedIdentity;
    }

    getSet(); // initiate movement!

    function getZoomFollow() {

      let zoomFollow = {
        necessary: true, // default
        focus: viewFocusInt,
        get limit() { return this.focus * 2 },
        arc: [],
        firstThree: [],
        lastThree: [],
        fullSimp: getSimpRoute(currentRoute.views.data1),
        get simpDist() { return Math.round(turf.length(this.fullSimp, miles)) },
        get tpsm() /* t per simplified mile */ { return tpm * Math.round(currentRoute.totalMiles) / this.simpDist }
      }

      if (zoomFollow.simpDist > zoomFollow.limit) {

        // turf.along() sometimes returns same three coordinates for distance minus int * 2, distance minus int, & distance; also turf.along(fullLine,fullDist) !== last point of fullLine?; reversing instead!
        let fullSimpReversed = turf.lineString(zoomFollow.fullSimp.geometry.coordinates.slice().reverse());

        zoomFollow.firstThree = threePts(zoomFollow.fullSimp,zoomFollow.focus),

        zoomFollow.lastThree = threePts(fullSimpReversed,zoomFollow.focus).reverse();

        zoomFollow.arc = turf.lineSlice(zoomFollow.firstThree[1],zoomFollow.lastThree[1],zoomFollow.fullSimp).geometry.coordinates;

        // make sure firstLast focus coords align exactly with zoomFollow.arc start/stop (as returned by turf.lineSlice()); prevents stutter at moment of zoomAlong "takeoff"
        zoomFollow.firstThree[1] = zoomFollow.arc[0],
         zoomFollow.lastThree[1] = zoomFollow.arc[zoomFollow.arc.length-1];

        currentRoute.views.data2 = turf.lineString(zoomFollow.firstThree);
        currentRoute.views.data3 = turf.lineString(zoomFollow.lastThree);

      } else {

        // short route, first/last frames identical; no zoomAlong necessary
        zoomFollow.necessary = false;
        currentRoute.views.data2 = currentRoute.views.data1;
        currentRoute.views.data3 = currentRoute.views.data1;

      }

      return zoomFollow;

      // returns three points along route; origin | trailing corner, zoom focus, leading corner | destination
      function threePts(line,int = 100,i = 0) {

        let pt0 = turf.along(line,int*i,miles).geometry.coordinates,
            pt1 = turf.along(line,int*i+int,miles).geometry.coordinates,
            pt2 = turf.along(line,int*i+2*int,miles).geometry.coordinates;

        // return rounded
        return [pt0,pt1,pt2].map(c => c.map(d => +d.toFixed(5)));

      }

    }

  }

  function getSet(again = false) {
    // coordinate zoom to first frame, turning on headlights, dimming background, expanding dash, and ultimately initiating train and route animation

    let t = !again ? zoomDuration : zoomDuration/4;

    svg.transition().duration(t)
      .call(zoom.transform, currentRoute.views.firstIdentity)
      .on("start", () => {
        // reset panned flags (if panned on pause or reverse?)
        resetTransformAdjustments();
        // store currentBounds
        currentBounds = {
          get bounds() { return path.bounds(currentRoute.views.data2); },
          get domEdge() {
            if (!this._domEdge) this._domEdge = longerEdge(this.bounds);
            return this._domEdge;
          }
        }
        // dim background layers
        if (experience.reversing.i < 1) dimBackground(t/2)
        // expand dash automatically
        expand("dash")
        // prepare global values for animation coordination
        preanimate()
        // momentarily disable all zooming and panning
        svg.on(".zoom",null)
        disableZoomBtns()
      })
      .on("end", () => {
        // reveal train
        g.select("#train-point") // .raise()
          .transition().duration(t/2)
            .style("opacity", 1)
            .on("start", () => {
              // turn on headlights
              headlights.transition().delay(t/2).duration(t/2)
                .style("opacity",0.6)
              // schedule fade/removal of headlights upon train arrival
              dispatch.on("arrive", () => {
                headlights.transition().duration(tPause)
                          .style("opacity",0)
              });
            })
            .on("end", () => {

              if (!again) {
                d3.select("#play-pause-btn")
                  .style("opacity",0)
                  .classed("none",false)
                d3.select("#center-controls-parent")
                  .classed("mb36",true)
                d3.select("#lrg-control-text")
                  .style("opacity",0)
                  .classed("hide-visually none",false)
                  .transition().duration(750)
                    .style("opacity", 1)
                    .on("start",() => {
                      d3.select("#center-controls").select("#play-lrg")
                        .classed("none",false)
                      d3.select("#center-controls")
                        .style("opacity",0)
                        .classed("none",false)
                        .transition().duration(750)
                          .style("opacity", 1)
                    })
              }

              let promise = again ? Promise.resolve() : showLrgControls("play-lrg","awaitUserInput"); // ,750

              promise.then(go)

            })
      })

    function dimBackground(t) {

      let dimGroup = dimMore.map(d => {
        return {
          selection: Array.isArray(d) ? d3.select(d[0]).selectAll(d[1]) : d3.select(d),
          dimFactor: relativeDim
        }
      }).concat(dimLess.map(d => {
        return {
          selection: Array.isArray(d) ? d3.select(d[0]).selectAll(d[1]) : d3.select(d),
          dimFactor: relativeDim * 4
        };
      }));

      dimGroup.forEach(group => {

        // access currentOpacity or default fallback
        let currentOpacity = group.selection.style("opacity") || group.selection.attr("globalAlpha") || 1,
             targetOpacity = currentOpacity * group.dimFactor;

        if (group.selection.on("mouseenter")) {  // cities only
          group.selection
            .property("orig-orig-opacity",group.selection.property("orig-opacity") || 1)
            .property("orig-opacity",targetOpacity)
        }

        // update current opacity according to passed dimFactor
        group.selection.transition().duration(t)
          .style("opacity", targetOpacity)

      })

    }

  }

  function go() {
    // kick off global timer
    dispatch.call("depart")
  }

  function animate(elapsed) {

    if (experience.reversing.flag) {
      // timer countDOWN
      elapsed = experience.reversing.t - elapsed;
      // zoomFollow if necessary
      if (zoomArc && elapsed <= experience.reversing.t - experience.reversing.tPad && elapsed >= experience.reversing.tPad) zoomAlong(elapsed,experience.reversing.t,experience.reversing.tPad);
    } else {  // not reversing
      // zoomFollow if necessary
      if (zoomArc && elapsed >= tPad && elapsed <= tFull-tPad) zoomAlong(elapsed);
    }

    // regardless of animation direction (forward/back)
    // call another move event
    trainMove(elapsed)
    // update dash trackers
    trackerUpdate(getMM(elapsed))

    // watch for animation end
    if (!experience.reversing.flag && elapsed > tFull) {
      dispatch.call("arrive");
    } else if /* reversing && */ (elapsed < 0) {
      dispatch.call("reverseArrived");
    }

    function zoomAlong(elapsed, t1 = tFull, tP = tPad) {
      let transform = getZoomAlongTransform(elapsed,t1,tP);
      svg.call(zoom.transform, getIdentity(transform));
    }

  }

  function getZoomAlongTransform(elapsed,t1,tP) {
    // KEEP TRAIN NODE IN CENTER-ISH OF FRAME @ CURRENT ZOOM LEVEL K
    // for zoomAlong between t0,t1 to get eased t between 0,1

    // get eased point at length
    let simpT = d3.scaleLinear().domain([tP,t1-tP]),
        simpL = t => trainEase(t) * zoomLength,
            l = simpL(simpT(elapsed)),
            p = zoomArc.node().getPointAtLength(l);

    // if user has manually panned since animation start, offset zoomAlong center by translate values
    if (transformAdjustments.panned.flag) {

      // calculate new centerAdjust if new or in-progress pan event; otherwise, use most recently calculated centerAdjust value
      if (transformAdjustments.panned.updateFlag) {

        pauseTimer();

        // reset
        transformAdjustments.panned.updateFlag = false;

        // get current center pt by working backwards through centerTransform() from stored transformAdjustments.panned.transform
        let currentCenter = getCenterFromTransform(transformAdjustments.panned.transform);

        // get difference between p and currentCenter
        transformAdjustments.panned.centerAdjust = [currentCenter[0] - p.x, currentCenter[1] - p.y];

        // resume again!
        if (experience.paused && !experience.manuallyPaused) resumeTimer();

      }

      // once any pan event on record, adjust center according
      p.x += transformAdjustments.panned.centerAdjust[0],
      p.y += transformAdjustments.panned.centerAdjust[1];

    }

    let currentScale = d3.zoomTransform(svg.node()).k;
    if (currentScale !== zoomAlongOptions.scale) {  // user zoomed
      if (transformAdjustments.zoomed.respectFlag) {
        // user zoomed during active animation
        transformAdjustments.zoomed.respectFlag = false;
        zoomAlongOptions.scale = currentScale;
      } else {
        // user zoomed on pause: clamp within limits if necessary
        let minScale = currentRoute.views.routeBoundsIdentity().k,
        appliedScale = currentScale < minScale ?
            minScale
          : currentScale >= maxFollowZoom ?
            maxFollowZoom
          : currentScale;
        zoomAlongOptions.scale = appliedScale;
      }
    }

    // calculate translate necessary to center data within extent
    return getCenterTransform([p.x,p.y],zoomAlongOptions);

  }

////////////////////////////////////////////////
///// EVENT LISTENERS & VISUAL AFFORDANCES /////
////////////////////////////////////////////////

// CLICK EVENTS

  // Crucial button functionality (migrated from inline html)
  d3.select("#submit-btn").on("click",function() {
    d3.event.preventDefault();
    d3.select("#submit-btn-txt").classed("none",true);
    d3.select("#submit-btn-load").classed("none",false);
    onSubmit(this.form.getOption0.value,this.form.getOption1.value);
  })
  d3.select("#select-new").on("click", () => pauseTimer().then(selectNew))
  d3.select("#info-btn").on("click", () => toggleModal("modal-about"))
  d3.select("#dash-expand-btn").on("click", () =>  expand("dash"))
  d3.select("#dash-collapse-btn").on("click", () =>  collapse('dash','down'))
  d3.select("#modal-close-btn").on("click", () =>  toggleModal())
  d3.select("#about-up-btn").on("click", () => {
    d3.select("#about").classed("manual-close",false);
    if (!d3.select("#modal-about").classed("none")) toggleModal("modal-about")
    expand('about','up')
  })
  d3.select("#about-left-btn").on("click", () => {
    d3.select("#about").classed("manual-close",false);
    if (!d3.select("#modal-about").classed("none")) toggleModal("modal-about")
    expand('about','left')
  })
  d3.select("#about-down-btn").on("click", () => {
    d3.select("#about").classed("manual-close",true);
    collapse('about','down')
  })
  d3.select("#about-right-btn").on("click", () => {
    d3.select("#about").classed("manual-close",true);
    collapse('about','right')
  })
  d3.select("#about-expand-icon").on("click", () => {
    collapse("about")
    if (d3.select("#modal-about").classed("none")) toggleModal("modal-about")
  })

  // setup event listener on modal open
  d3.select(window).on("dblclick", function() {
    // if modal is open and click target is NOT within modal
    if (!(d3.select("#modal").classed("none")) && !d3.event.target.closest("#modal")) {
      toggleModal()  // toggle close
    }
  })

// RESIZE EVENTS
  d3.select(window).on("resize.map", adjustSize)

// FORMS & FIELDS
  d3.select("#get-options").on("focus", e => e.target.style.background = "palegoldenrod")
                           .on("blur", e => e.target.style.background = "#fafafa")

// LISTENER FUNCTIONS

  function awaitSpaceBar(e) {
    if (e.isComposing || e.keyCode !== 32) return;
    // else, set & unset additional listener
    e.preventDefault();  // spacebar shouldn't trigger any other recently pressed buttons, etc
    window.onkeyup = function(e) {
      if (e.isComposing || e.keyCode !== 32) return;
      // else
      togglePause()
      window.onkeyup = null;
    }
  }

  function pauseOnSingleClick() {
    // FILTER DBLCLICKS
    if (clickedOnce) {
      clickedOnce = false;
      clearTimeout(dblclickFilter)
      return;  // user is dblclicking; ignore this event (dblclick event listeners proceed)
    } else {   // clicking for the first time in recent history
      dblclickFilter = setTimeout(function() {
        clickedOnce = false;
        togglePause();  // if no more clicks follow, proceed with single click listeners
      }, 150);
      clickedOnce = true;
    }
  }

//////////////////////////
///// MORE FUNCTIONS /////
//////////////////////////

//// LAYOUT

  function adjustSize() {

    // pauseTimer();

    // get updated dimensions and currentTransform (before updates)
    let updated = calcSize();

    // update/apply new size values after storing previous
    let oWidth = width,
       oHeight = height;

    width = updated.width;
    height = updated.height;
    extent0 = [[0,0],[width,height]];

    svg.attr("width", width)
       .attr("height", height)

    projection.clipExtent(extent0)

    // constrain zoom behavior
    // zoom.translateExtent(extent0)

    let currentTransform = d3.zoomTransform(svg.node()),
           currentCenter = getCenterFromTransform(currentTransform, {width: oWidth, height: oHeight }),
                      k0 = currentTransform.k,
                      dk = currentBounds.domEdge === "height" ? height/ oHeight : width/oWidth,
                      k1 = k0 * dk;

    let zoomIdentity = getIdentity(getCenterTransform(currentCenter,{ scale: k1 }));

    updateScaleExtent()

    svg.call(zoom.transform, zoomIdentity)

    // if (experience.paused && !experience.manuallyPaused) resumeTimer();  // aligning pause/resume on such minute scales causes more glitches than it prevents

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
          d3.select("#about")
            .classed("disappear-down",false)
            .classed("disappear-right",true)
          // make sure section-wrapper not "relative"
          d3.select("#section-wrapper").classed("relative",false)
          // adjust dash (& associated) padding so long as #about collapsed on mxl
          svg.attr("transform","translate(13,0)")
          d3.select("#attribution").classed("mr26-mxl", true)
          d3.select("#dash-content").classed("px30-mxl",true)
          d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",true)
          d3.select("#center-controls").classed("mr-neg26",true)
          d3.select("#lrg-control-text").classed("mr-neg26",true)
          // if #about was *manually* hidden on smaller window
          if (d3.select("#about").classed("manual-close")) {
            // keep collapsed; do nothing
          } else if (d3.select("#modal-about").classed("none")) {
            // if #about not manually closed && modal-about not open
            expand("about","left");
          }
        }

      }

      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#footer").node().clientHeight;

      calculated.width = window.innerWidth - d3.select("#aside").node().clientWidth;

      // update #about-wrapper to align with full map height
      d3.select("#about-wrapper")
        .style("height", calculated.height + "px");

    } else {  // < 1200

      // if screen sizing downward from 1200+
      if (d3.select("#aside").classed("mxl")) {
        // remove mxl flag, then reset a variety of styles
        d3.select("#aside").classed("mxl", false)
        // if svg had been adjusted on @screen mxl
        svg.attr("transform",null)
        // reset #about-wrapper height
        d3.select("#about-wrapper").style("height", null);
        // if #about was manually collapsed on screen mxl
        if (d3.select("#about").classed("disappear-right")) {
          // // *keep* #about collapsed, but change class to disappear-down so transitions/placement correct if #about re-expanded from smaller window position
          d3.select("#about")
            .classed("disappear-down",true)
            .classed("disappear-right",false)
          // replace previously-removed "relative" class in #section-wrapper
          d3.select("#section-wrapper").classed("relative", true);
          // reset dash and attribution margins
          d3.select("#attribution").classed("mr26-mxl", false)
          d3.select("#dash-content").classed("px30-mxl",false)
          d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",false)
          d3.select("#center-controls").classed("mr-neg26",false)
          d3.select("#lrg-control-text").classed("mr-neg26",false)
        }
        // collapse #about (regardless of whether collapsed on mxl; too jarring to have it open upon return to smaller screen)
        d3.select("#about").classed("disappear-right", false)
        collapse("about", "down")
      }

      // entering/exiting small screen; adjust center-controls and lrg-control-text bottoms (COMBAK could integrate #attribution and any other bottom-aligned overlay buttons here)
      let dash = d3.select("#dash-plus");
      if (window.innerWidth < 640 && !dash.classed("sm")) {
        dash.classed("sm",true);
        attuneMapBottomDashTop(dash);
      } else if (window.innerWidth >= 640 && dash.classed("sm")) {
        dash.classed("sm",false);  // reset
        attuneMapBottomDashTop(dash);
      }

      // if window too short to show #about content, collapse automatically
      if (window.innerHeight < 500 && !d3.select("#about").classed("disappear-down")) collapse("about","down");

      // map height calculation includes #aside
      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#aside").node().clientHeight - d3.select("#footer").node().clientHeight;

      calculated.width = window.innerWidth; // d3.select("#about-plus").node().clientWidth;

    }

    return calculated;

  }

  function attuneMapBottomDashTop(dash = d3.select("#dash-plus")) {
    let dashHeight = dash.node().clientHeight;
    d3.select("#center-controls-parent").style("bottom",`${dashHeight}px`)
    d3.select("#lrg-control-text").style("bottom",`${dashHeight}px`)
  }

  function longerEdge(bounds) {
    bounds = standardizeBounds(bounds);
    return (bounds[1][1] - bounds[0][1] > bounds[1][0] - bounds[0][0]) ? "height" : "width"
  }

  function boundsHeight(bounds) {
    bounds = standardizeBounds(bounds);
    return bounds[1][1]-bounds[0][1];
  }

  function collapseDirection(width = window.innerWidth) {
    return (width >= 1200) ? "right" : "down";
  }

  function getBottomPad() {
    return window.innerWidth < 1200 && d3.select("#aside").node().clientHeight > 24 ? 18 : 24;
  }

//// GEOJSON + TOPOJSON HELPERS

  function getMesh(tj,key,meshFx) {
    if (meshFx) {
      return topojson.mesh(tj, tj.objects[key], meshFx);
    } else if (key) {
      return topojson.mesh(tj, tj.objects[key]);
    } else {
      return topojson.mesh(tj);
    }
  }

  function innerlines() {
    return function(a,b) { return a !== b; }
  }

  function outerlines() {
    return function(a,b) { return a === b; }
  }

  function tjToGj(group) {

    let i = 2, sourceData = new Object();

    group.forEach(datum => {
      if (datum["type"] == "Topology") {
        let oKey = Object.keys(datum.objects)[0], // object key
          sdKey = oKey; // sourceData key (to distinguish multiple TJ's with objects of same name)
        if (sourceData[sdKey]) {
          sdKey += i.toLocaleString();
          i++;
        }
        sourceData[sdKey] = { tj: datum },
        sourceData[sdKey].gj = topojson.feature(sourceData[sdKey].tj, sourceData[sdKey].tj.objects[oKey]);
      } else { // if not topojson, assume already geojson
        sourceData[datum.name] = { gj: datum };
      }
    });

    return sourceData;

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

//// TURF-LIKE/GEO ON-THE-FLY

  function getRotate(p0,p1) {  // returns rounded value in degrees of bearing between two projected pts

    if (p0.x) { // assume two svg pts and adjust to coords
      p0 = [p0.x,p0.y];
      p1 = [p1.x,p1.y];
    }

    let slope = (-p1[1]-(-p0[1]))/(p1[0]-p0[0]), // y1:y0 relationships account for reflected Y values
      quadrant;

    if (Math.sign(slope) === -1) {
      quadrant = (p1[1] < p0[1]) ? "NW" : "SE";
    } else {
      quadrant = (p1[1] < p0[1]) ? "NE" : "SW";
    }

    let angle = Math.atan(slope),  // inverse-tanget = angle in radians
      degrees = +turf.radiansToDegrees(angle).toFixed(); // translate to degrees for SVG rotate

    // still not totally clear why this makes the difference, but it seems to. having to do with projection.rotate()?
    return (["NE","SE"].includes(quadrant)) ? 90 - degrees : -90 - degrees;

  }

  function getSector(radians,radius,span = arcSpan,scale = projection.scale(),r0 = 0) {
    let r1 = radius * scale / 100;
    return d3.arc()
      .innerRadius(r0)
      .outerRadius(r1)
      .cornerRadius(r1/10)
      .startAngle(radians - span/2)
      .endAngle(radians + span/2);
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

  function getSteps(gj,distance,steps = distance) {  // controlled simplification of route; returns one coord for every (distance/steps) miles
    let chunkLength = Math.max(1,Math.round(distance/steps)),  // must be at least 1 to avoid errors (happens when getting arcPts on very short routes) but Math.ceil too frequently results in double-length milemarker segments
      lineChunks = turf.lineChunk(gj,chunkLength,miles).features,
      firstCoords = lineChunks.map(d=>d.geometry.coordinates[0]),
      lastChunk = lineChunks[lineChunks.length-1].geometry.coordinates,
      lastCoord = lastChunk[lastChunk.length-1];
    return firstCoords.concat([lastCoord]);
  }

  function projectArray(unprojCoordArr) {
    return unprojCoordArr.map(d => (Array.isArray(d[0])) ? projectArray(d) : projection(d));
  }

  function truncateCoords(coords,precision = 5) {
    return coords.map(d => turf.truncate(turf.point(d),{precision:precision,mutate:true}).geometry.coordinates);
  }

  function combineBounds(boundsArray) {
    let bounds0 = boundsArray.shift();
    let b00 = bounds0[0][0], b01 = bounds0[0][1],
        b10 = bounds0[1][0], b11 = bounds0[1][1];
    boundsArray.forEach(bounds => {  // iterate through remaining
      b00 = Math.min(b00,bounds[0][0])
      b01 = Math.min(b01,bounds[0][1])
      b10 = Math.max(b10,bounds[1][0])
      b11 = Math.max(b11,bounds[1][1])
    });
    return [[b00,b01],[b10,b11]];
  }

//// ZOOM BEHAVIOR

  function zoomed() {

    var transform = d3.zoomTransform(this);

    let tk = transform.k,
        tx = transform.x,
        ty = transform.y;

    // minZ = 1 / tk / tk;

    g.attr("transform", "translate(" + tx + "," + ty + ") scale(" + tk + ")");

    g.style("stroke-width", 1 / (tk * tk * tk) + "px");

    // projection.clipExtent(extent0)

    if (d3.event.sourceEvent && experience.initiated && d3.event.sourceEvent.type === "mousemove") {

      if (experience.manuallyPaused) {
        // if user pans while animation was manually paused, flag to svg.transition().call(d3.zoomTransform, nextZoomFrame) before resuming animation
        transitionResume = true;
      } else if (experience.animating) {
        // if user pans after animation has started, respect as readjustment of zoomAlong view (since d3.event.sourceEvent specified for wheel and mouse events only, and since wheel.zoom disabled while !experience.paused, user must be panning).
        // if (!experience.paused) pauseTimer();
        transformAdjustments.panned.flag = true;
        transformAdjustments.panned.updateFlag = true;
        transformAdjustments.panned.transform = transform;
        // resumeTimer();
      } // else { /* panning after arrival */ }

    }

  }

  function zoomClick() {

    // pauseTimer();

    let currentScale = d3.zoomTransform(svg.node()).k;

    if ((this.id === "zoom-in" && currentScale === scaleExtent[1]) || (this.id === "zoom-out" && currentScale === scaleExtent[0])) {  // if currentScale already clamped at min/max, offer visual feedback (little shake) that zoom limit reached
      d3.select(this).classed("animation-shake",true)
      d3.timeout(() => {
        d3.select(this).classed("animation-shake",false);
      }, 400);
    } else {  // otherwise, store/apply new scale values
      if (experience.animating && !experience.manuallyPaused) {
        // flag for purposes of continuity within zoomAlongTransform and other on-the-fly transform calculations
        transformAdjustments.zoomed.respectFlag = true;
        this.id === "zoom-in" ? svg.call(zoom.scaleBy, zoomInFactor) : svg.call(zoom.scaleBy, zoomOutFactor)
      } else {
        this.id === "zoom-in" ?
          svg.transition().duration(500)
             .call(zoom.scaleBy, zoomInFactor)
        : svg.transition().duration(500)
             .call(zoom.scaleBy, zoomOutFactor)
      }
    }

    // if (experience.paused && !experience.manuallyPaused) resumeTimer();

  }

  function enableZoomBtns() {
    d3.select("button#zoom-in")
      .property("disabled",false)
    d3.select("button#zoom-out")
      .property("disabled",false)
  }

  function disableZoomBtns() {
    // when zoom 100% disabled, zoomBtns also disabled
    d3.select("button#zoom-in")
      .property("disabled",true)
    d3.select("button#zoom-out")
      .property("disabled",true)
  }

  function getCenterFromTransform(transform,options) {
    // get current center by working backwards through centerTransform() from current transform

    let opts = {...defaultOptions.centerTransform, ...options};

    // account for any padding
    opts.width += (opts.padLeft + opts.padRight);
    opts.height += (opts.padTop + opts.padBottom);

    let x = (transform.x - opts.width/2) / -transform.k,
        y = (transform.y - opts.height/2) / -transform.k;

    return [x,y];

  }

  function getTransform(bounds, options) {

    let opts = {...defaultOptions.boundsTransform, ...options};

    bounds = standardizeBounds(bounds);

    let dx = bounds[1][0] - bounds[0][0],  // domain x (input)
        dy = bounds[1][1] - bounds[0][1];  // domain y (input)

    // account for any padding
    opts.width -= (opts.padLeft + opts.padRight);
    opts.height -= (opts.padTop + opts.padBottom);

    let k = opts.scale || +((1 - opts.scalePad) * Math.min(opts.width/dx, opts.height/dy)).toFixed(4),
        x = bounds[1][0] + bounds[0][0],  // xMax (bounds[1][0]) + xOffset (bounds[0][0])
        y = bounds[1][1] + bounds[0][1];  // yMax (bounds[1][1]) + yOffset (bounds[0][1])

    // calculate translate necessary to center data within extent
    // let tx = (opts.width + opts.padLeft - opts.padRight - k * x) / 2,
    //     ty = (opts.height + opts.padTop - opts.padBottom - k * y) / 2;

    let tx = (opts.width - k * x) / 2, //  + opts.padLeft - opts.padRight,
        ty = (opts.height - k * y) / 2 // + opts.padTop - opts.padBottom;

    let transform = { k: k, x: tx, y: ty };

    return transform;

  }

  function getIdentity(atTransform,k) {
    // returns d3.zoomIdentity while providing option for stable k
    return d3.zoomIdentity
      .translate(atTransform.x || atTransform[0], atTransform.y || atTransform[1])
      .scale(k || atTransform.k)
  }

  function getCenterTransform([x,y],options) {
    // returns transform centering (preprojected) point at predetermined scale
    let opts = {...defaultOptions.centerTransform, ...options};

    // account for any padding
    opts.width += (opts.padLeft + opts.padRight);
    opts.height += (opts.padTop + opts.padBottom);

    let k = opts.scale,
       tx = -k * x + opts.width/2 + opts.padLeft - opts.padRight,
       ty = -k * y + opts.height/2 + opts.padTop - opts.padBottom

    return {x: tx, y: ty, k: k};

  }

  async function resetZoom(state0 = false) {

    if (!state0) {
      if (experience.initiated && (!experience.animating || experience.manuallyPaused)) {
        // animation initiated, but paused or not yet begun
        transitionResume = true;
      } else if (experience.animating && !experience.manuallyPaused) {
        pauseTimer()
        transformAdjustments.zoomed.respectFlag = true;
      }
    }

    currentBounds = bounds0;

    let zoom0 = getIdentity(getTransform(currentBounds.bounds,{ padBottom: getBottomPad() }));

    updateScaleExtent(zoom0.k)

    let promise = new Promise((resolve, reject) => {
      svg.transition().duration(750)
         .call(zoom.transform, zoom0)
         .on("end", () => {
           if (!state0 && experience.paused && !experience.manuallyPaused) resumeTimer();
           resolve()
         })
    })

    return await promise; // for any waiting callers

  }

  function updateScaleExtent(scale0 = getTransform(path.bounds(data0),{ padBottom: getBottomPad() }).k) {
    scaleExtent = [scale0 * 0.8, scale0 * scaleExtentFactor];
    zoom.scaleExtent(scaleExtent)
  }

  function nozoom() {
    d3.event.preventDefault();
  }

//// DRAG BEHAVIOR

  function childDrag() {

    // Determine resizer position relative to resizable parent
    let y = this.parentNode.getBoundingClientRect().height - d3.event.y

    // Ensure calculated height within bounds of grandparent svg (plus padding) and, optionally, greater than minimum height
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

    let opts = {...defaultOptions.quadtree,...options};

    // get projected bounding box of passed geoJSON
    let pathBox = path.bounds(opts.bounding),
             x0 = pathBox[0][0], // xmin
             y0 = pathBox[0][1], // ymin
             x1 = pathBox[1][0], // xmax
             y1 = pathBox[1][1]; // ymax

    // initiate quadtree with specified x and y functions
    let quadtree = d3.quadtree(data,opts.projectX,opts.projectY)
      .extent([[x0, y0], [x1, y1]])

    return quadtree;
  }

  function bindQuadtreeData(quadtree,triggerPtFlag = false) {

    // data should all be points, whether representative of larger polygons/lines or otherwise

    let quadtreeData = g.append("g")
      .attr("id", "quadtree-data")
      .classed("one-life", true)

    quadtreeData.selectAll(".quad-datum")
      .data(quadtree.data())
      .enter().append("circle")
        .attr("class", d => `quad-datum ${d.properties.id}`)
        .attr("cx", d => quadtree._x(d))
        .attr("cy", d => quadtree._y(d))
        // .attr("r", 0.1) // toggle for visual

    if (triggerPtFlag) {
      quadtreeData.selectAll(".quad-datum").nodes().forEach(d => d3.select(d).classed("trigger-pt",true));
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

          d.selected = (d0 >= x0) && (d0 < x3) && (d1 >= y0) && (d1 < y3);

          if (d.selected) {

            // // OMITTED for purposes of reset():
            // // immediately remove triggerPt and all others associated with same feature ID from remaining search pool to avoid wasting energy on retriggers
            // let toRemove = quadtree.data().filter(q => {
            //   return q.properties.id === d.properties.id;
            // })
            // quadtree.removeAll(toRemove)

            // for flagged, en route trigger-pts only
            if ((g.select("#quadtree-data").select(`.quad-datum.${d.properties.id}`).node()) && (g.select("#quadtree-data").select(`.quad-datum.${d.properties.id}`).classed("trigger-pt"))) {

              if (experience.reversing.flag && uniqueEncounters.has(d.properties.id)) {
                dispatch.call("unencounter", d)
              } else if (!experience.reversing.flag && !uniqueEncounters.has(d.properties.id)) {
                uniqueEncounters.add(d.properties.id)
                dispatch.call("encounter", d)
              }

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

  function preanimate() {

    fullLength = fullPath.node().getTotalLength();

    zoomAlongState.pt0 = fullPath.node().getPointAtLength(0);

    eased = (t, t1 = tFull) => trainEase(t/t1);
    routeDashInterpolator = d3.interpolateString("0," + fullLength, fullLength + "," + fullLength);

    // setup searchExtent for headlights intersecting quadtree reps
    let sectorBBox = headlights.node().getBBox(),
          arcWidth = sectorBBox.width,
         arcHeight = sectorBBox.height, // ADJUSTABLE FOR NON-VISIBLE EXTENSION OF SEARCH EXTENT
           rotate0 = headlights.property("rotate0") || 0;

    // calculate initial search extent for quadtree
    let sectorExtent = [[-arcWidth/2,-arcHeight],[arcWidth/2,0]],
    translatedExtent = translateExtent(sectorExtent,zoomAlongState.pt0.x,zoomAlongState.pt0.y);

    // searchExtent is sector (headlight) extent translatedThenRotated
    let searchExtent = rotateExtent(translatedExtent,rotate0,[zoomAlongState.pt0.x,zoomAlongState.pt0.y]);

    // save newly determined values as previous values
    zoomAlongState.prevTranslate = [zoomAlongState.pt0.x,zoomAlongState.pt0.y];
       zoomAlongState.prevExtent = searchExtent;
       zoomAlongState.prevRotate = rotate0;

  }

  function trainMove(t) { // called by animate() following dispatch

    if (t < 0 || t > tFull) return;

    // calculate new position
    let trainTransform = getTrainTransformAt(t),
      currentTranslate = [trainTransform.x, trainTransform.y],
         currentRotate = trainTransform.r;

    if (experience.reversing.flag && t !== experience.reversing.t) {  // keep train/headlights rotated toward destination when reversing in progress
      currentRotate = (currentRotate < 180) ? currentRotate + 180 : currentRotate - 180;
    }

    let transformString = "translate(" + currentTranslate[0] + "," + currentTranslate[1] + ") rotate(" + currentRotate + ")";

    // train moves along route
    trainPt.attr("transform", transformString);

    // headlights simulate search for triggerPts
    headlights.attr("transform",transformString);

    // traversed path illuminated with color as train progresses
    fullPath.style("opacity", 1)
    fullPath.style("stroke-dasharray",routeDashInterpolator(eased(t)))

    // get adjusted quadtreeRep searchExtent on each trainMove
    let dx = currentTranslate[0] - zoomAlongState.prevTranslate[0],
        dy = currentTranslate[1] - zoomAlongState.prevTranslate[1];

    let translatedExtent = translateExtent(zoomAlongState.prevExtent,dx,dy),
             rotateDelta = currentRotate - zoomAlongState.prevRotate;

    let searchExtent = rotateExtent(translatedExtent,rotateDelta,currentTranslate)

    // save newly determined values as previous values
    zoomAlongState.prevTranslate = currentTranslate;
       zoomAlongState.prevExtent = searchExtent;
       zoomAlongState.prevRotate = currentRotate;

    // initiate quadtree search
    searchQuadtree(currentRoute.quadtree, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1]);

  }

  function getTrainTransformAt(t) { // INCL ROTATE

    let l1 = eased(t) * fullLength;

    let pt1 = fullPath.node().getPointAtLength(l1)

    let rotate = (zoomAlongState.pt0.x !== pt1.x) ? getRotate(zoomAlongState.pt0,pt1) : zoomAlongState.prevRotate; // || rotate0?

    // shift pt values pt0 >> pt1
    zoomAlongState.pt0 = pt1;

    return { x: pt1.x, y: pt1.y, r: rotate }; // NOTE R, NOT K

  }

  function departed(reverseFlag = false) {

    // regardless
    experience.animating = true;
    d3.selectAll(".toggle-pointer").classed("pointer",false)
    d3.select("#play-pause-icon")
      .selectAll(".icon-opt").classed("none",true)

    if (reverseFlag) {

      // track state
      experience.reversing.flag = true;
      experience.reversing.t = Math.ceil(tFull / reverseCut);
      experience.reversing.tPad = zoomArc ? tPad / reverseCut : null;

      for (var geomType in geomAssoc) {
        geomAssoc[geomType].reverseT = Math.floor(experience.reversing.t /  geomAssoc[geomType].set.size);
      }

      // show reversing icon
      d3.select("#play-pause-btn")
        .property("disabled",true)
        .on("click.play",null)
        .on("click.pause",null)
        .on("click.replay",null)
      d3.select("#play-pause-icon")
        .select("#reversing-icon").classed("none",false)

    } else {

      // show pause btn
      d3.select("#play-pause-btn")
        .property("disabled", false)
        .on("click.pause", manualPause)
        .on("click.play", null)
        .on("click.replay", null)
      d3.select("#play-pause-icon")
        .select("#pause-icon").classed("none",false)

    }

    // activate listeners
    window.onkeydown = awaitSpaceBar;
    svg.on("click", pauseOnSingleClick)

    // reset zoom & zoomClick to reenable manual panning and button zooming before again disabling all free wheel-/mouse-related zooming
    svg.call(zoom)
    enableZoomBtns()
    svg.on("wheel.zoom",null)
       .on("scroll.zoom",null)

    // confirm this where we at, just in case user panned away before initiating animation (sneaky! zoom disabled by this point; resetting and panning not)
    let targetIdentity = reverseFlag ? currentRoute.views.lastIdentity : currentRoute.views.firstIdentity;
    if (JSON.stringify(d3.zoomTransform(svg.node())) !== JSON.stringify(targetIdentity())) {  // conditional assumes order of k, x, and y is same for both
      svg.transition().duration(750)
        .call(zoom.transform,targetIdentity)
        .on("end", proceed)
    } else {
      proceed()
    }

    function proceed() {
      // start global timer
      timer = d3.timer(animate,300);
      if (!reverseFlag) console.log("train departing @ " + Math.floor(d3.now()))
    }

  }

  function arrived() {

    // stop animation
    timer.stop()

    svg.on("click", null)
    window.onkeydown = null;

    // reset several state variables
    resetExperienceState(true,true); // initException == true, counterException == true
    resetTransformAdjustments();

    // inform d3 zoom behavior of final transform value (transition in case user adjusted zoom en route)
    svg.transition().duration(zoomDuration)
      .call(zoom.transform, currentRoute.views.lastIdentity)
      .on("start", () => {
        currentBounds = {
          get bounds() { return path.bounds(currentRoute.views.data3); },
          get domEdge() {
            if (!this._domEdge) this._domEdge = longerEdge(this.bounds);
            return this._domEdge;
          }
        }
      })
      .on("end", () => {
        // re-allow free zooming
        svg.call(zoom)
        // invite user to click on outputted feature names to zoom to bounds
        d3.selectAll(".toggle-pointer").classed("pointer",true)
      })

    // avoid slight tracker disconnects at end
    let geoMM = currentRoute.geoMM; // shorthand
    let finalCoords = geoMM[geoMM.length - 1];
    getElevation(finalCoords).then(elevation => {
      d3.select("#elevation-val").text(elevation)
    });
    let finalAzimuth = getAzimuth(geoMM.length - 1);
    d3.select("#compass-val").text(finalAzimuth)
    d3.select("#current-quadrant").text(getQuadrant(finalAzimuth))
    // miles and clock too
    d3.select("#odometer-val").text(currentRoute.totalMiles)
    d3.select("#clock-val").text(currentRoute.totalTime)

    // update play-pause btn and listeners
    d3.select("#play-pause-btn")
      .on("click.replay",replayAnimation)
      .on("click.play",null)
      .on("click.pause",null)
    d3.select("#play-pause-icon")
      .selectAll(".icon-opt").classed("none",true)
    d3.select("#play-pause-icon")
      .select("#replay-icon").classed("none",false)

    console.log("train arrived @ " + Math.floor(d3.now()))
    console.log("unique encounters",uniqueEncounters.size)

  }

  function reverseArrived() {

    // stop animation
    timer.stop();
    experience.reversing.i++;

    resetExperienceState(true,true); // initException == true, counterException == true

    // avoid slight tracker disconnects at end
    d3.select("#odometer-val").text("0")
    d3.select("#clock-val").text("0")

    // reenable and update play-pause btn
    d3.select("#play-pause-btn")
      .on("click.replay",null)
      .on("click.play",getSet)
      .on("click.pause",null)
      .property("disabled",false)
    d3.select("#play-pause-icon")
      .selectAll(".icon-opt").classed("none",true)
    d3.select("#play-pause-icon")
      .select("#play-icon").classed("none",false)

    // pause, then automatically restart animation from beginning
    d3.timeout(() => {
      getSet(true)  // again = true; ensure quadtree encounters only triggering reveal, not re-adding to dom
    }, 300);

  }

  function replayAnimation() {
    // reset panned flags (if panned on pause or reverse?)
    resetTransformAdjustments();
    // momentarily disable all zooming and panning
    svg.on(".zoom",null)
    disableZoomBtns()
    // prereverse() to adjust select values stored during preanimate();
    eased = (t, t1 = experience.reversing.t) => trainEase(t/t1);
    // pad reverse searchExtent (but not too much) to ensure everything erased
    zoomAlongState.prevExtent = [[zoomAlongState.prevExtent[0][0]-2.5,zoomAlongState.prevExtent[0][1]-2.5],[zoomAlongState.prevExtent[1][0]+2.5,zoomAlongState.prevExtent[1][1]+2.5]];
    // finally
    dispatch.call("reverse")
  }

//// TRANSITIONS AND TWEENS

  function tweenDash() {
    var l = this.getTotalLength(),
        i = d3.interpolateString("0," + l, l + "," + l);
    return function(t) { return i(t); };
  }

  function drawDashed() {
    var l = this.getTotalLength(),
        i = d3.interpolateString(-l,"0");
    return function(t) { return i(t); };
  }

  function clearDashed() {
    var l = this.getTotalLength(),
        i = d3.interpolateString("0", -l);
    return function(t) { return i(t); };
  }

  function clearSolid() {
    var l = this.getTotalLength(),
        i = d3.interpolateString(l + ",0", "0," + l);
    return function(t) { return i(t); };
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

  function translateExtent(extent,dx,dy) {
    return extent.map(d => { return [d[0]+dx, d[1]+dy] });
  }

  function rotateExtent(extent,degrees,currentTranslate) {

    let angle = turf.degreesToRadians(degrees),
        width = extent[1][0]-extent[0][0],
       height = Math.abs(extent[1][1]-extent[0][1]),
        midPt = [extent[0][0]+width/2,extent[0][1]+height/2];

    let point = midPt,
        pivot = currentTranslate;
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

  function encountered() {

    let id = this.properties.id,
        gj = currentRoute.readyAndWaiting[id], // get associated feature
      baseT;

    if (!gj) return;

    // get and save logGroup/category and protected area tags
    let geomType = id.slice(0,2),
        logGroup = gj.properties.logGroup || getGroup(gj),
          subTag = gj.properties.subTag || getTag(gj,logGroup);

    gj.properties.logGroup = logGroup,
      gj.properties.subTag = subTag;

    if (!logBackgrounds[geomType]) updateLogBackground(geomType,gj);  // called here to draw background-image from actually encountered line and polygon geometries
    else if (!logBackgrounds[geomType].complete || !logBackgrounds[geomType].imgSrc) d3.timeout
    (srcCheck, 3000); // wait a few seconds, then try again

    if (id.startsWith('pt')) {

      // baseT = gj.properties.SNAP_DISTANCE;
      revealPt(gj) // ,baseT)

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
             baseT = Math.ceil((lengthA + lengthB) / 2);

        gjA.properties = {...gj.properties}
        gjB.properties = {...gj.properties,...{oid: origId, id: origId + "-2"}}

        if (gjA.geometry.coordinates.length) revealLine(gjA,baseT,"paired-flag")
        if (gjB.geometry.coordinates.length) revealLine(gjB,baseT,"paired-flag second-half")

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

      // SWING TWO: after specific descriptions, before match PA group
      let descrMatch = '';
      if (gj.properties.DESCRIPTION) {
        descrMatch = gj.properties.DESCRIPTION.toUpperCase(),
        descrIndex = catKeys.findIndex(startsWith,descrMatch);
        if (descrIndex >= 0) {
          return enrichCats[catKeys[descrIndex]];
        }
      }

      // FINAL SWING: must be Protected Area; get tier
      if (enrichCats["PA1"].keywords1.some(match,descrMatch) && enrichCats["PA1"].keywords2.some(match,descrMatch)) {
        return enrichCats["PA1"];
      } else if (enrichCats["PA2"].keywords.some(match,descrMatch)) {
        return enrichCats["PA2"];
      } else {
        return enrichCats["PA3"];
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

        let paDescr = gj.properties.DESCRIPTION.toUpperCase(),
           tagIndex = (gj.properties.flag === "habitat") ? 1 : tagWords.findIndex(someMatch,paDescr); // 1 === hardcoded index of "hab" info under paTags

        if (tagIndex < 0) {
          // try with name
          let name = gj.properties.NAME.toUpperCase();
          tagIndex = tagWords.findIndex(someMatch,name);
          if (tagIndex < 0) /*STILL*/ console.log("none match?",gj.properties)
        }

        let tagId = paTags[paKeys[tagIndex]].divId;

        return { ...paTags[paKeys[tagIndex]], ...{ divId: logGroup.divId + "-" + tagId }};

      }

    }

    function srcCheck() {
      // if still nothing saved, go fix it
      if (!logBackgrounds[geomType].imgSrc) updateLogBackground(geomType,gj);
    }

    async function updateLogBackground(geomType,gj) {

      if (geomType === "ln" && gj.properties.CATEGORY !== "River") return; // only proceed with open lines (river group), for clarity of symbol

      if (gj) {

        let localBounds = reflectedPath.bounds(gj.geometry);
        let h = localBounds[1][1] - localBounds[0][1],
            w = localBounds[1][0] - localBounds[0][0];
        if (w > h) return; // only proceed if this particular line/polygon is taller than it is wide

      }

      // if still here, store final to flag against recalling this fn
      logBackgrounds[geomType] = { complete: true };

      let localDiv = geomAssoc[geomType].logDiv,
       localCanvas = geomAssoc[geomType].logCanvas,
          localCtx = localCanvas.node().getContext("2d");

      let width = localDiv.node().clientWidth,
         height = 240; // static ok given repeat-y; was localDiv.node().clientHeight * 2;

      localCanvas
        .attr("width", width)
        .attr("height", height)

      // update context (canvas itself unrendered)
      localCtx.strokeStlye = "gainsboro";
      localCtx.globalAlpha = 0.2;

      let allExecuted = new Promise(async (resolve, reject) => {
        let executed = await execPathCommands(localCtx);
        resolve({executed, status: 'ok'});
      });

      // confirm finished with execPathCommands() incl. drawing flipped img before continuing
      let canvasWithMirror = await allExecuted;

      // convert canvas iteration to img src
      let localImgSrc = canvasWithMirror.executed.toDataURL();

      // update background-image of localDiv
      localDiv
        .style("overflow-y","visible")
        .style("background-repeat","repeat-y") // x | y
        .style("background-image",`url(${localImgSrc})`)

      // done; store final img
      logBackgrounds[geomType].imgSrc = localImgSrc;

      async function execPathCommands(ctx) {

        switch (geomType) {

          case "pt":
            let numPts = 8;
            let ptSizes = new Array(numPts).fill(numPts).map(d => random(12,2));
            ctx.fillStyle = `rgba(${chroma("dimgray").alpha(0.4).rgba().join(",")})`;
            ptSizes.forEach(r => {
              let coords = [random(width,r),random(height/2)];  // random pt within this canvas node
              ctx.lineWidth = r * 0.1;
              ctx.beginPath();
              ctx.arc(coords[0], coords[1], r, 0, tau)
              ctx.fill();
              ctx.stroke();
            })

            break;

          case "ln":
            reflectedY.fitExtent([[0,0],[width,height/2]],gj.geometry)
            reflectedPath.context(ctx)
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.15;
            ctx.beginPath();
            reflectedPath(gj.geometry)
            ctx.stroke();

            break;

          case "py":
            reflectedY.fitExtent([[0,0],[width,height/2]],gj.geometry)
            reflectedPath.context(ctx)
            ctx.fillStyle = `rgba(${chroma("dimgray").alpha(0.2).rgba().join(",")})`;
            ctx.beginPath();
            reflectedPath(gj.geometry)
            ctx.fill();
            ctx.stroke();

            break;
        }

        let canvasWithMirror = await drawFlipped();
        return canvasWithMirror;

        async function drawFlipped() {
          // GET FLIPPED IMG OF CURRENT CANVAS
          let img = new Image;
          img.src = localCanvas.node().toDataURL();
          let promise = new Promise((resolve, reject) => {
            img.onload = () => {
              // ADD FLIPPED IMG TO ORIGINAL CTX WITHOUT CLEARING CANVAS
              ctx.scale(1,-1)
              ctx.globalAlpha = 1;
              ctx.drawImage(img, 0, -height);
              resolve({localCanvas, status: 'ok'});
            }
          });
          let canvasWithMirror = await promise;
          return canvasWithMirror.localCanvas.node();
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

  function revealPt(gj) { // ,baseT) {

    let t = minT * 4; // Math.max(minT,baseT * tpm);

    encounteredPts.add(gj)
    let sortedPts = [...encounteredPts].sort((a,b) => {
      return !a.properties.orig_area ? 1 : !b.properties.orig_area ? -1 : b.properties.orig_area - a.properties.orig_area;
    })

    let ptOpacity = 0.8,
      ptStrokeOpacity = 0.6;

    // update pts as group to allow for additional transitions on updating pts
    d3.select("#enrich-pts").selectAll(".enrich-pt")
      .data(sortedPts, d => d.properties.id)
      .order()
      .join(
        enter => enter.append("circle")
          .attr("id", d => d.properties.id)
          .attr("r",0.05)
          .attr("cx", d => projection(d.geometry.coordinates)[0])	          .attr("cy", d => projection(d.geometry.coordinates)[1])
          .attr("class", d => `enrich-pt ${d.properties.logGroup.divId}`)
          .classed("shadow-darken25",true)
          .property("name", formatName)
          .property("category", d => d.properties.CATEGORY)
          .property("description", d => d.properties.DESCRIPTION)
          .property("more-info", d => d.properties.MORE_INFO)
          .property("log-group", d => d.properties.logGroup)
          .property("sub-tag", d => d.properties.subTag)
          .property("orig-opacity", ptOpacity)
          .property("orig-stroke-opacity", ptStrokeOpacity)
          .property("orig-stroke-width", "0.025px")
          .style("stroke-width", "0.025px")
          .style("opacity", 0)
          .style("stroke-opacity", 0)
          .call(async enter => {
            let fill = await getFill(enter.datum());
            if (fill.key) { // typeof fill === "Object"
              // let stroke = chroma(patterns[fill.key].primaryHex).brighten().hex();
              let stroke = chroma(patterns[fill.key].primaryHex).desaturate().darken().hex();
              enter.attr("patternKey",fill.key)
              enter.classed("patterned",true)
              enter.style("fill", patterns[fill.key].url)
                   .style("stroke", stroke)
                   .property("orig-stroke", stroke)
            } /* else {
              console.log(enter.datum().properties.logGroup.divId)
              let stroke = chroma(fill).brighten().hex();
              enter.style("fill", fill)
                   .style("stroke", stroke)
                   .property("orig-stroke", stroke)
            } */
            if (enter.property("sub-tag")) enter.classed(enter.property("sub-tag").divId,true);
            enter.transition().duration(t)
              .attr("r", d => d.properties.orig_area ? radiusScale(d.properties.orig_area) : 0.075) // size of circle is a factor of original area of polygon the circle is representing, or 0.075 minimum
              .style("opacity", 1)  // COMBAK: aim for initial glow effect
              .style("stroke-opacity", 1)
              .on("start", output(enter))
              .on("end", function() {
                // tagging this on here ensures all pts reach final style target, even those so close to end of path they don't get a chance to update
                d3.active(this).transition().duration(t)
                  .style("opacity", ptOpacity)  // make more subtle
                  .style("stroke-opacity", ptStrokeOpacity)
                  .on("end", () =>
                    // was d3.active(this)
                    enter.on("mouseenter", onMouseenter)
                         .on("mouseout", onMouseout)
                  )
              })
          }),
        update => update,
        exit => exit.call(exit => {
          exit.transition().duration(t)
            .attr("r", 0)
            .on("end", () => {
              exit.remove()
            })
        })
      )

    function rTween(d) {
      let a = +d3.select(this).attr("r"),
          b = d.properties.orig_area * 0.0000001 || 1; // final radius (/rank) is a factor of planar (why did i do it this way?) area of polygon the circle is representing, or 1 minimum}
      let interpolator = d3.interpolate(a,b);
      return function(t) {
        return interpolator(t);
      }
    }

  }

  function revealLine(gj,baseT,pairedFlag = '') {

    let t = Math.max(minT,baseT * tpm),
      props = gj.properties,
      lineOpacity = 0.8,
      strokeColor = props.CATEGORY.startsWith("River") ? riverBlue : colorAssignments.watersheds[props.OCEAN_ID].base,
      strokeWidth = getStrokeWidth(gj);

    encounteredLines.add(gj)

    // have to add these one at a time (rather than as a group join) to avoid recalculated dashArrays getting mixed up within group (esp as queue of entering elements get longer); ok because order of lines not essential for proper viewing
    let newLine = d3.select("#enrich-lines").append("path")
                    .datum(gj)
                    .attr("d", path)
                    .attr("id", d => d.properties.id)
                    .attr("class", d => `enrich-line ${d.properties.logGroup.divId} ${pairedFlag}`)
                    .property("name", formatName)
                    .property("category", d => d.properties.CATEGORY)
                    .property("level", d => d.properties.LEVEL)
                    .property("log-group", d => d.properties.logGroup)
                    .property("sub-tag", d => d.properties.subTag)
                    .property("orig-opacity", lineOpacity)
                    .property("orig-stroke-opacity", lineOpacity)
                    .property("orig-stroke", strokeColor)
                    .property("orig-stroke-width", strokeWidth)
                    .style("fill", "none") // default
                    .style("stroke", strokeColor)
                    .style("stroke-width", strokeWidth)
                    .style("stroke-dasharray", "none")
                    .style("stroke-linecap", "round")
                    .style("opacity", lineOpacity)
                    .on("mouseenter", onMouseenter)
                    .on("mouseout", onMouseout)

    if (newLine.property("sub-tag")) newLine.classed(newLine.property("sub-tag").divId,true);

    if (newLine.property("category") === "Watershed") {

      // reverse bound path to prepare for dashed line interpolation
      let initialPath = newLine.attr("d")

      newLine.attr("d",reverseSVGPath(initialPath))

      let initArray = "0.1 0.2 0.4 0.2",
        length = newLine.node().getTotalLength(),
        dashStr = getDashStr(length, initArray);

      newLine.style("stroke-dasharray", dashStr)
             .style("stroke-dashoffset", -length)

      newLine.transition().duration(t).ease(d3.easeCubicOut)
        .styleTween("stroke-dashoffset",drawDashed)

    } else {

      newLine.transition().duration(t).ease(d3.easeCubicOut)
        .styleTween("stroke-dasharray",tweenDash)

    }

    if (!gj.properties.id.includes("-")) output(newLine,pairedFlag)  // don't output partial geometries

  }

  function revealPolygon(gj,spine,baseT) {

    // COMBAK work with *spine*

    let t = Math.max(minT * 2,baseT * tpm);

    // update as group join to keep elements properly layered (bigger on bottom)
    encounteredPolys.add(gj)

    const byLevel = function(a,b) {
      return unromanize(a.properties.LEVEL) - unromanize(b.properties.LEVEL);
    }

    let ecoregions = [...encounteredPolys].filter(d => d.properties.LEVEL),
         remaining = [...encounteredPolys].filter(d => !d.properties.LEVEL);

    let sortedPolygons = ecoregions.sort(byLevel).concat(remaining);

    let polyOpacity = d => (d.properties.LEVEL) ? unromanize(d.properties.LEVEL) * 0.15 : 0.6,
      polyStrokeOpacity = 0;

    d3.select("#enrich-polygons").selectAll(".enrich-polygon")
      .data(sortedPolygons, d => d.properties.id)
      .order()  // is this an appropriate place to call this method?
      .join(
        enter => enter.append("path")
          .attr("d", path)
          .attr("id", d => d.properties.id)
          .attr("class", d => `enrich-polygon ${d.properties.logGroup.divId}`)
          .property("name", formatName)
          .property("category", d => d.properties.CATEGORY)
          .property("level", d => d.properties.LEVEL)
          .property("more-info", d => d.properties.MORE_INFO)
          .property("description", d => d.properties.DESCRIPTION)
          .property("log-group", d => d.properties.logGroup)
          .property("sub-tag", d => d.properties.subTag)
          .property("orig-opacity", polyOpacity)
          .property("orig-stroke-opacity", polyStrokeOpacity)
          .property("hover-opacity", d => Math.min(0.9,+Math.max(0.5,polyOpacity(d) * 1.5).toFixed(2)))
          .style("stroke-opacity", polyStrokeOpacity)
          .style("opacity", 0)
          .call(async enter => {
            let strokeWidth = getStrokeWidth(enter.datum()); // added here to reduce repetitive calls
            enter.style("stroke-width",strokeWidth)
                 .property("orig-stroke-width",strokeWidth)
            let fill = await getFill(enter.datum());
            if (fill.key) { // typeof fill === "Object"
              // let stroke = chroma(patterns[fill.key].primaryHex).brighten().hex();
              let stroke = patterns[fill.key].primaryHex;
              enter.attr("patternKey",fill.key)
              enter.classed("patterned",true)
              enter.style("fill", patterns[fill.key].url)
                   .style("stroke", stroke)
                   .property("orig-stroke", stroke)
            } else {
              // let stroke = chroma(colorAssignments.ecoregions[enter.datum().properties.ECOZONE].base).brighten();
              // let stroke = colorAssignments.ecoregions[enter.datum().properties.ECOZONE].base;
              let stroke = fill;
              enter.style("fill", fill)
                   .style("stroke", stroke)
                   .property("orig-stroke", stroke)
            }
            if (enter.property("sub-tag")) enter.classed(enter.property("sub-tag").divId,true);
            enter.transition().duration(t).ease(d3.easeLinear)
              .style("opacity", polyOpacity)
              .on("end", function() {
                // was d3.active(this)
                enter.on("mouseenter", onMouseenter)
                     .on("mouseout", onMouseout)
              })
            output(enter)
          }),
        update => update,
        exit => exit.call(exit =>
          exit.transition().duration(t)
            .style("opacity", 0)
            .on("end", () => {
              exit.remove()
            })
        )
      )
      // .order() // better here?

    // SOON:
    // animate radial gradient outward from i0 -> i1
    // use line from i0 to i1 to determine baseT? and dictate direction of reveal

  }

  function unencountered() {

    let featureId = this.properties.id,
         geomType = featureId.slice(0,2),
         duration = geomAssoc[geomType].reverseT,
              col = geomAssoc[geomType].encounterCol,
               gj = currentRoute.readyAndWaiting[featureId];

    if (!gj) return;

    uniqueEncounters.delete(featureId);
    geomAssoc[geomType].set.delete(gj);

    let feature = d3.select(geomAssoc[geomType].groupId).select(`#${featureId}`)

    let watershedFlag = feature.property("category") === "Watershed",
             feature2 = watershedFlag ? d3.select(geomAssoc[geomType].groupId).select(`#${featureId + "-2"}`) : null;

    if (feature && feature.node()) {

      switch(geomType) {
        case "pt":
          feature.transition().duration(duration)
          .attr("r",0.1)
          .on("end", () => feature.remove())
          break;
        case "ln":
          if (watershedFlag) {
            feature.transition().duration(duration) // .ease(d3.easeCubicIn)
              .styleTween("stroke-dashoffset", clearDashed)
              .on("start", () => {
                if (feature2.node()) {
                  feature2.transition().duration(duration)
                    .styleTween("stroke-dashoffset", clearDashed)
                    .on("end", () => feature.remove())
                }
              })
              .on("end", () => feature.remove())
          } else {
            feature.transition().duration(duration) // .ease(d3.easeCubicIn)
              .styleTween("stroke-dasharray", clearSolid)
              .on("end", () => feature.remove())
          }
          break;
        case "py":
          feature.transition().duration(duration)
            .style("opacity", 0)
            .on("end", () => feature.remove())
          break;
      }

    }

    // UNOUTPUT (if anything was outputted in the first place)
    let outputted = allEncounters[col][allEncounters[col].findIndex(s => s.attr("id") === featureId)];

    if (outputted) unoutput(outputted,col);

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

  function output(encountered,pairedFlag = '') {

    if (encountered.property("name")) {

      // get encountered group A, B, or C
      let geomType = encountered.property("id").slice(0,2),
               col = geomAssoc[geomType].encounterCol;

      allEncounters[col].unshift(encountered) // array of selections

      // "currently passing" div
      updateOutput(allEncounters[col].slice(),col,geomType,pairedFlag)

      // legend-log groups
      log(encountered)

      function updateOutput(encounters,col,geomType,pairedFlag) { // allEncounters) {
        // https://observablehq.com/@d3/selection-join

        const t = d3.transition().duration(750)

        // HOW TO SMOOTH OUT SCROLL?
        d3.select(`#encounters-${col}`).selectAll(".encounter")
          .data(encounters, d => d.property("id"))
          .join(
            enter => enter.append("div")
              .classed(`flex-child flex-child--no-shrink encounter ${geomType}-encounter toggle-pointer one-life color-black txt-compact mx3 my3 px6 py6 ${pairedFlag}`, true)
              .html(getHtml)
              .property("assocId", d => d.attr("id"))
              .on("mouseover", highlightAssoc)
              .on("mouseout", unhighlightAssoc)
              .on("click", zoomToFeature),
            update => update,
            exit => exit
              .call(exit => exit.transition(t)
                .style("opacity", 0))
              .remove()
          );

      }

      function getHtml(d) {
        return `<div class="point-none opacity50 bg-white h-full w-full round color-black shadow-darken25 border--gray-faint px3 py3">
          ${getInnerHtml(d)}
        </div>`
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
          let logCount = d3.select(`#${id}-count`),
               current = logCount.text()

          // add one & update
          logCount.text(+current+1)

        }

        function addNewGroup(encountered,group,isParent = true,parentSet = logGroups,parentDivId = "legend-log-content",padLeft = 0) {

          parentSet.add(group.divId);

          let symbol = styleToSymbol(encountered,padLeft),
              symbolId = (encountered.property("sub-tag") ?
                encountered.property("sub-tag").divId
              : encountered.property("log-group").divId) + "-sym";

          symbolSet.add(symbolId)

          let itemClass = (parentSet === logGroups) ? "legend-log-item" : "legend-log-child-item";

          let sortedDivIds = [...parentSet].sort((a,b) => {
            return (a < b) ? -1 : 1; // alphabetical; b/c data spread from set of unique items, no need to address a === b
          })

          // for child items, slim sorted div set appropriately to ensure 1:1 join (data includes no excessive/unmatchable items)
          if (parentSet !== logGroups) sortedDivIds = sortedDivIds.filter(d => d.match(/.*(?=-)/)[0] === group.divId.match(/.*(?=-)/)[0])

          d3.select(`#${parentDivId}`).selectAll(`.${itemClass}`)
            .data(sortedDivIds, d => d)
            .order()
            .join(
              enter => enter.append("div")
                .classed(`flex-child flex-child--grow flex-child--no-shrink hmin18 hmin24-mm ${itemClass} relative one-life`,true)
                .html(getLogHtml(group,symbolId,isParent,padLeft))
                .property("groupId",group.divId)
                .property("symbolId",symbolId)
                .style("opacity", 0)  // initially
                .on("mouseover", highlightAssoc)
                .on("mouseout", unhighlightAssoc)
                .on("click", zoomToFeature)
                .call(enter => enter.transition().duration(300)
                  .style("opacity", 1)
                )
              ,
              update => update,
              exit => exit
            )

          // add fill to new HTML element within newItem
          let swatch = d3.select(`#${parentDivId}`).select(`#${group.divId}`).select(`#${symbolId}`)

          // when child element, ensure caret-toggle of parent group is visible
          if (isParent) {
            swatch.append("span")
              .classed("my-marker triangle triangle--r color-gray-dark point-none middle-y-mxl none",true) // node hidden until children added
          } else { // ie, isChild
            let parentSym = d3.select(`#${parentDivId}`).select("summary").select(".log-symbol");
            parentSym.classed("pointer",true)
            parentSym.on("click",function() {
              d3.event.stopPropagation();
              // children toggled automatically by details element; this function attending to visual of triangle marker only
              let target = d3.select(this);
              target.classed("open") ?
                target.classed("open",false).classed("closed",true)
              : target.classed("closed",false).classed("open",true)
            })
            parentSym.select(".my-marker").classed("none",false);
          }

          // then iterate through keys
          Object.keys(symbol.styles).forEach(key => {
            swatch.style(key, symbol.styles[key]);
          })

          if (symbol.src) swatch.style("background-image", `url(${symbol.src})`) // avoids [object Object]

          function styleToSymbol(d,padLeft) { // element will already be styled appropriately at this point; turn style to symbol (not all will require textures!)

            let symbol = {
              styles: {
                background: d.attr("fillStyle") || d.style("fill"),
                color: d.attr("strokeStyle") || d.style("stroke"),
                opacity: d.style("orig-opacity") || 1
              }
            }

            if (d.property("category") === "Ecoregion") {
              return symbol;
            }

            let geomType = d.attr("id").slice(0,2),
              divId = d.property("log-group").divId,
              key = (d.classed("patterned")) ?
                  d.attr("patternKey")
                : d.property("category").toLowerCase() + "-" + (d.property("sub-tag") ?
                  d.property("sub-tag").divId
                : divId) + "-" + geomType;

            let pattern = patterns[key];

            if (!pattern || (d.property("category") === "Watershed") ) {  // rivers & watersheds, heretofore untexturized

              // if watershed, don't assume that legend-log-item-sym === legend-log-child-item-sym; recalc avoids flawed offset of dashed line within single child drain symbol
              let textureArr = getTextures(d,key,geomType,padLeft);

              // assign all srcs & urls to patterns object; COULD skip actual svg url() call in this case only.. (only lines reach this point)
              pattern = assignPatterns(textureArr,key);

            }

            symbol.src = ((geomType === "py" && !pyIgnore.includes(divId)) || (geomType === "pt" && !ptIgnore.includes(divId))) ? pattern.invertedSrc : pattern.src;

            return symbol;

          }

          function getLogHtml(group,fillId,isParent,padLeft) {

            let initCount = 1,
              s = 24 - padLeft;

            let html,
              innerHtml = `<span id="${fillId}" class="flex-child flex-child--no-shrink h${s} w${s} log-symbol align-center pt3 pt0-mm"></span>
              <label class="flex-child flex-child--grow align-center log-name toggle-pointer px3">${group.fullTxt}</label>
              <span id="${group.divId}-count" class="flex-child flex-child--no-shrink log-count">${initCount}</span>`
              //  h${s} w${s-6} align-r

            if (isParent) {
              html = `<details id="${group.divId}" class="flex-parent flex-parent--column">
                <summary>
                  <div class="flex-parent flex-parent--space-between-main flex-parent--center-cross border-t border-b border--dash">
                    ${innerHtml}
                  </div>
                </summary>
              </details>`
            } else {
              html = `<div id="${group.divId}" class="flex-parent flex-parent--space-between-main flex-parent--center-cross border-l ml12 py3">
                ${innerHtml}
              </div>`
            }

            return html;

          }

        }

      }

    }

  }

  function unoutput(unencountered,col) {

    // remove feature from associated allEncounters array
    let i = allEncounters[col].indexOf(unencountered);
    allEncounters[col].splice(i,1)

    unupdateOutput(allEncounters[col].slice(),col)

    unlog(unencountered)

    function unupdateOutput(unencounters,col) { // allEncounters) {
      // https://observablehq.com/@d3/selection-join

      const t = d3.transition().duration(750)

      // HOW TO SMOOTH OUT SCROLL?
      d3.select(`#encounters-${col}`).selectAll(".encounter")
        .data(unencounters, d => d.property("id"))
        .join(
          enter => enter,
          update => update,
          exit => exit
            .call(exit => exit.transition(t)
              .style("opacity", 0))
            .remove()
        );

    }

    function unlog(unencountered) {

      let group = unencountered.property("log-group"),
            tag = unencountered.property("sub-tag");

      if (logGroups.has(group.divId)) subtractFromCount(group.divId);

      if (tag) {
        if (tagTypes.has(tag.divId)) subtractFromCount(tag.divId);
      }

      function subtractFromCount(id) {

        // access current
        let logCount = d3.select(`#${id}-count`),
             current = logCount.text();

        // add one & update
        logCount.text(+current-1)

      }

    }

  }

  function trackerUpdate(i) {

    let coordsNow = currentRoute.geoMM[i],
            miles = i + 1,
             // pace = getPace();
             time = Math.round(miles * currentRoute.minPerMile);

    if (coordsNow) {  // avoids error at end

      getElevation(coordsNow).then(elevation => {
        d3.select("#elevation-val").text(elevation)
      });

      let azimuth = getAzimuth(i);
      d3.select("#compass-val").text(azimuth)
      d3.select("#current-quadrant").text(getQuadrant(azimuth))

    }

    d3.select("#odometer-val").text(miles)
    d3.select("#clock-val").text(time)

  }

  function getMM(t) {
    // // if tpm variable, current mm is would be pace calculation minus previous total (already elapsed, cannot undo)
    // let atPace = Math.floor(t/tpm);
    // mm = accumReset ? atPace - accumReset : atPace;
    // return mm;
    return Math.floor(t/tpm); // store if going for adjustTPM()?
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

  function getAzimuth(i) {  // returns rounded value in degrees of azimuth bearing between two unprojected pts

    let prevPt = currentRoute.geoMM[i-1] || currentRoute.geoMM[i],
        nextPt = currentRoute.geoMM[i+1] || currentRoute.geoMM[i];

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

  function expand(elementStr,direction = "up") {

    if (d3.event && d3.event.defaultPrevented) return; // dragged

    // if window too short to reasonably fit more content, expand modal instead
    if (window.innerHeight < 500 && elementStr === "about") {
      toggleModal("modal-about")
    } else {

      d3.select(`#${elementStr}`).classed(`disappear-${contentAssoc.opposites[direction]}`, false)
      d3.select(`#${elementStr}-collapse`).classed("none", false);
      d3.select(`#${elementStr}-expand`).classed("none", true);

      // size- and element-specific toggles upon expand/collapse of various elements
      if (elementStr === "about") {

        if (window.innerWidth >= 1200) {
          d3.select("#section-wrapper").classed("relative", true);
          d3.select("#attribution").classed("mr26-mxl", false)
          d3.select("#dash-content").classed("px30-mxl",false)
          d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",false)
          d3.select("#center-controls").classed("mr-neg26",false)
          d3.select("#lrg-control-text").classed("mr-neg26",false)
          svg.attr("transform",null)
        } else {
          d3.select("#dash-up").classed("mt-neg21", true)
          d3.select("#dash-up").classed("mt-neg10", false)
          d3.select("#dash-expand-btn").classed("h18 mt6", true)
          d3.select("#dash-expand-btn").classed("h24 mt0", false)
          if (d3.select("#dash").classed("disappear-down")) {
            d3.select("#attribution").classed("mt-neg24", false)
            d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", true)
          }
        }

        adjustSize();

      } else if (elementStr === "dash") {
        attuneMapBottomDashTop();
        d3.select("#attribution").classed("mt-neg18 mt-neg24 mt-neg24-mxl mb24", false)
        d3.select("#attribution").classed("mt-neg6 mb6", true)
      }

    }

  }

  function collapse(elementStr, direction = collapseDirection()) {

    if (d3.event && d3.event.defaultPrevented) return; // dragged

    d3.select(`#${elementStr}`).classed(`disappear-${direction}`, true);
    d3.select(`#${elementStr}-expand`).classed("none", false);
    d3.select(`#${elementStr}-collapse`).classed("none", true);

    // size- and element-specific toggles upon expand/collapse of various elements
    if (elementStr === "about") {

      if (window.innerWidth >= 1200) {
        d3.select("#section-wrapper").classed("relative", false)
        d3.select("#center-controls").classed("mr-neg26",true)
        d3.select("#lrg-control-text").classed("mr-neg26",true)
        d3.select("#attribution").classed("mr26-mxl", true)
        d3.select("#dash-content").classed("px30-mxl",true)
        d3.select("#dash").select(".resizer").classed("ml-neg36-mxl",true)
        svg.attr("transform","translate(13,0)")
      } else {
        d3.select("#dash-up").classed("mt-neg10", true)
        d3.select("#dash-up").classed("mt-neg21", false)
        d3.select("#dash-expand-btn").classed("h24 mt0", true)
        d3.select("#dash-expand-btn").classed("h18 mt6", false)
        if (d3.select("#dash").classed("disappear-down")) {
          d3.select("#attribution").classed("mt-neg24", true)
          d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", false)
        }
      }

      if (svgLoaded) adjustSize();

    } else if (elementStr === "dash") {
      // d3.select("#lrg-control-text").style("bottom","24px")
      // d3.select("#center-controls-parent").style("bottom","24px")
      attuneMapBottomDashTop();
      d3.select("#attribution").classed("mt-neg6 mb6",false)
      d3.select("#attribution").classed("mb24",true)
      if (d3.select("#about").classed("disappear-down")) {
        d3.select("#attribution").classed("mt-neg24", true)
        d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", false)
      } else {
        d3.select("#attribution").classed("mt-neg18 mt-neg24-mxl", true)
        d3.select("#attribution").classed("mt-neg24", false)
      }
    }

  }

  function toggleModal(subContent,force) {

    if (force === "open" || (force !== "closed" && d3.select(`#modal`).classed("none"))) {
      if (subContent) {
        d3.select(`#${subContent}`).classed("none", false);
        if (subContent === "modal-about") {
          collapse("about")
          isTogglable(subContent,true) // only info btn toggles modal open and closed
        } else {  // subContent === "getOptions"
          d3.select("#select-new").property("disabled", true); // disable select-new btn while getOptions form is open
          d3.select("#submit-btn-load").classed("none",true);
          d3.select("#submit-btn-txt").classed("none",false);
        }
      }
      d3.select("#veil").classed("none", false);
      d3.select("#modal").classed("none", false);
    } else {  // modal currently open || force === "closed"
      // if toggling closed with close button (!subContent) or re-clicking subContent button recently used to open modal
      if (!subContent || (subContent && isTogglable(subContent))) {
        // basic close; reset various
        d3.select("#modal").classed("none", true);
        d3.select("#veil").classed("none", true);
        d3.select("#get-options").classed("none", true);
        d3.select("#submit-btn-load").classed("none",true);
        d3.select("#submit-btn-txt").classed("none",false);
        d3.select("#modal-about").classed("none", true);
        d3.select("#select-new").property("disabled", false);
        if (subContent) { isTogglable(subContent,false) }
      } else {  // subContent && (!isTogglable(subContent))
        // user wants to switch modal subContent with modal open
        if (d3.select(`#${subContent}`).classed("none")) {
          if (subContent === "modal-about") {
            d3.select("#select-new").property("disabled", false);
          } else if (subContent === "getOptions") {
            d3.select("#select-new").property("disabled", true); // disable select-new btn while getOptions form is open
          }
          // open user selected subContent via switch
          let nowOpen = contentAssoc[subContent].opp
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
    let btn = contentAssoc[content].btn;
    if (set !== undefined) togglesOff[btn] = set;
    return togglesOff[btn];
  }

//// BUTTONS & FUNCTIONAL ICONS

  function highlightBtn() {
    d3.select(this).classed("bg-lighten75",false)
    d3.select(this).classed("bg-accent3",true)
  }

  function removeHighlight() {
    d3.select(this).classed("bg-accent3",false)
    d3.select(this).classed("bg-lighten75",true)
  }

  function togglePause() {
    if (experience.animating && !experience.manuallyPaused) {
      // manual pause control feedback
      showLrgControls("pause-lrg")
      manualPause();
    } else if (experience.animating) {
      d3.selectAll(".toggle-pointer").classed("pointer",false)
      // manual resume control feedback
      showLrgControls("play-lrg").then(manualResume)
    }
  }

  function manualPause() {

    pauseTimer();
    experience.manuallyPaused = true;

    // regardless of direction
    d3.selectAll(".toggle-pointer").classed("pointer",true)
    d3.select("#play-pause-icon")
      .selectAll(".icon-opt").classed("none", true)

    if (experience.reversing.flag) {
      d3.select("#play-pause-btn")
        .property("disabled", false)
        .on("click.play", null)
        .on("click.pause", null)
        .on("click.replay", manualResume)
      d3.select("#play-pause-icon")
        .select("#replay-icon").classed("none", false)
    } else {
      // toggle play/pause buttons
      d3.select("#play-pause-btn")
        .on("click.play", manualResume)
        .on("click.pause", null)
        .on("click.replay", null)
      d3.select("#play-pause-icon")
        .select("#play-icon").classed("none", false)
    }

    // allow free zooming while paused
    svg.call(zoom)

  }

  function pauseTimer() {
    // if not yet animating (no timers to pause) or already paused (re-setting pausedAt value before expliciting resuming will cause jumps)
    if (experience.animating && !experience.pausedAt) {
      // update experience state
      experience.paused = true;
      experience.pausedAt = d3.now() - timer._time;
      // stop timer (after pausedAt stored)
      timer.stop();
    }
    return Promise.resolve();
  }

  function manualResume() {

    // no rush to resume (as opposed to manualPause)

    // disable free zooming
    svg.on("wheel.zoom",null)
    svg.on("scroll.zoom",null)

    // realign to zoomAlong transform state if necessary; control timing of continueResume() tasks
    if (transitionResume) {

      // reset
      transitionResume = false;

      let t1 = (experience.reversing.flag) ? experience.reversing.t : tFull,
          tP = (experience.reversing.flag) ? experience.reversing.tPad : tPad;

      let transform = getZoomAlongTransform(experience.pausedAt,t1,tP)

      svg.transition().duration(750)
        .call(zoom.transform, getIdentity(transform))
        .on("start", resetTransformAdjustments)
        .on("end",continueResume)

    } else {
      continueResume();
    }

    function continueResume() {

      resumeTimer();

      // regardless of direction
      d3.selectAll(".toggle-pointer").classed("pointer",false)
      d3.select("#play-pause-icon")
        .selectAll(".icon-opt").classed("none",true)

      if (experience.reversing.flag) {
        d3.select("#play-pause-btn")
          .on("click.play", null)
          .on("click.pause", null)
          .on("click.replay", null)
          .property("disabled", true)
        d3.select("#play-pause-icon")
          .select("#reversing-icon").classed("none",false)
      } else {
        // toggle pause-play
        d3.select("#play-pause-btn")
          .on("click.pause", manualPause)
          .on("click.play", null)
          .on("click.replay", null)
        d3.select("#play-pause-icon")
          .select("#pause-icon").classed("none",false)
      }

    }

  }

  function resumeTimer(delay = 0) {
    // copy pausedAt value
    let pausedAt = experience.pausedAt;
    // reset pause state
    experience.pausedAt = null;
    experience.paused = false;
    experience.manuallyPaused = false;
    // restart timer @ time passed since storing of pausedAt
    timer.restart(animate,delay,d3.now() - pausedAt);
  }

  function selectNew() {

    if (!experience.initiated) {
      resetZoom().then(() => {
        toggleModal('get-options')
      })
    } else {  // experience.initiated
      if (confirm('Do you wish to select a new route?')) {
        resetZoom(true).then(resetConfirmed);  // state0 == true;
      } else {
        if (experience.paused && !experience.manuallyPaused) resumeTimer();
      }
    }

    function resetConfirmed() {

      routeHx[currentRoute.id] = currentRoute  // jsonCopy(currentRoute)

      collapse("dash", "down")
      restoreState0()

      console.log(routeHx)

      // in case user didn't make it past awaitUserInput screen:
      d3.select("#center-controls-parent").classed("mb36",false)
      d3.select("#lrg-control-text")
        .classed("hide-visually none",true)
        .style("transform",null)
      d3.select("#center-controls")
        .classed("none",true)
        .style("transform",null)

      d3.select("#getOption0").html(state0.opt0)
      d3.select("#getOption1").html(state0.opt1)

      // open selection form
      toggleModal("get-options","open")

    }

  }

  function restoreState0(init = false) {

    // reset state
    resetExperienceState();  // also nulls timer
    resetTransformAdjustments();
    togglesOff = { info: false, select: false };
    currentRoute = { views: {} };
    zoomAlongState = { /* prevTranslate, prevRotate, prevExtent, pt0 */ };

    // reset stored content
    logBackgrounds = {
      // geomType: {
      //   complete: true || false,
      //   imgSrc: finalImgSrc
      // }
    };

    logGroups = new Set();
     tagTypes = new Set();
    symbolSet = new Set();

    encounteredPts = new Set();
    encounteredLines = new Set();
    encounteredPolys = new Set();
    uniqueEncounters = new Set();
    allEncounters = { "A": [], "B": [], "C": [] };

    // reset zoom abilities (more below if init; will have already resetZoom() before calling)
    svg.call(zoom);

    if (init) {
      enableZoomBtns();
      toggleModal("get-options","open")
    } else {
      // reset event listeners
      svg.on("click", null)
      window.onkeydown = null;
      // reset view
      undimBackground()
      g.select("#rail-stations").selectAll("use")
        .classed("point-none", false)
        .transition().duration(500)
          .style("opacity", 0.8)
      d3.selectAll('.one-life').remove();
      d3.selectAll(".toggle-none").classed("none",true)
      d3.selectAll(".reset-0").text("0")
      d3.select("#current-quadrant").text("N")
      geomGrpIds.forEach(selector => d3.select(selector).style("background-image", null))
      // reset additional state & stored content
      transitionResume = false;
    }

    function undimBackground(t = 500) {
      let dimGroup = dimMore.concat(dimLess);
      dimGroup.forEach(d => {
        let selection = Array.isArray(d) ? d3.select(d[0]).selectAll(d[1]) : d3.select(d);

        if (selection.on("mouseenter")) {  // cities
          selection.property("orig-opacity",selection.property("orig-orig-opacity"))
        }

        selection.transition().duration(t)
          .style("opacity", selection.property("orig-opacity") || 1)
      })
    }

  }

//// STYLES

  function getFill(d) {
    let fill,
      props = d.properties, // shorthand
      geomType = props.id.slice(0,2);
    // offer texture opportunity FIRST
    if (props.logGroup.textureType) {
      // equivalent of texture.flag
      let key;
      if (props.subTag && props.subTag.divId) {
        key = props.subTag.divId + "-" + geomType;
      } else if (props.logGroup.divId) {
        key = props.logGroup.divId + "-" + geomType;
      }
      fill = {key: key}
      if (!patterns[fill.key]) {
        // calculate and assign all possible urls & bg sources now
        let textureArr = getTextures(d,key,geomType);
        assignPatterns(textureArr,key);
      }
    } else if (props.CATEGORY === "Ecoregion") {
      if (props.LEVEL === "I") {
        fill = colorAssignments.ecoregions[props.ECOZONE].base;
      } else {
        fill = getSimilarColor(chroma(colorAssignments.ecoregions[props.ECOZONE][props.LEVEL].base).rgb(),unromanize(props.LEVEL))
      }
      // RADIAL GRADIENT, PIXEL->PIXEL FLOODING ETC COMING SOON
    } else if (props.subTag && props.subTag.color) {
      fill = props.subTag.color;
    } else {
      console.log("???:",d.properties.NAME,"/",d.properties.DESCRIPTION,"/",props.logGroup,"/",props.subTag)
      // COMBAK:
      // [object Object]: {py: {…}}
      // divId: "pa-grp3"
      // {id: "py2250", NAME: "Cumbres de Majalca", LEVEL: "", CATEGORY: "Protected Area", MORE_INFO: "Established 1939", …}
      // ???: Cumbres de Majalca
      fill = paletteScale(random());
    }
    return fill;
  }

  function processTexture(d,htmlFlag = false,invertFlag = false,padLeft = 0) { // d may be gj feature or selected dom node

    let texture,
      textureOpts = {},
      primaryHex,
      props = (d instanceof d3.selection) ? d.datum().properties : d.properties,  // shorthand
      geomType = props.id.slice(0,2),
      textureProps = htmlFlag ?
          {...props.logGroup.textureProps, ...props.logGroup.htmlAdjust}
        : geomType === "pt" ?
          props.logGroup.ptTextureProps || props.logGroup.textureProps
        : props.logGroup.textureProps;

    if (geomType === "ln") {
      texture = getLinedTexture(d,padLeft);
      primaryHex = chroma(d.style("stroke")).hex(); // can use d.style because line textures only processed based on pre-rendered DOM nodes
    } else {

      // defaults:
      textureOpts.stroke = textureProps.stroke;
      textureOpts.background = textureProps.background;

      // adjustments & primaryHex assignment:
      if (props.subTag && props.subTag.color) {
        primaryHex = props.subTag.color;
        if (geomType === "pt") {
          textureOpts.background = props.subTag.color;
          textureOpts.stroke = "whitesmoke"; // will be assignment automatically
        } else { // svg polygons
          // adjusting strokes below to increase contrast with underlayer
          textureOpts.stroke = (htmlFlag || textureProps.d === "crosses") ?
              primaryHex
            : textureProps.d === "hexagons" ?
              chroma(primaryHex).brighten().hex()
            : chroma(primaryHex).darken().hex();
        }
      } else { // pre-determined textured lines (pys & pts: lakes, grasslands, volcanoes, other-np-geo, inventoried roadless)
        // assumes at least one of either background or stroke defined in textureProps

        // !symInvert.includes()
        primaryHex = ((geomType === "pt" && ptIgnore.includes(props.logGroup.divId)) || !pyIgnore.includes(props.logGroup.divId)) ?
            (textureProps.background ? textureProps.background.slice() : textureProps.stroke.slice())  // prefer background
          : (textureProps.stroke ? textureProps.stroke.slice() : textureProps.background.slice())

      }

      if (invertFlag) {
        // pts typically invert from dark background, light stroke to light background, dark stroke
        // pys typically invert from transparent background, dark stroke to dark background, light stroke
        let origBackground = textureOpts.background ? textureOpts.background.slice() : undefined,
                origStroke = textureOpts.stroke ? textureOpts.stroke.slice() : undefined;
        textureOpts.background = origStroke;
        textureOpts.stroke = origBackground;
      }

      // address remaining blanks
      if (!textureOpts.stroke) textureOpts.stroke = "whitesmoke";  // most likely post-invert where background was transparent/undefined
      if (htmlFlag && !textureOpts.background) textureOpts.background = "#e6ece6";
      if (props.logGroup.textureType === "circles") textureOpts.fill = textureOpts.stroke;

      // store!
      texture = getNewTexture(props.logGroup.textureType,{...textureProps,...textureOpts})

    }

    // make texture urls accessible
    htmlFlag ? hiddenSvg.call(texture) : svg.call(texture);

    // troubleshooting
    if (!primaryHex) console.log("undefined: " + geomType + " : " + props.logGroup.divId)
    if (primaryHex === "whitesmoke") console.log("whitesmoke: " + geomType + " : " + props.logGroup.divId)

    return {
      texture: texture,
      primaryHex: primaryHex // || "#343434"
    };

  }

  function getLinedTexture(d,padLeft) {

    let pathSequence,
      s = 24 - padLeft;

    if (d.property("category") === "Watershed") {

      // hardcoded because this is really all that makes sense for a small swatch, and ensures compatability with safari

      let l = s > 18 ? 1.5 : 2;

      pathSequence = `
          M 0,${s}
          l ${l},-${l}
          m 6,-6
          l ${l},-${l}
          m 6,-6
          l ${l},-${l}
          m 6,-6
          l ${l},-${l}
        `;

    } else if (d.property("category").startsWith("River")) {

      pathSequence = `M 0,${s} L ${s},0`;

    }

    return textures.paths()
        .d(s => pathSequence)
        .size(s)
        .heavier()
        .stroke(d.style("stroke"))
        .background("#e6ece6")
        .shapeRendering("crispEdges")

  }

  function getTextures(d,key,geomType,padLeft) {
    let texture0 = processTexture(d),  // element-spec: htmlFlag == false, invertFlag == false, padLeft N/A
        texture1 = processTexture(d,true,false,padLeft),  // output-bgs: htmlFlag == true, invertFlag == false
        texture2 = (geomType === "py" || geomType === "pt") ? processTexture(d,true,true) : null;  // for specially inverted polygon legend-log swatches: htmlFlag == true, invertFlag == true; padLeft N/A;
    return [texture0,texture1,texture2];
  }

  function assignPatterns([texture0,texture1,texture2],key) {
    patterns[key] = {
      // srcs for swatches, dash bgs, and canvas fill;
        // src === standard, invertedSrc only for polygons (used selectively)
        // keep distinction between geomTypes in case I bring canvas back in (pt/py sources different for same sub-group)
      // url for svg use only
      src: textureToSrc(texture1.texture),
      invertedSrc: (texture2) ? textureToSrc(texture2.texture) : null,
      url: texture0.texture.url(),
      primaryHex: texture0.primaryHex
    }
    return patterns[key];
  }

  function textureToSrc(texture,type = "base64") {
    // called for swatch/canvas textures only

    let textureId = getSubstr(texture.url()),
          pattern = hiddenSvg.select(textureId);

    let w = pattern.attr("width"),
        h = pattern.attr("height");

    let xml = `<svg xmlns="http://www.w3.org/2000/svg" height="${h}" width="${w}">${pattern.node().innerHTML}</svg>` // avoids actually/unnecessarily appending to DOM tree

    return getBase64(xml);

    function getBase64(xml) {
      // reduced from https://jsfiddle.net/Wijmo5/h2L3gw88/
      return 'data:image/svg+xml;base64,' + btoa(xml);
    }

  }

  function getStrokeWidth(d) {
    if (d.properties.STROKEWIDTH) {
      return d.properties.STROKEWIDTH * 0.25 + "px";
    } else if (d.properties.LEVEL) {
      return levelScale(unromanize(d.properties.LEVEL)).toFixed(2) + "px"
    } else {
      return 0.025 + "px";
    }
  }

  function getNewTexture(type = "paths",props) {
    let texture = textures[type]()
    Object.keys(props).forEach(d => {
      texture[d](props[d])
    })
    return texture;
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

//// TOOLTIPS & FEATURE CLICK/MOUSEOVER

  function onMouseenter(d) {

    let mouseTarget = d3.select(this),
         selections = [mouseTarget],
          partnerId = mouseTarget.classed("paired-flag") ?
                        mouseTarget.classed("second-half") ?
                          mouseTarget.attr("id").replace("-2","")
                        : mouseTarget.attr("id") + "-2"
                      : null;

    if (partnerId) {
      mouseTarget.property("partner-id",partnerId)  // COMBAK could work this in earlier!
      selections.push(d3.select(`#${partnerId}`))
    }  // split watersheds!

    // visual affordance for element itself
    selections.forEach(selection => highlight(selection))

    if (mouseTarget.property("name")) {
      // make/bind/style tooltip, positioned relative to location of mouse event (offset 10,-30)
      let tooltip = d3.select("#map").append("div")
        .attr("class","tooltip point-none shadow-darken50")
        .html(getInnerHtml(mouseTarget))
        .style("left", (d3.event.layerX + 10) + "px")
        .style("top", (d3.event.layerY - 30) + "px")
        .attr("fill", "honeydew")
        .attr("stroke", "dimgray")
        .attr("opacity", 0) // initially

      // bring tooltip into full opacity
      tooltip.transition().duration(100)
        .style("opacity", 1)

      // automatically fade tooltip after 5 seconds
      d3.timeout(() => {

        tooltip.transition().duration(300)
          .style("opacity", 0)

        // remove tooltip from DOM
        tooltip.remove();

      }, 5000);

    }

  }

  function getInnerHtml(d) {

    // only arrives here if node and name confirmed

    let pre = `<span class="name txt-compact2 txt-s txt-m-mxl">`;

    // main output
    let mainOut = getName(d);

    // posttext/subtext/more info
    let post = `</span>`;

    if (d.property("category") === "Ecoregion") {
      mainOut += `<br />
      <span class="name-ii txt-em txt-xs txt-s-mxl">Level ${d.property("level")} Ecoregion</span >
      `
    }

    if (d.property("more-info")) {
      mainOut += `
      <br />
      <span class="more-info txt-em txt-xs txt-s-mxl">${d.property("more-info")}</span>
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

    let mouseTarget = d3.select(this),
         selections = [mouseTarget],
          partnerId = mouseTarget.classed("paired-flag") ? mouseTarget.property("partner-id") : null;

    if (partnerId) selections.push(d3.select(`#${partnerId}`));  // split watersheds!

    // reset visual affordances; note opposite defaults
    selections.forEach(selection => unhighlight(selection))

    // access existing
    let tooltip = d3.select("#map").selectAll(".tooltip") // don't bother matching by id; should only ever be one tooltip open at a time

    // transition tooltip away
    tooltip.transition().duration(300)
      .style("opacity", 0)

    // remove tooltip from DOM
    tooltip.remove();

  }

  function highlightAssoc() {

    // select & highlight corresponding enrich elements on map
    let mouseTarget = d3.select(this);

    if (mouseTarget.classed("legend-log-child-item")) d3.event.stopPropagation();

    let selector = getSelector(mouseTarget),
      associated = [g.select("#enrich-layer").selectAll(`${selector}`)];

    if (mouseTarget.classed("paired-flag")) { // must be .encounter
      let associated2 = g.select("#enrich-layer").select(`${selector}-2`);
      if (associated2.node()) associated.push(associated2);
    }

    associated.forEach(selection => {
      selection.nodes().forEach(node => highlight(d3.select(node)))
    });

    // highlight text node container
    if (mouseTarget.classed("encounter")) {

      d3.select(this.firstChild).classed("opacity75",true)

      let fillVal = associated[0].style("fill");

      if (fillVal.startsWith("url")) {  // textured; use existing pattern src (for html, not svg)

        let divId = associated[0].property("log-group").divId,
         geomType = associated[0].attr("id").slice(0,2),
          pattern = patterns[associated[0].attr("patternKey")],
           imgSrc = (geomType === "pt" && symInvert.includes(divId)) ? pattern.invertedSrc : pattern.src;

        mouseTarget.style("background-image", `url(${imgSrc})`) // avoids [object Object]

      } else if (fillVal === "none") {  // lines

        if (associated[0].property("sub-tag")) { // watersheds

          let patternKey = associated[0].property("category").toLowerCase() + "-" + associated[0].property("sub-tag").divId + "-" + selector.slice(1,3);

          mouseTarget.style("background-image", `url(${patterns[patternKey].src})`)

        } else {  // rivers

          mouseTarget.style("background-color",associated[0].style("stroke"));

        }

      } else {

        mouseTarget.style("background-color",fillVal)

      }

    } else {

      let hoverNode = mouseTarget.classed("legend-log-item") ? mouseTarget.select("details").select("summary").node() : this;

      d3.select(hoverNode).classed("bg-darken25",true)

    }

  }

  function unhighlightAssoc() {

    // select & unhighlight corresponding enrich elements on map
    let mouseTarget = d3.select(this);

    if (mouseTarget.classed("legend-log-child-item")) d3.event.stopPropagation();

    let selector = getSelector(mouseTarget),
     associated = [g.select("#enrich-layer").selectAll(`${selector}`)];

    if (mouseTarget.classed("paired-flag")) {  // must be .encounter
      let associated2 = g.select("#enrich-layer").select(`${selector}-2`);
      if (associated2.node()) associated.push(associated2);
    }

    associated.forEach(selection => {
      selection.nodes().forEach(node => unhighlight(d3.select(node)))
    });

    // unhighlight text node container
    if (mouseTarget.classed("encounter")) {
      // clear to original background & opacity
      mouseTarget.style("background-color","rgba(0, 0, 0, 0)")
      mouseTarget.style("background-image","none")
      d3.select(this.firstChild).classed("opacity75",false)
    } else {
      let hoverNode = (mouseTarget.classed("legend-log-item")) ? mouseTarget.select("details").select("summary").node() : this;
      d3.select(hoverNode).classed("bg-darken25",false)
    }

  }

  function highlight(selection) {
    selection  // .classed("hover", false)
      .style("stroke", function(d) {
        let currentStroke = d3.select(this).style("stroke");
        if (!d.geometry) return currentStroke;
        // else
        return d.geometry.type === "Point" ?
          chroma(d3.select(this).style("stroke")).brighten(2).hex()
        : ["Polygon","MultiPolygon"].includes(d.geometry.type) ?
          d3.select(this).classed("patterned") ?
            d3.select(this).style("stroke")
          : chroma(d3.select(this).style("stroke")).desaturate().brighten().hex()
        : chroma(d3.select(this).style("stroke")).brighten().hex();
      })
      .style("stroke-width", function(d) {
        let currentWidth = d3.select(this).style("stroke-width");
        return !d.geometry || ["Polygon","MultiPolygon","Point"].includes(d.geometry.type) ? currentWidth : currentWidth * 1.2
      })
      .style("stroke-opacity",1)  // COULD MESS AROUND HERE TOO; was 0.9
      .style("opacity", function() {
        return d3.select(this).property("hover-opacity") || 0.9
      })
  }

  function unhighlight(selection) {
    selection  // .classed("hover", false)
      .style("stroke", function() {
        return d3.select(this).property("orig-stroke") || "whitesmoke";
      })
      .style("stroke-width", function() {
        return d3.select(this).property("orig-stroke-width") || 0;
      })
      .style("stroke-opacity", function() {
        return d3.select(this).property("orig-stroke-opacity") || 0
      })
      .style("opacity", function() {
        return d3.select(this).property("orig-opacity") || 1;
      })
  }

  function zoomToFeature() {  // if animation paused or ended, zoom to feature(s)

    if (experience.animating && !experience.manuallyPaused) return;  // should not be clickable

    let selection = d3.select(this);

    if (selection.classed("legend-log-child-item")) d3.event.stopPropagation();

    let selector = getSelector(selection),
      associated = g.select("#enrich-layer").selectAll(`${selector}`),
     boundsGroup = [];

    associated.nodes().forEach(node => {
      let featureBounds,
        feature = d3.select(node),
             gj = feature.datum();
      if (gj.geometry.type === "Point") {
        // getCenterTransform requires predetermined zoom level... lacking this, pad projected point with radius pixels and zoom to bounds
        let pt0 = projection(gj.geometry.coordinates), // often feature.attr("cx/cy"), but not always
         radius = +feature.attr("r") + +feature.style("stroke-width").replace("px","");
        featureBounds = [[pt0[0]-radius,pt0[1]-radius],[pt0[0]+radius,pt0[1]+radius]];
      } else {
        featureBounds = path.bounds(gj);
        if (feature.classed("paired-flag")) {
          // INCLUDE PAIR IF IT EXISTS
          let feature2 = g.select("#enrich-layer").select(`#${feature.attr("id")}-2`);
          if (feature2.node()) boundsGroup.push(path.bounds(feature2.datum()))  // approaching this otherwise results in +/- Infinity bounds for watersheds
        }
      }
      boundsGroup.push(featureBounds);
    });

    // 0.5 = padValue
    let groupBounds = combineBounds(boundsGroup);
    groupBounds = padExtent(groupBounds,0.5) // alt to scalePad

    // dash will necessarily be open since user just clicked on it
    let options = { padBottom: d3.select("#dash").node().clientHeight };

    let zoomIdentity = getIdentity(getTransform(groupBounds,options));

    if (zoomIdentity.k > maxFeatureZoom) { // RARE
      options.scale = maxFeatureZoom
      zoomIdentity = getIdentity(getTransform(groupBounds,options));
    }

    // flag to transitionResume
    transitionResume = true;

    svg.transition().duration(zoomDuration/2)
      .call(zoom.transform,zoomIdentity)

  }

  function getSelector(selection) {
    return selection.classed("encounter") ? `#${selection.property("assocId")}` : selection.classed("legend-log-child-item") ? `.${selection.property("symbolId").match(/.*(?=-)/)[0]}` : `.${selection.property("groupId")}`;
  }

//// OTHER HELPER FUNCTIONS

  function capitalize(str) {
    return str.split(" ").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
  }

  function standardizeBounds(bounds) {
    // accept bbox, path.bounds(), or SVG bbox
    if (bounds.length === 4) {
      b0 = [bounds[0],bounds[1]],
      b1 = [bounds[2],bounds[3]]
    } else {
      b0 = bounds[0] || [bounds.x,bounds.y],
      b1 = bounds[1] || [bounds.width,bounds.height]
    }
    return [b0,b1];
  }

  function getCenter(bounds) {
    bounds = standardizeBounds(bounds);
    return [(bounds[1][0] - bounds[0][0])/2, (bounds[1][1] - bounds[0][1])/2];  // domain y (input)
  }

  function resetTransformAdjustments() {
    transformAdjustments = {
      panned: { flag: false, updateFlag: false, transform: null, centerAdjust: null },
      zoomed: { respectFlag: false }
    }
  }

  function resetExperienceState(initException = false, counterException = false) {
    timer = null;
    experience = { initiated: initException, animating: false, paused: false, manuallyPaused: false, pausedAt: null, reversing: { flag: false, i: counterException ? experience.reversing.i : 0, t: null, tPad: null } }
  }

  // PARSE, CONVERT, ASSOCIATE

  function jsonCopy(src) {
    return JSON.parse(JSON.stringify(src));
  }

  function getSubstr(string,i0 = 4) { // defaults for use in converting from textures.js url(); assume format "url(#12345)"
    let i1 = string.length - 1;
    return string.substring(i0,i1)
  }

  function someMatch(arr) {
    return arr.some(match,this);
  }

  function match(text) {
    return this.match(text) // || text.match(this);
  }

  function startsWith(text) {
    return text.startsWith(this) || this.startsWith(text);
  }

  function replaceCommas(string) {
    return string.replace(/\s*,\s*|\s+,/g, '%2C');
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
      "IV": 4
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

  function random(upper,lower = 0) {
    let randNum = Math.random();
    return (upper) ? lower + Math.round(randNum * (upper - lower)) : randNum;
  }

  // ERRORS
  function onError(error) {
    console.log(error);
  }

})();

//// OLD/ADDITIONAL NOTES: ////

// STUMPING ME RIGHT NOW
  // effectively turn #dash, #about, and #modal expand/collapse into transitions (ESP switch between dash/about at begin) (*)

// MEDIUM TASKS
  // better clarity/communication of protected areas classifications; their own group with further togglable subgroups? or combine all PAs? (but I rely on their separation in determining symbology)
  // clean up code:
    // be super consistent and clear including '' vs "", use of var/const/let, spacing, semicolons, etc
    // refactor, optimize, condense, DRY, improve structure

// WISHLIST/FUN
  // ability to select route visually, by clicking on city/rail stn locations from map
  // visualizing all number data within dash:
    // elevation grid/tracker
    // compass needle
    // better clock/odometer visual approximations
  // polygon radial animation / so fancy (see styling notes below; must first make a determination re: transitioning to canvas) (*)
  // add underlying shaded relief terrain layer (*)
    // http://www.shadedrelief.com/birds_eye/gallery.html?
  // ability for user to control pace of train (* would have to be adjusted before animation begins since timing of transitions predetermined *)
  // toggle layers on/off: eco, hydro, geo, protected areas
  // user chosen sort of origin/destination options?
    // random shuffle, by distance, alphabetical
  // more interesting icons for point data
    // maki: all -11, -15: volcano, mountain, park, park-alt1, information, marker, marker-stroked, circle, circle-stroked, bridge, heart
    // assembly: #icon-mountain (for mount, mountain, mt, mtn)
    // noun project: trees, tunnel, train?, NPS (my outline)

// GIVING UP FOR NOW
  // add more enrich data (mostly pts): tunnels, bridges, iNaturalist, glaciers, species-specific polygons (habitat/range, https://www.worldwildlife.org/publications/wildfinder-database)
  // animate rivers in direction of flow: http://www.hydrosheds.org/download
  // ability to replay, ff?, rewind (dash/animate back)
    // would need so much help with state management stuff: animation frame, rendered reveal -- and questions about local/session storage (R2R returns, processed/filtered enrichData)
  // ability to takeSnapshot()=> save inner screenshot in log
  // ability to "select random" in prompt route

// OTHER ISSUES
  // author txt bunches up on small screens when making font-weight of links bold (currently links simply unbolded)
  // keep zindexes in line on small screen sizes (modal vs attribution, toggle buttons)
  // remaining open github issues (form focus issue: use focus-within?)
  // several more interspersed COMBAKs, FIXMEs

// MAAAAYBE
  // new color for modal?
  // verbose console errors (in Chrome)
    // "[Violation] Forced reflow while executing JavaScript took 39ms"
      // https://gist.github.com/paulirish/5d52fb081b3570c81e3a
  // create toggle structure for page layout such that DOM responsivity requires less conditional logic; preset toggle groups for  various panes/panels (integrating all the if/else logic within calcSize(), expand(), and collapse() into styles.css doc; creating style groups to toggle on/off)
    // https://developer.mozilla.org/en-US/docs/Web/Events/toggle
    // css states?
  // add circle size reference to legend (radius as representative of orig area for all polygons (under a certain threshold) I collapsed into their centroids)


////// NEWER NOTES /////

// MINOR FIXES (COMING SOON)
  // have textured backgrounds recalculate from group up on each render?
  // grossly pair down accompanying text (esp all that "overly dramatic" stuff)
  // make form fields like responsive like butter
    // also:
      // origin !!= destination (!!= = cannot)
      // get rid of down arrows

// ADDITIONS (COMING SOON)
  // add automatic highlighting or otherwise improve visual linking of currently passing list with actual rendered features (temporarily align color? thumbnail of shape => dash background?)

// MAYBE
  // more performance fixes
    // Setting up a server to store and provide requested route data (currently querying files only after importing all possible options)
    // Refactoring little areas of my script, eg:
      // using path.measure() or path.area() instead of turf.length() calculations to determine transition variables (mostly timing)
    // appropriately truncating coordinates and other values wherever possible
    // slim library imports / take only what I need
    // dynamically simplifying map geometries
  // more intricate styling
    // if canvas: something akin to https://observablehq.com/@mbostock/randomized-flood-fill
    // plus interpolating between opacity, visibility, colors, location, size

// LATEST NOTES
  // BASE & ENRICH POLYGONS = CANVAS ELEMENTS?
  // background gradient N->S brightest mid continent


/////// NO FOR REAL, THIS WHERE I'M AT ///////

// done:

// todo:
  // improve legend-log-name alignment regardless of number count?  // states and cities for non-MEX-CAN-USA?
  // rid of failure/feelings language
  // form smoothness
  // load elevation data ahead of time to prevent increasing sluggishness  on longer routes
  // svg drop shadow on pts?
  // integrate #attribution and any other bottom-aligned overlay buttons with attuneMapBottomDashTop();
  // hover over legend-log categories offers insight into categorziation process

// maybe? (having trouble finding examples of this now):
  // sometimes padbottom too much for NS firstlastidentities; adjust scalepad up / fix firstlast overzoom (eg Amqui south)
  // clicking on map zooms to feature?
  // center control buttons get animation-fade-in-out class ?
  // nouns/states better as fn expressions? e.g isToggleable
  // fix: stroke with pa-grp1 patterned polys now too dark..
  // stop propagation of hover events where possible

// SAFARI FIXES (ENSURE CURRENT, NOT DEV)
  // lines appear on left when opening details elements / data sources (then disappear again on scroll -- no record)
  // no resize event dispatched upon second tab opened/closed (tab bar revealed)

// FIREFOX FIXES (ENSURE CURRENT, NOT DEV)
  // everything blurry upon zoom (ie entire animation..)

// performance:
  // remove elevation query? (see network tab -- slows me down!)
  // enrich data in dynamo DB? --> query?
  // truncate coordinates and other values wherever possible
  // slim library imports / take only what I need
    // turf - check
    // d3 !
    // chroma ?
  // dynamically simplify map geometries

// GEN NOTES/REMINDERS
  // zooming/panning during active animation will be respected (incl resetZoom)
  // zooming while animation paused will be reset to minimum zoom of routeBoundsIdentity.k, and maximum zoomAlongTransform.k
  // panning while animation paused will be reset to center train
  // if user zooms during animation (respected) then pauses and zooms more, zoom effectively reset within bounds (a good thing)
  // data0-3 all unprojected: init bounds (ie continent), full route, first route frame, last route frame
  // when reversing, quadtree with trigger appropriate 'unreveal' action via dispatch to unencountered()

// COMBAK:
// function featureClicked(node) {
//   console.log(d3.mouse(svg.node()))
//   function clicked([x, y]) {
//     d3.event.stopPropagation();
//     svg.transition().duration(750).call(
//       zoom.transform,
//       d3.zoomIdentity.translate(width / 2, height / 2).scale(40).translate(-x, -y),
//       d3.mouse(svg.node())
//     );
//   }
// }
// firstDirection = northSouth(currentRoute.views.data2),
//  lastDirection = northSouth(currentRoute.views.data3)
//
// function northSouth(lineString) {
//   return getQuadrant(turf.bearingToAzimuth(turf.bearing(turf.point(lineString.geometry.coordinates[0]),turf.point(lineString.geometry.coordinates[lineString.geometry.coordinates.length-1])))).slice(0,1);
// }
// if (bottomPad > 24 && ((firstDirection == "S" && longerEdge(this.bounds2) === "height" && boundsHeight(this.bounds2) > 4) || (lastDirection == "N" && longerEdge(this.bounds3) === "height" && boundsHeight(this.bounds3) > 4))) {
//   bottomPad *= 0.5;
// } else if (bottomPad > 24 && ((firstDirection == "N" && longerEdge(this.bounds2) === "height" && boundsHeight(this.bounds2) > 4) || (lastDirection == "S" && longerEdge(this.bounds3) === "height" && boundsHeight(this.bounds3) > 4))) {
//   bottomPad *= 1.25;
// }
