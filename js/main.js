(function () {

///////////////////////////
//// SETUP ENVIRONMENT ////
//// (global bindings) ////
///////////////////////////

//// INITIATE DATA LOAD

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

  var state0 = {}; // restorable?
  var experience = { initiated: false, animating: false, paused: false }
  var togglesOff = { info: false, select: false }
  var panned = { flag: false, transform: null, centerAdjust: null, i0: 0, i1: 0 }
  var transitionResume = false;
  var reversing = { flag: false, i: 0, t: null, tPad: null }

 // OTHER WORTHWHILE

  const miles = { units: "miles" }  // used repeatedly within turf.js method calls
  const tau = 2 * Math.PI;

//// KEEP ADJUSTABLE VARIABLES ACCESSIBLE: eventually some of these could be user-controlled via sliders and such

  var arcSteps = 500,  // how fine tuned SVG path animation
    headlightRadius = 2,
    trainPtRadius = 0.8,
    arcSpan = 0.16 * tau, // (in radians)
    tpm = 20,  // time per mile; hard-coded goal of animated ms per route mile (more == slower) *** I WANT THIS USER ADJUSTABLE BUT tFull uses it to set animation length at very begin, so not sure I can make this dynamic within current structure
    minT = tpm * 10,
    tPause = 2400,  // standard delay time for certain transitions
    viewFocusInt = 100,  // miles in/out to initially focus view, start/stop zoomFollow
    maxInitZoom = 18,  // hard coded scale seems to be widely appropriate given constant bufferExtent; ~12-18 good
    zoomDuration = tPause *2,  // zoom to frame transition duration
    zoomEase = d3.easeCubicIn,
    trainEase = d3.easeSinInOut,
    relativeDim = 0.4,  // dimBackground level; lower values => greater dim
    reverseCut = 2 // 12;

// AS YET EMPTY, ZERO, OR UNDEFINED

  var timer, reverseTimer;

  var patterns = {
    // eg "jupiter": CanvasPattern {}
  }

  var zoomAlongOptions = {};

  var prevTranslate, prevRotate, prevExtent, searchExtent;

  var transPt0,rotatePt0;

  var mm = 0, accumReset = 0, geoMM;

  var totalMiles, totalTime, minPerMile;

  var routeQuadtree;

  var firstIdentity, lastIdentity;

  // all unprojected: init bounds (ie continent), full route, first route frame, last route frame
  let data0, data1, data2, data3;

  var trainPt, headlights;

  var fullPath, fullLength, tFull;

  var zoomArc, zoomLength, tPad;

  var semiSimp, semiSimpLength;

  var labels = [];

  var routeDashInterpolator;

  var logBackgrounds = {
    // geomType: {
    //   complete: true || false,
    //   imgSrc: finalImgSrc
    // }
  };

// FUNCTION EXPRESSIONS

  var projectArray = function(unprojCoordArr) {
    return unprojCoordArr.map(d => (Array.isArray(d[0])) ? projectArray(d) : projection(d));
  }
  var cityState = d => {
    let region = d.state || d.province;
    return d.city + ", " + region;
  }

//// READY MAP

// SVG + SIZING

  var padX = 0, padY = -18;

  var initial = calcSize();

  var width = initial.width,
    height = initial.height,
    translate0 = [(width + padX)/2, (height + padY)/2],
    extent0 = [[(-width - padX)/2, (-height - padY)/2],[(width + padX)/2, (height + padY)/2]],
    paddedExtent0 = extent0.map(arr => arr.map(d => d * 1.2)),
    scale0 = 0.9;

  var svg = d3.select("#map").append("svg")
    .attr("id", "svg")
    .attr("width", width)
    .attr("height", height)
    .attr("preserveAspectRatio", "xMidYMid meet") // slice")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .on("click", togglePause)

  var hiddenSvg = d3.select("#map").append("svg")
    .attr("id", "hidden-svg")
    .attr("width",0)
    .attr("height", 0)

  var background = svg.append("rect")
    .attr("id", "background")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .classed("point-all opacity75 bg-lighten25 no-zoom",true)
    .on("dblclick", resetZoom)

  var g = svg.append("g")

  // define gradients & svg icons for later <use></use>
  var defs = svg.append("defs");

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

  // inject external SVG files into local svg element
  d3.xml('./assets/station.svg')
    .then(data => {
      // if svg path group stored as symbol element, can be appended directly to SVG (won't render until <use>d as needed)
      svg.node().append(d3.select(data).select("symbol").node())
      // defs.node().append(d3.select(data).select("g").node())
    })
  d3.xml('./assets/noun_train.svg')
    .then(data => {
      // if svg path group stored as symbol element, can be appended directly to SVG (won't render until <use>d as needed)
      svg.node().append(d3.select(data).select("symbol").node())
      // defs.node().append(d3.select(data).select("g").node())
    })

// PROJECTIONS & PATHS

  // EPSG:102010
  var projection = d3.geoConicEquidistant()
    .rotate([96,0])
    .parallels([20,60])
    .clipExtent(paddedExtent0);

  var reflectedY = d3.geoIdentity()
    .reflectY(true)

  var path = d3.geoPath().projection(projection),
      line = d3.line().curve(d3.curveCardinal.tension(0));

  var reflectedPath = d3.geoPath()
    .projection(reflectedY)

// PAN/ZOOM BEHAVIOR

  // SET UP ZOOM BUTTON CONTROL
  let zoomStep = 1,
    zoomLevels = [0,12],
   scaleExtent = [scale0*0.8, scale0*80],
    zoomScales = d3.scalePow()
     .exponent(3)
     .domain(zoomLevels)
     .range(scaleExtent)
     .interpolate(d3.interpolateRound)
     .clamp(true);

  d3.select("label#zoom").attr("value",scale0)
  d3.select("button#zoomIn")
    .on('click', zoomClick)
    .on('mouseenter', highlightBtn)  // triggering mouseover style changes programmatically remedies bug of #zoomIn's hover state being triggered concurrent to #zoomOut's
    .on('mouseleave', removeHighlight);
  d3.select("button#zoomOut")
    .on('click', zoomClick)
    .on('mouseenter', highlightBtn)
    .on('mouseleave', removeHighlight)

  var zoom0 = d3.zoomIdentity.translate(translate0[0],translate0[1]).scale(scale0);

  var active = d3.select(null);

  var zoom = d3.zoom()
    // .translateExtent(paddedExtent0)
    .scaleExtent(scaleExtent)
    .on("zoom", zoomed)
    .filter(() => {
      // dbl-clicking on background does not trigger zoom (actually resets it)
      return !(d3.event.type === "dblclick" && d3.event.path[0].classList.contains('no-zoom'))
    })

  svg.call(zoom.transform, zoom0) // keep this line first
     .call(zoom)

//// COLORS

  const palette = ['#94417f','#CD5C5C','#fa8253','#ec934a','#c7993f','#dbd99f']

  const paletteScale = chroma.scale(palette).domain([1,0]).mode('lch') //.correctLightness();

  const riverBlue = chroma("steelblue").alpha(0.8), // steelblue,cadetblue
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
      get width() { return width + padX; },
      get height() { return height + padY; },
      get extent0() { return [[-(width + padX)/2, -(height + padY)/2],[(width + padX)/2, (height + padY)/2]]; },
      get paddedExtent0() { return this.extent0.map(arr => arr.map(d => d * 1.2)) },
      get scale() { return scale0; },
      get translate0() { return translate0; },
      padTop: 60,
      padRight: 60,
      padBottom: 60,
      padLeft: 60
    },
    get boundsTransform() { return {...this.init, ...this.spec.bounds} },
    get centerTransform() { return {...this.init, ...this.spec.center} },
    get zoomFollow() { return {...this.init, ...this.spec.zoom} },
    spec: {
      bounds: { scalePad: 0 }, // 0.1 },
      center: {
        _padBottom: d3.select("#dash").node().clientHeight/4,
        get padBottom() { return this._padBottom },
        set padBottom(value) { this._padBottom = value; }
      },
      zoom: { scale: maxInitZoom }
    },
    quadtree: {
      projectX: d => projection(d.geometry.coordinates)[0],
      projectY: d => projection(d.geometry.coordinates)[1]
    }
  }

// MORE DATA, CATEGORY ASSIGNMENT, ETC

  let readyAndWaiting = {}; // IMPORTANT! will be populated with filtered enrich features and accessed as associated trigger pts encountered en route

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
  }

  let contentAssoc = {
    "modal-about": {
      btn: "info",
      opp: "get-options"
    },
    "get-options": {
      btn: "select",
      opp: "modal-about"
    }
  }

  let encounteredPts = new Set(),
    encounteredLines = new Set(),
    encounteredPolys = new Set(),
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
      textureProps: {d: "waves", background: lakeBlue, stroke: "mediumseagreen", thicker: 12, lighter: 8, shapeRendering: "crispEdges"},
      swatchAdjust: { thicker: 2, heavier: 6 }
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
      textureProps: {d: "nylon", thicker: 24, lighter: 24, shapeRendering: "crispEdges"},
      swatchAdjust: { thicker: 1, heavier: 1  }
      // no keywords; DESCRIPTION (?) === "Inventoried Roadless Area"
    },
    "GRASSLAND": {
      divId: "grassland",
      fullTxt: "Grasslands",
      textureType: "lines",
      textureProps: {thicker: 24, lighter: 24, orientation: "2/8"},
      swatchAdjust: { thicker: 2, heavier: 6  }
    },
    "VOLCANO": {
      divId: "volcanoes",
      fullTxt: "Volcanoes",
      textureType: "paths",
      textureProps: {d: "caps", thicker: 24, lighter: 24, shapeRendering: "crispEdges"},
      swatchAdjust: { thicker: 1, heavier: 8  }
      // no keywords; CATEGORY.startsWith("Volcano")
    },
    "GEOTHERMAL": {
      divId: "geothermal-areas",
      fullTxt: "Other Geothermal Areas",
      textureType: "lines",
      textureProps: {thicker: 24, lighter: 24, orientation: "6/8"},
      swatchAdjust: { thicker: 2, heavier: 6  }
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
      swatchAdjust: { thicker: 2, lighter: 0 },
      getStroke(d) {
        let description = d.properties.DESCRIPTION.toUpperCase();
        if (description.match("NATIONAL")) {
          return "rgba(76, 83, 91, .6)";
        } else if (description.match("STATE") || description.match("PROVINCIAL")) {
          return "rgba(76, 83, 91, .3)"
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
      textureProps: {d: "crosses", thicker: 24, lighter: 24, shapeRendering: "crispEdges"},
      swatchAdjust: { thicker: 1.2, lighter: 0 }
      // national, state, provincial, park, monument, etc matches will be disjoint from PA1 group above (matched only one keyword group, not both)
    },
    "PA3": {
      divId: "pa-grp3",
      fullTxt: "Protected Areas - Group 3",  // remaining
      weight: 3,
      textureType: "circles",
      textureProps: { complement: true, thicker: 48, lighter: 24 },
      swatchAdjust: { thinner: 18, lighter: 0, radius: 1, size: 8 }
      // textureProps: { complement: true, thicker: 36, lighter: 18 },
      // swatchAdjust: { thicker: 1, lighter: 0 }
      // no keywords; CATEGORY === "Protected Area" && DESCRIPTION !== "Inventoried Roadless Area"
    }
  },
         catKeys = Object.keys(enrichCats);

  let paTags = {  // protected area tags; not mutually exclusive with protected area categories, but mutually exclusive amongst each other; catalogued in order of first preference / weight
    "geo": {
      divId: "pa-geo",
      fullTxt: "Geothermal",  // or likely so
      keywords: ["geothermal", "geologic", "geological", "volcano", "volcanoes", "volcanic", "stratovolcano", "stratovolanic", "stratovolcanoes", "lava", "lavas", "dome", "domes", "cone", "cones", "cinder", "cinders", "maar", "maars", "caldera", "calderas", "tuff ring", "tuff rings", "pyroclastic", "geyser", "geysers", "hot spring", "hot springs", "hot well", "hot wells", "sulphur", "sulphuric", "boiling", "mount", "mt"].map(d => d.toUpperCase()),
      // kwSlimmed: [geo*, volcan*, strato*, lava*, dome*, cone*, cinder*, maar*, caldera*, tuff*, geyser*, pyro*, sulphur*, /^(hot)\s+/, /\s+(cone)\s*/],  // these regexes don't necessarily work yet!
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
      fullTxt: "Other - Primary",
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

// CUSTOM DISPATCH BEHAVIOR

  let dispatch = d3.dispatch("depart","encounter","arrive","reverse","unencounter","reverseArrived")
    .on("depart.train", departed)
    .on("encounter.trigger", encountered)
    .on("arrive.train", arrived)
    .on("reverse.train", reversed)
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
  initBounds.then(data => {
    data0 = topojson.feature(data,data.objects.bounds);
    projection.fitExtent(extent0,data0);
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
      .attr("id", "urban-mesh")
      .attr("d", path(urbanMesh))
      .attr("stroke","silver")
      .attr("fill","gainsboro")
      .style("stroke-width",0.1)
      .style("opacity",0.6)

    // STROKED MESH
    adminBase.append("path")
      .attr("id","country-mesh")
      .attr("d", path(countriesMesh))
      .style("fill","none")
      .style("stroke","yellowgreen")
      .style("stroke-width",0.6)

    adminBase.append("path")
      .attr("id","state-mesh")
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

    let stations = railBase.append("g")
      .attr("id", "rail-stations")
      .selectAll("use")
      .data(sourceData.stations.gj.features)
      .enter().append("use")
        .attr("xlink:href", "#station-icon")
        .attr("x", d => { return projection(d.geometry.coordinates)[0] - 1.6; })
        .attr("y", d => { return projection(d.geometry.coordinates)[1] - 2; })
        .attr("width", 3.2)
        .attr("height", 4)
        .property("name", d => { return cityState(d.properties); })
        .style("opacity", 0.8)
        .style("stroke-opacity", 0.6)
        .style("fill","lightsalmon")
        .style("stroke","indianred")
        .style("stroke-width","1px")
        .property("orig-opacity",0.8)
        .property("orig-stroke-opacity",0.6)
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

//// ON INITIAL LOAD

  function initPrompt() {
    adjustSize();
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

    // opt0 == from, opt1 == to

    let testOpt0 = opt0.split(', '),  // note space after comma
        testOpt1 = opt1.split(', ');

    // remove "CHI" (Chichuacame) as state to align with R2R returns
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
        Promise.all([processed]).then(function(received) {

           // collapse about pane // COMBAK: anyway to have svg preserveAspectRatio be "slice" in this moment only?
          collapse("about", collapseDirection(window.innerWidth))

          // readjust size since no "click" event fired on this particular #about collapse
          adjustSize()

          if (!experience.initiated) {
            initExp(received[0])
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
        .attr("opacity", 0)
        .on("end", function() {
          d3.select(this).classed("none", true)
        })

    d3.select("#map-init-load").attr("opacity",0).classed("none", false)
      .transition().duration(300)
        .attr("opacity", 1)

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
        inMiles = kmToMi(route.distance);

      let thisRoute = {
        from: raw.places[0],
        to: raw.places[1],
        totalDistance: inMiles,
        totalTime: route.totalTransitDuration, // not including transfers
        lineString: mergedGJ,
        segments: route.segments.map(storeSegmentDetails),
        allStops: raw.places,
        get relStops() {
          let stopSet = new Set();
          let toFromStns = this.allStops.filter(d => d.shortName.startsWith(this.from.shortName) && d.kind === "station" || d.shortName.startsWith(this.to.shortName) && d.kind === "station");
          toFromStns.forEach(d => {
            d.flagged = true;
            d.toFrom = (d.shortName.startsWith(this.to.shortName)) ? "to" : "from";
            stopSet.add(d);
          })
          this.segments.forEach(d => {
            stopSet.add(d.departing);
            stopSet.add(d.arriving);
          });
          return [...stopSet];
        },
        overallBearing: turf.bearing([raw.places[0].lng,raw.places[0].lat],[raw.places[1].lng,raw.places[1].lat]),
        arcPts: projectArray(truncateCoords(getSteps(arcSteps))),
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

        // non-optional quadtree binding
        bindQuadtreeData(routeQuadtree,true) // triggerPtFlag === true

      },onError)

      return chosen;

      function getIntersected([quadReps,quadBounds]) {

        // FIRST make a quadtree of all representative enrich data pts draped over North America

        let quadtreeData = topojson.feature(quadReps,quadReps.objects.searchReps).features.filter(d => d.geometry),
              dataExtent = topojson.feature(quadBounds,quadBounds.objects.bounds).features[0]

        let quadtree = makeQuadtree(quadtreeData,{bounding:dataExtent})

        let searchExtent = padExtent(path.bounds(chosen.bufferedRoute))  // add x padding to initial quadtree searchExtent to ensure initial filter sufficiently broad; uncomment below for visual

        let filteredEnrich = searchQuadtree(quadtree, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1])

        let possibleFeatures = new Set(filteredEnrich.map(d => d.properties.id));

        enrichPts.then(pts => {
          topojson.feature(pts, pts.objects.enrichPts).features.filter(d => { return possibleFeatures.has(d.properties.id) }).forEach(pt => {
            readyAndWaiting[pt.properties.id] = pt;
          })
        })
        enrichLines.then(lines => {
          topojson.feature(lines, lines.objects.enrichLines).features.filter(d => { return possibleFeatures.has(d.properties.id) }).forEach(line => {
            readyAndWaiting[line.properties.id] = line;
          })
        })
        enrichPolys.then(polys => {
          topojson.feature(polys, polys.objects.enrichPolys).features.filter(d => { return possibleFeatures.has(d.properties.id) }).forEach(poly => {
            readyAndWaiting[poly.properties.id] = poly;
          })
        })

        return possibleFeatures;

      }

    }

  }

//// INITIATE EXPERIENCE

  function initExp(receivedData) {

    experience.initiated = true;

    data1 = receivedData.lineString;

    Promise.resolve(prepareEnvironment(receivedData)).then(() => { // proceed

      let bounds = path.bounds(data1),
        boundsHeight = bounds[1][1] - bounds[0][1],
        boundsTransform = getTransform(bounds);  // first iteration used to get scale @ framed full route (k used to confirm not overzooming)

      let scale1 = Math.min(maxInitZoom,Math.ceil(boundsTransform.k)),
       bottomPad = (width < 640) ? d3.select("#dash").node().clientHeight/1.5 : (width >= 1200) ? d3.select("#dash").node().clientHeight / 3 : d3.select("#dash").node().clientHeight / 2.25,
         options = { scale: scale1, padBottom: bottomPad };

      let routeBoundsIdentity = getIdentity(getCenterTransform(path.centroid(data1),options));

      // control timing with transition start/end events
      svg.transition().duration(zoomDuration).ease(zoomEase)
        .call(zoom.transform, routeBoundsIdentity)
        .on("start", transitionIn)
        .on("end", () => {
          // confirm g transform where it should be
          g.attr("transform", routeBoundsIdentity.toString())
          // keep zoomClick btns in line
          d3.select("label#zoom").attr("value",routeBoundsIdentity.k)
          // pause to prepareUser, then initiate animation (incl zoom to firstFrame)
          prepareUser();
          d3.timeout(() => {
            onYourMarks(receivedData,routeBoundsIdentity);
          }, tPause);
        })

    })

    function prepareEnvironment(received) {

      let task1 = setupDash(received),
          task2 = setupEnrichLayers(),
          task3 = drawRoute(received);

      Promise.all([task1,task2,task3]).then(() => {
        return true;
      })

      function setupDash(received) {

        // store state0
        state0.dash = d3.select("#dash").node().innerHTML;

        // ROUTE SUMMARY
        // agency names & lines
        let agencies = [...new Set(received.segments.map(d => {
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
          .text(received.from.shortName)
        d3.select("#to").insert("span")
          .classed("flex-child",true)
          .text(received.to.shortName)
        d3.select("#via").insert("div")
          .html(agencyHtml)
          .attr("strokeStyle","dimgray")

        // WIDGETS
        initElevation()
        initOdometer()
        initClock()
        initCompass()

        // NARRATION
        // remove placeholder text from #encounters and change header text (for now)
        d3.selectAll(".placeholder").remove()
        d3.select("#narration-header").select("h5")
          .text("Currently passing:")

        return true;

        function exRedundant(lineName,agencyName){
          let regex = new RegExp(`${agencyName}\\s*`)
          return lineName.replace(regex,'').replace('Line','')
        }

        function initElevation() {

          getElevation([received.from.lng,received.from.lat]).then(elevation => {

            d3.select("#elevation").append("span")
              .attr("id","current-feet")
              .classed("flex-child txt-s txt-m-mxl txt-mono mx-auto",true)
              .text(elevation)

            d3.select("#elevation").append("span")
              .classed("flex-child txt-compact txt-xs txt-s-mxl mx-auto",true)
              .html("feet<br /> <abbr title='Above Sea Level' class='txt-abbr'>ASL</abbr>")
              .on("mouseover", function() {
                d3.select(this).append("div")
                  .attr("class","tooltip px6 pt6 pb3 bg-darken75 color-lighten75 z5 point-none")
                  .style("left", (d3.event.clientX + 6) + "px")
                  .style("top", (d3.event.layerY + 36) + "px")
                  .style("fill", "dimgray")
                  .style("stroke", "whitesmoke")
                  .style("opacity", 1)
                  .text("above sea level") // abbr default too delayed
              })
              .on("mouseout", function() {
                d3.select(this).selectAll(".tooltip").remove();
              })

          });

        }

        function initOdometer() {

          totalMiles = Math.round(received.totalDistance);

          d3.select("#total-miles").append("text")
            .text(`${totalMiles} miles`)

          d3.select("#odometer").append("span")
            .attr("id","current-miles")
            .classed("flex-child txt-s txt-m-mxl txt-mono mx-auto",true)
            .text("0")

          d3.select("#odometer").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl mx-auto",true)
            .html("miles<br> elapsed")

        }

        function initClock() {

          totalTime = Math.round(received.totalTime),  // in minutes
         minPerMile = totalTime / totalMiles;

          d3.select("#total-time").append("text")
            .text(`${totalTime} minutes`)

          d3.select("#clock").append("span")
            .attr("id","current-time")
            .classed("flex-child txt-s txt-m-mxl txt-mono mx-auto",true)
            .text("0")

          d3.select("#clock").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl mx-auto",true)
            .html("minutes<br> elapsed")

        }

        function initCompass() {

          let azimuth0 = getAzimuth(0);

          d3.select("#compass").append("span")
            .attr("id","current-bearing")
            .classed("flex-child txt-s txt-m-mxl txt-mono mx-auto mt-neg3",true)
            .text(azimuth0)

          d3.select("#compass").append("span")
            .classed("flex-child txt-compact txt-xs txt-s-mxl mx-auto",true)
            .text("degrees")

          d3.select("#compass").append("span")
            .attr("id", "current-quadrant")
            .classed("flex-child txt-xs txt-s-mxl mx-auto mt-neg3 mb-neg6",true)
            .text(getQuadrant(azimuth0))

        }

      }

      function setupEnrichLayers() {

        // enrich content groups
        const enrichLayer = g.append("g").attr("id","enrich-layer");

        enrichLayer.append("g").attr("id","enrich-polygons")
        enrichLayer.append("g").attr("id","enrich-lines")
        enrichLayer.append("g").attr("id","enrich-pts")

        return true;

      }

      function drawRoute(received) {

        var journey = g.append("g")
          .attr("id", "journey")
        var route = journey.append("g")
          .attr("id", "route")
        var train = journey.append("g")
          .attr("id", "train")

        let arcPts = received.arcPts; // shorthand; currently projected(?)

        // LINE/ROUTE

        // semiSimp path for headlights/eventual compass to follow
        semiSimp = getSimpRoute(turf.lineString(arcPts),0.5);
        let simpCoords = semiSimp.geometry.coordinates; // shorthand

        // bind (and optionally render) semiSimp line (currently using for later DOM access to path nodes within bearWithMe())
        journey.append("path")
          .attr("id", "semi-simp")
          .attr("d", line(simpCoords))
          .style("fill","none")
          // .style("stroke","slateblue")
          // .style("stroke-width","1px")

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

        // UNDERLYING TICKS/TIES
        let rrTies = route.append("g")
          .attr("id","rr-ties")
          .append("path")
          .attr("d", line(arcPts))
          .style("fill", "none")
          .style("stroke","gainsboro")
          .style("stroke-width",0.6)
          .style("stroke-dasharray", "0.1 0.2")

        // separately add relevant station points (those with stops) using R2R return data
        // journey.append("g")
        route.append("g").attr("id", "station-stops")
          .selectAll("use")
          .data(received.relStops)  // ignore first 2 elements, which are begin/end pts and represented elsewhere
          // .data(received.allStops.slice(2))  // ignore first 2 elements, which are begin/end pts and represented elsewhere
          .enter().append("use")
            .attr("xlink:href", "#station-icon")
            .attr("x", d => {
              let halfWidth = (d.flagged) ? 1.6 : 0.8;
              return projection([d.lng,d.lat])[0] - halfWidth;
            })
            .attr("y", d => {
              let halfHeight = (d.flagged) ? 2 : 1;
              return projection([d.lng,d.lat])[1] - halfHeight;
            })
            .attr("width", d => {
              let width = d.flagged ? 3.2 : 1.6;
              return width;
            })
            .attr("height", d => d.flagged ? 4 : 2)
            .style("opacity", 0) // initially
            .style("fill", d => !d.flagged ? "black" : (d.toFrom === "from") ? "green" : "red")
            .style("stroke", d => !d.flagged ? "dimgray" : "black")
            .style("stroke-width","0.4px")
            .property("name", d => d.shortName)
            .property("orig-opacity", 0.6)  // specified for mouseenter -> mouseout reset
            .property("orig-stroke-opacity",0.6)
            .on("mouseenter", onMouseenter)
            .on("mouseout", onMouseout)

        // make headlights!
        let radians0 = 0, // start with unrotated sector
            sector0 = getSector(radians0,headlightRadius),
            rotate0 =  getRotate(simpCoords[0],simpCoords[1]);

        // add headlights as DOM node (opacity transitions in from 0)
        var headlights = train.append("path")
          .attr("id", "headlights")
          .attr("d", sector0)
          .attr("transform", "translate(" + arcPts[0] + ") rotate(" + rotate0 +")")
          .style("fill","lightyellow") // linearGradient fading outward?
          .style("opacity", 0)
          .property("rotate0", rotate0)

        // BIG GUY: TRAIN POINT IN MOTION
        var point = train.append("use")
          .attr("xlink:href", "#train-icon")
          .attr("id","train-point")
          .attr("x", 0 - 3)
          .attr("y", 0 - 2)
          .attr("width", 6)
          .attr("height", 6)
          .style("fill","#222834")
        	.style("stroke-width", 1)
          .style("stroke","#682039")
          .style("opacity", 0) // initially
          .attr("transform", "translate(" + arcPts[0] + ") rotate(" + rotate0 + ")")

        return true;

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
          .on("end", function() {
            d3.select(this).remove();
          })

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

  function onYourMarks(routeObj,routeBoundsIdentity) {  // initAnimation

    // get zoomFollow object including simplified zoomArc (if applicable) and first/last zoom frames
    let zoomFollow = getZoomFollow(routeObj);

    // need to remain accessible for animate():
    tFull = tpm * zoomFollow.fullDist;
    trainPt = g.select("#train-point");
    headlights = g.select("#headlights");
    fullPath = g.select("#full-route");
    semiSimp = g.select("#semi-simp");
    if (zoomFollow.arc.length) {
      // bind zoomArc to DOM for tracking only (not visible)
      zoomArc = g.append("path")
        .attr("id", "zoom-arc")
        .datum(projectArray(zoomFollow.arc))
        .attr("d", line)
        .style("fill","none")
        .style("stroke","none")
        // // toggle below for visual of zoomArc
        // .style("stroke", "rebeccapurple")
        // .style("stroke-width",1)
      zoomLength = zoomArc.node().getTotalLength();
    }

    if (zoomFollow.necessary) {  // calculate transforms and timing from firstFrame to lastFrame (at initial zoomFollow scale)

      // first iteration used to get scale @ each identity (k averaged and used to confirm not overzooming)
      let bounds2 = path.bounds(data2),
          bounds3 = path.bounds(data3),
          boundsHeight2 = bounds2[1][1] - bounds2[0][1],
          boundsHeight3 = bounds3[1][1] - bounds3[0][1],
          boundsHeightAvg = (boundsHeight2 + boundsHeight3)/2,
          boundsTransform2 = getTransform(bounds2),
          boundsTransform3 = getTransform(bounds3);

      let zoomScale = Math.min(maxInitZoom,Math.ceil(Math.min(boundsTransform2.k,boundsTransform3.k))),
          bottomPad = (width < 640) ? (d3.select("#dash").node().clientHeight + boundsHeightAvg)/2 : (width >= 1200) ? (d3.select("#dash").node().clientHeight + boundsHeightAvg)/3.25 : (d3.select("#dash").node().clientHeight + boundsHeightAvg)/3;

      // store for getCenterTransform called without zoomAlongOptions
      defaultOptions.spec.center.padBottom = bottomPad;

      zoomAlongOptions = { ...defaultOptions.zoomFollow, ...{ scale: zoomScale*2, padBottom: bottomPad }};

      let p0 = zoomArc.node().getPointAtLength(0),
          p1 = zoomArc.node().getPointAtLength(zoomLength);

      // then calc final first/last frames at constant scale with center centered! (note diff fn call)
      firstIdentity = getIdentity(getCenterTransform([p0.x,p0.y],zoomAlongOptions))

      lastIdentity = getIdentity(getCenterTransform([p1.x,p1.y],zoomAlongOptions))

      tPad = zoomFollow.tpsm * zoomFollow.focus;  // use tpsm to delay zoomFollow until train hits mm <zoomFollow.focus>; tps(implified)m because focusPt is calculated from simplified route

    } else {
      firstIdentity = routeBoundsIdentity,
       lastIdentity = routeBoundsIdentity;
    }

    // final user prompt/countdown??
    // if (confirm("Ready?")) {
    getSet(); // initiate movement!
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

        // turf.along() sometimes returns same three coordinates for distance minus int * 2, distance minus int, & distance; also turf.along(fullLine,fullDist) !== last point of fullLine?; reversing instead!
        let fullSimpReversed = turf.lineString(zoomFollow.fullSimp.geometry.coordinates.slice().reverse());

        zoomFollow.firstThree = threePts(zoomFollow.fullSimp,zoomFollow.focus),

        zoomFollow.lastThree = threePts(fullSimpReversed,zoomFollow.focus).reverse();

        zoomFollow.arc = turf.lineSlice(zoomFollow.firstThree[1],zoomFollow.lastThree[1],zoomFollow.fullSimp).geometry.coordinates;

        // make sure firstLast focus coords align exactly with zoomFollow.arc start/stop (as returned by turf.lineSlice()); prevents stutter at moment of zoomAlong "takeoff"
        zoomFollow.firstThree[1] = zoomFollow.arc[0],
         zoomFollow.lastThree[1] = zoomFollow.arc[zoomFollow.arc.length-1];

        data2 = turf.lineString(zoomFollow.firstThree),
        data3 = turf.lineString(zoomFollow.lastThree);

      } else {

        // short route, first/last frames identical; no zoomAlong necessary
        zoomFollow.necessary = false;

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
    svg.transition().duration(t).ease(zoomEase)
      .call(zoom.transform, firstIdentity)
      .on("start", () => {
        // dim background layers
        if (reversing.i < 1) dimBackground(t/2)
        // expand dash automatically
        expand("dash","up")
        // prepare global values for animation coordination
        preanimate()
        // disable wheel-/mouse-related zooming while retaining manual pan ability
        svg.on("wheel.zoom",null)
        svg.on("scroll.zoom",null)
      })
      .on("end", () => {
        // keep zoom buttons up to date
        d3.select("label#zoom").attr("value",firstIdentity.k)
        // confirm g exactly in alignment for next transition
        g.attr("transform",firstIdentity.toString())
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
              // final pause, then go!
              d3.timeout(go, tPause);
            })
      })

    function dimBackground(t) {

      let dimMore = [d3.select("#continent-mesh"),d3.select("#railways").selectAll("path"),d3.select("#rivers").selectAll("path"),d3.select("#lake-mesh"),d3.select("#urban-mesh"),d3.select("#country-mesh")],
          dimLess = [d3.select("#state-mesh")];

      let dimGroup = dimMore.map(d => {
        return {
          selection: d,
          dimFactor: relativeDim
        }
      }).concat(dimLess.map(d => {
        return {
          selection: d,
          dimFactor: relativeDim * 2
        };
      }));

      dimGroup.forEach(group => {

        // access currentOpacity or default fallback
        let currentOpacity = group.selection.style("opacity") || group.selection.attr("globalAlpha") || 1;

        // update current opacity according to passed dimFactor
        group.selection.transition().duration(t)
          .style("opacity", currentOpacity * group.dimFactor)

      })

    }

  }

  function go() {
    // kick off glboal timer (within depart())
    dispatch.call("depart") // , this);
  }

  function animate(elapsed) {

    if (reversing.flag) {
      // timer countDOWN
      elapsed = reversing.t - elapsed;
      // // watch for animation end
      // if (elapsed < 0) {
      //   reverseTimer.stop();
      //   reversing.flag = false;
      //   // reversing.stop = true;
      //   // avoid slight tracker disconnects at end
      //   d3.select("#current-miles").text("0")
      //   d3.select("#current-time").text("0")
      //   // prepare to restart animation from beginning
      //   d3.timeout(getSet(true),tPause * 12); // again = true; ensure quadtree encounters only triggering reveal, not readding to dom
      //   return;
      // }
      // zoomFollow if necessary
      if (zoomArc && elapsed <= reversing.t - reversing.tPad && elapsed >= reversing.tPad) zoomAlong(elapsed,reversing.t,reversing.tPad);
    } else {  // not reversing
      // // watch for animation end
      // if (elapsed > tFull) {
      //   timer.stop();
      //   // signal train arrival
      //   dispatch.call("arrive"); // , this);
      //   return;
      // }
      // zoomFollow if necessary
      if (zoomArc && elapsed >= tPad && elapsed <= tFull-tPad) zoomAlong(elapsed);
    }

    // regardless of animation direction (forward/back)
    // call another move event
    trainMove(elapsed)
    // update dash trackers
    trackerUpdate(getMM(elapsed))

    // watch for animation end
    if (!reversing.flag && elapsed > tFull) {
      dispatch.call("arrive");
    } else if /* reversing && */ (elapsed < 0) {
      dispatch.call("reverseArrived");
    }

    function zoomAlong(elapsed, t1 = tFull, tP = tPad) {
      let transform = getZoomAlongTransform(elapsed,t1,tP);
      svg.call(zoom.transform, getIdentity(transform))
    }

  }

  function getZoomAlongTransform(elapsed,t1,tP) {
    // KEEP TRAIN NODE IN CENTER-ISH OF FRAME @ CURRENT ZOOM LEVEL K
    // for zoomAong between t0,t1 to get eased t between 0,1

    // get eased point at length
    let simpT = d3.scaleLinear().domain([tP,t1-tP]),
        simpL = t => trainEase(t) * zoomLength,
            l = simpL(simpT(elapsed)),
            p = zoomArc.node().getPointAtLength(l);

    // if user has manually panned since animation start, offset zoomAlong center by translate values
    if (panned.flag) {
      // calculate new centerAdjust if new or in-progress pan event; otherwise, use most recently calculated centerAdjust value
      if (panned.i1 > panned.i0) {

        panned.i0++;

        pauseAnimation();

        // get current transform?
        // let translateMatrix = g.node().transform.animVal[0].matrix,
        //         scaleMatrix = g.node().transform.animVal[1].matrix,
        //    currentTransform = { k: scaleMatrix.a, x: translateMatrix.e, y: translateMatrix.f },
        //       currentCenter = getCenterFromTransform(currentTransform);

        // get current center pt by working backwards through centerTransform() from stored panned.transform
        let currentCenter = getCenterFromTransform(panned.transform);

        // get difference btween p and currentCenter
        panned.centerAdjust = [currentCenter[0] - p.x, currentCenter[1] - p.y];

        // resume again!
        if (!experience.manuallyPaused) resumeAnimation();

      }
      // once any pan event on record, adjust center according
      p.x += panned.centerAdjust[0],
      p.y += panned.centerAdjust[1];
    }

    zoomAlongOptions.scale = +d3.select("label#zoom").attr("value");

    // calculate translate necessary to center data within extent
    return getCenterTransform([p.x,p.y],zoomAlongOptions);

  }

////////////////////////////////////////////////
///// EVENT LISTENERS & VISUAL AFFORDANCES /////
////////////////////////////////////////////////

// CLICK EVENTS
  d3.select("#about-down").on("click", function() {
    d3.select(this).classed("manual-close",true);
  })

  // Crucial button functionality (migrated from inline html)
  d3.select("#submit-btn").on("click",function() {
    d3.event.preventDefault();
    d3.select("#submit-btn-txt").classed("none",true);
    d3.select("#submit-btn-load").classed("none",false);
    onSubmit(this.form.getOption0.value,this.form.getOption1.value);
  })
  d3.select("#select-new").on("click", () => selectNew())
  d3.select("#info-btn").on("click", () => toggleModal("modal-about"))
  d3.select("#dash-expand-btn").on("click", () =>  expand("dash","up"))
  d3.select("#dash-collapse-btn").on("click", () =>  collapse('dash','down'))
  d3.select("#modal-close-btn").on("click", () =>  toggleModal())
  d3.select("#about-up-btn").on("click", () => expand('about','up'))
  d3.select("#about-left-btn").on("click", () => expand('about','left'))
  d3.select("#about-down-btn").on("click", () => collapse('about','down'))
  d3.select("#about-right-btn").on("click", () => collapse('about','right'))

  // setup event listener on modal open
  d3.select(window).on("dblclick", function() {
    // if modal is open and click target is NOT within modal
    if (!(d3.select("#modal").classed("none")) && !d3.event.target.closest("#modal")) {
      toggleModal()  // toggle close
    }
  })

// LOAD EVENTS
  d3.select(window).on("load", function () {
    initPrompt();
  });

// RESIZE EVENTS
  d3.select(window).on("resize.map", adjustSize)
  d3.select("#about-expand").on("click", adjustSize)
  d3.select("#about-collapse").on("click", adjustSize)

// FORMS & FIELDS
  d3.select("#get-options").on("focus", function (e) { e.target.style.background = "palegoldenrod" })
                                .on("blur", function (e) { e.target.style.background = "#fafafa" })

//////////////////////////
///// MORE FUNCTIONS /////
//////////////////////////

//// LAYOUT

  function adjustSize() {

    if (experience.animating && !experience.paused) pauseAnimation();

    // get updated dimensions
    let updated = calcSize();

    // update/apply new values
    width = updated.width;
    height = updated.height;
    translate0 = [(width + padX)/2, (height + padY)/2],
    extent0 = [[(-width - padX)/2, (-height - padY)/2],[(width + padX)/2, (height + padY)/2]],
    paddedExtent0 = extent0.map(arr => arr.map(d => d * 1.2));

    // apply as new svg attributes
    svg.attr("width", updated.width)
       .attr("height", updated.height)

    projection.clipExtent(paddedExtent0);

    // constrain zoom behavior (scale)
    // zoom.translateExtent(paddedExtent0)

    if (experience.animating && !experience.manuallyPaused) resumeAnimation();

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
          d3.select("#about").classed("disappear-down",false)
                             .classed("disappear-right",true)
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

      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#footer").node().clientHeight;

      calculated.width = window.innerWidth - d3.select("#aside").node().clientWidth;

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
      calculated.height = window.innerHeight - d3.select("#header").node().clientHeight - d3.select("#aside").node().clientHeight - d3.select("#footer").node().clientHeight;

      calculated.width = d3.select("#about-plus").node().clientWidth;

    }

    return calculated;

  }

  function collapseDirection(width) {
    return (width > 1199) ? "right" : "down";
  }

//// IMGS

  // async function srcToImg(src) {
  //   let img = new Image();
  //   img.src = src;
  //   let promise = new Promise((resolve, reject) => {
  //     img.onload = () => resolve({img, status: 'ok'});
  //   });
  //   let result = await promise;
  //   return result.img;
  // }

  // function imgToPattern(img, ctx = context) {
  //   return ctx.createPattern(img,'repeat');
  // }

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

  function truncateCoords(coords,precision = 5) {
    return coords.map(d => turf.truncate(turf.point(d),{precision:precision,mutate:true}).geometry.coordinates);
  }

//// ZOOM BEHAVIOR
  function togglePause() {
    if (experience.animating && !experience.paused) {
      manualPause()
    } else if (experience.animating && experience.manuallyPaused) {
      resumeAnimation();
    }
  }

  function zoomed() {

    var transform = d3.zoomTransform(this);

    let tk = transform.k,
        tx = transform.x,
        ty = transform.y;

    // minZ = 1 / tk / tk;

    g.attr("transform", "translate(" + tx + "," + ty + ") scale(" + tk + ")");

    g.style("stroke-width", 1 / (tk * tk) + "px");

    // keep zoom buttons up to date
    d3.select("label#zoom").attr("value", tk)

    if (d3.event.sourceEvent && experience.animating && !experience.manuallyPaused) {
      // if user pans while animation actively underway, respect as readjustment of zoomAlong view (since d3.event.sourceEvent specified for wheel and mouse events only, and since wheel.zoom disabled while !experience.paused, user must be panning).

      if (!experience.paused) pauseAnimation();

      panned.flag = true,
      panned.transform = transform;
      ++panned.i1;

      if (!experience.manuallyPaused) resumeAnimation();

    } else if (d3.event.sourceEvent && experience.initiated && d3.event.sourceEvent.type === "mousemove") {
      // if user pans while animation was manually paused, flag to svg.transition().call(d3.zoomTransform, nextZoomFrame)
      transitionResume = true;
    }

  }

  function zoomClick() {

    if (experience.animating && !experience.paused) pauseAnimation();

    // this.parentNode holds stable zoom value shared by both zoomIn and zoomOut buttons
    let oScale = +d3.select(this.parentNode).attr("value"),
         oStep = +zoomScales.invert(oScale).toFixed(2);

    // if oStep already clamped at min/max, offer visual feedback (little shake) that zoom limit reached
    if (oStep === zoomLevels[0] || oStep === zoomLevels[1]) {

      d3.select(this).classed("limit-reached",true)
      d3.timeout(() => {
        d3.select(this).classed("limit-reached",false);
      }, 300);

    } else {

      let direction = (this.id === "zoomIn") ? 1 : -1,
            newStep = oStep + zoomStep * direction,
           newScale = zoomScales(newStep);

      // then store new value and apply new zoom transform
      d3.select(this.parentNode).attr("value", newScale);

      // get current transform
      let currentTransform = d3.zoomTransform(svg.node())
      // get current center pt by working backwards through centerTransform() from current transform
      let centerPt = getCenterFromTransform(currentTransform);
      // get identity of centered transform at new zoom level
      let zoom1 = getIdentity(getCenterTransform(centerPt,{scale:newScale}));

      svg.transition().duration(400).ease(zoomEase)
         .call(zoom.transform, zoom1)
         .on("end", () => {
           g.attr("transform", zoom1.toString())
         })

    }

    if (experience.animating && !experience.manuallyPaused) resumeAnimation();

  }

  function getCenterFromTransform(transform,options) {
    // get current center by working backwards through centerTransform() from current transform

    let opts = {...defaultOptions.centerTransform, ...options};

    let x = ((transform.x - opts.translate0[0]) / -transform.k) - opts.padRight + opts.padLeft,
        y = ((transform.y - opts.translate0[1]) / -transform.k) - opts.padBottom + opts.padTop;;

    return [x,y];

  }

  function getTransform(bounds, options) {

    let opts = {...defaultOptions.boundsTransform, ...options};

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
    b0[0] -= opts.padLeft,
    b0[1] -= opts.padTop,
    b1[0] += opts.padRight,
    b1[1] += opts.padBottom;

    let dx = b1[0] - b0[0],  // domain x (input)
        dy = b1[1] - b0[1];  // domain y (input)

    // let k = (1 - opts.scalePad) / Math.max(dx / width, dy / height),  // Math.max() determines which dimension will serve as best anchor to provide closest view of this data while maintaining aspect ratio
    let k = +((1 - opts.scalePad) * Math.max(width/dx, height/dy)).toFixed(4),
        x = b1[0] + b0[0], // xMax (b1[0]) + xOffset (b0[0])
        y = b1[1] + b0[1]; // yMax (b1[1]) + yOffset (b0[1])

    // calculate translate necessary to center data within extent
    let tx = (width - k * x) / 2,
        ty = (height - k * y) / 2;

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
    // returns transform centering point at predetermined scale

    let opts = {...defaultOptions.centerTransform, ...options};

    x = x + opts.padRight - opts.padLeft
    y = y + opts.padBottom - opts.padTop

    let tk = opts.scale,
        tx = -tk * x + opts.translate0[0],
        ty = -tk * y + opts.translate0[1];

    return {x: tx, y: ty, k: tk};

  }

  function resetZoom() {

    active.classed("active", false);
    active = d3.select(null);

    svg.transition().duration(800).ease(zoomEase)
      .call(zoom.transform, zoom0)

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
      .classed("quadtree-data", true)

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

            // for flagged, en route trigger-pts only
            if ((g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).node()) && (g.selectAll(".quadtree-data").select(`.quad-datum.${d.properties.id}`).classed("trigger-pt"))) {

              if (reversing.flag && uniqueEncounters.has(d.properties.id)) {
                dispatch.call("unencounter", d)
              } else if (!reversing.flag && !uniqueEncounters.has(d.properties.id)) {
                uniqueEncounters.add(d.properties.id)
                dispatch.call("encounter", d)
              }

            }

            selected.push(d)

            // // immediately remove triggerPt and all others associated with same feature ID from remaining search pool to avoid wasting energy on retriggers // COMBAK omit this for reset()?
            // let toRemove = quadtree.data().filter(q => {
            //   return q.properties.id === d.properties.id;
            // })
            // quadtree.removeAll(toRemove)

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
    semiSimpLength = semiSimp.node().getTotalLength();

    transPt0 = fullPath.node().getPointAtLength(0);
    rotatePt0 = semiSimp.node().getPointAtLength(0);

    eased = (t, t1 = tFull) => trainEase(t/t1);
    routeDashInterpolator = d3.interpolateString("0," + fullLength, fullLength + "," + fullLength);

    // setup searchExtent for headlights intersecting quadtree reps
    let sectorBBox = headlights.node().getBBox(),
          arcWidth = sectorBBox.width,
         arcHeight = sectorBBox.height, // ADJUSTABLE FOR NON-VISIBLE EXTENSION OF SEARCH EXTENT
           rotate0 = headlights.property("rotate0") || 0;

    // calculate initial search extent for quadtree
    let sectorExtent = [[-arcWidth/2,-arcHeight],[arcWidth/2,0]],
    translatedExtent = translateExtent(sectorExtent,transPt0.x,transPt0.y);

    // searchExtent is sector (headlight) extent translatedThenRotated
    searchExtent = rotateExtent(translatedExtent,rotate0,[transPt0.x,transPt0.y]);

    // save newly determined values as previous values
    prevTranslate = [transPt0.x,transPt0.y];
       prevExtent = searchExtent;
       prevRotate = rotate0;

  }

  function trainMove(t) { // called by animate() following dispatch

    if (t < 0 || t > tFull) return;

    // calculate new position
    let trainTransform = getTrainTransformAt(t),
      currentTranslate = [trainTransform.x, trainTransform.y],
         currentRotate = trainTransform.r;

    if (reversing.flag && t !== reversing.t) {  // keep train/headlights rotated toward destination when reversing in progress
      currentRotate = (currentRotate < 180) ? currentRotate + 180 : currentRotate - 180;
    }

    let transformString = "translate(" + currentTranslate[0] + "," + currentTranslate[1] + ") rotate(" + currentRotate + ")";

    // train moves along route
    trainPt.attr("transform", transformString);
    // was translateAlong(fullPath,fullT,elapsedT) // goTrain

    // headlights simulate search for triggerPts
    headlights.attr("transform",transformString);
    // was bearWithMe(fullPath,semiSimp,rotate0,fullT,elapsedT) // lightSearch

    // traversed path illuminated with color as train progresses
    fullPath.style("opacity",1)
    fullPath.style("stroke-dasharray",routeDashInterpolator(eased(t)))
    // was tweenDash2(fullPath,fullT,elapsedT) // unfurlPath

    // get adjusted quadtreeRep searchExtent on each trainMove
    let dx = currentTranslate[0] - prevTranslate[0],
        dy = currentTranslate[1] - prevTranslate[1];

    let translatedExtent = translateExtent(prevExtent,dx,dy),
             rotateDelta = currentRotate - prevRotate;

    searchExtent = rotateExtent(translatedExtent,rotateDelta,currentTranslate)

    // SEARCH EXTENT VIS
    // g.append("rect")
    //   .attr("x", searchExtent[0][0])
    //   .attr("y", searchExtent[0][1])
    //   .attr("width", searchExtent[1][0] - searchExtent[0][0])
    //   .attr("height", searchExtent[1][1] - searchExtent[0][1])
    //   .style("fill","tomato")
    //   .style("opacity", 0.6)
    //   .transition().delay(800).duration(400)
    //     .style("opacity", 0)

    // save newly determined values as previous values
    prevTranslate = currentTranslate;
       prevExtent = searchExtent;
       prevRotate = currentRotate;

    // initiate quadtree search
    searchQuadtree(routeQuadtree, searchExtent[0][0], searchExtent[0][1], searchExtent[1][0], searchExtent[1][1]);

  }

  function getTrainTransformAt(t) { // INCL ROTATE

    // called with two selections because headlights rotate according to semi-simplified path for smoother interpolator, while translating along full path to ensure alignment with trainPt itself
    let l0 = eased(t) * fullLength,
        l1 = eased(t) * semiSimpLength;

    let transPt1 = fullPath.node().getPointAtLength(l0),
       rotatePt1 = semiSimp.node().getPointAtLength(l1);

    let rotate = (rotatePt0.x !== rotatePt1.x) ? getRotate(rotatePt0,rotatePt1) : prevRotate; // || rotate0?

    // shift pt values pt0 >> pt1
    transPt0 = transPt1;
    rotatePt0 = rotatePt1;

    return { x: transPt1.x, y: transPt1.y, r: rotate }; // NOTE R, NOT K

  }

  function departed() {
    // track state
    experience.animating = true;
    // show play-pause btn
    d3.select("#play-pause")
      .classed("none",false)
      .property("disabled", false)
      .text("II")
      .on("click.pause", pauseAnimation)
      .on("click.play", null)
    // start global timers
    d3.timerFlush();
    timer = d3.timer(animate);
    // output elsewhere?
    console.log("train departing @ " + d3.now())
  }

  function arrived() {

    // stop animation
    timer.stop()

    // reset several state variables
    experience.animating = false;
    experience.paused = false;
    experience.manuallyPaused = false;
    experience.pausedAt = null;

    // inform d3 zoom behavior of final transform value (transition in case user adjusted zoom en route)
    svg.transition().duration(zoomDuration).ease(zoomEase)
      .call(zoom.transform, lastIdentity)
    // re-allow free zooming
    svg.call(zoom)

    // avoid slight tracker disconnects at end
    let finalCoords = geoMM[geoMM.length - 1];
    getElevation(finalCoords).then(elevation => {
      d3.select("#current-feet").text(elevation)
    });
    let finalAzimuth = getAzimuth(geoMM.length - 1);
    d3.select("#current-bearing").text(finalAzimuth)
    d3.select("#current-quadrant").text(getQuadrant(finalAzimuth))
    // miles and clock too
    d3.select("#current-miles").text(totalMiles)
    d3.select("#current-time").text(totalTime)

    // update play-pause btn
    d3.select("#play-pause")
      .text('\u21BB')
      .on("click.replay",replayAnimation)
      .on("click.play",null)
      .on("click.pause",null)
      // .property("disabled", true); // no need to hide completely

    // output elsewhere?
    console.log("train arrived @ " + d3.now())
    console.log("unique encounters",uniqueEncounters.size)

  }

  function reverseArrived() {

    // stop animation
    reverseTimer.stop();
    reversing.flag = false;

    // avoid slight tracker disconnects at end
    d3.select("#current-miles").text("0")
    d3.select("#current-time").text("0")

    // reenable and update play-pause btn
    d3.select("#play-pause")
      .html("")
      .text('\u25BA') // Play
      .on("click.replay",null)
      .on("click.play",getSet)
      .on("click.pause",null)
      .classed("px6 px12-ml",true)
      .classed("px3 px6-ml",false)
      .property("disabled",false)

    // automatically restart animation from beginning?
    d3.timeout(getSet(true),tPause * 12); // again = true; ensure quadtree encounters only triggering reveal, not readding to dom

  }

  function replayAnimation() {
    // update play-pause icon
    d3.select("#play-pause")
      .text('')
      .on("click.play",null)
      .on("click.pause",null)
      .on("click.replay",null)
      .property("disabled",true)
      .classed("px6 px12-ml",false)
      .classed("px3 px6-ml",true)
      .html(`
        <div id="testid" class="h-full w-full flex-parent flex-parent--center-cross flex-parent--center-main">
          <span class="flex-child loading loading--s point-none horz-flip"></span>
        </div>
      `)

    // confirm at final identity
    svg.transition().duration(750).ease(zoomEase)
      .call(zoom.transform, lastIdentity) // may already be here
      .on("start", () => {
        // prereverse() to adjust select values stored during preanimate();
        eased = (t, t1 = reversing.t) => trainEase(t/t1);
        prevExtent = [[prevExtent[0][0]-2,prevExtent[0][1]-2],[prevExtent[1][0]+2,prevExtent[1][1]+2]];
      })
      .on("end",() => {
        dispatch.call("reverse")
      })
  }

  function reversed() {

    // track state
    reversing.flag = true;
    reversing.i++;
    reversing.t = Math.ceil(tFull / reverseCut);
    reversing.tPad = zoomArc ? tPad / reverseCut : null;

    for (var geomType in geomAssoc) {
      geomAssoc[geomType].reverseT = Math.floor(reversing.t /  geomAssoc[geomType].set.size);
    }

    // start global timers
    // d3.timerFlush();
    let delay = 0,
         time = d3.now();
    reverseTimer = d3.timer(animate, delay, time);

    // quadtree with trigger appropriate 'unreveal' action via dispatch to unencountered() while reversing.flag

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
        gj = readyAndWaiting[id], // get associated feature
      baseT;

    if (!gj) console.log(this) // py508, py12, py51, py315

    // get and save logGroup/category and protected area tags
    let geomType = id.slice(0,2),
        logGroup = getGroup(gj),
          subTag = getTag(gj,logGroup);

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

        if (gjA.geometry.coordinates.length) revealLine(gjA,baseT)
        if (gjB.geometry.coordinates.length) revealLine(gjB,baseT)

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
        return canvasWithMirror; // need only be "true"?

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
          .classed("enrich-pt",true)
          .attr("id", d => d.properties.id)
          .attr("r",0.1)
          .attr("cx", d => projection(d.geometry.coordinates)[0])	          .attr("cy", d => projection(d.geometry.coordinates)[1])
          .property("name", formatName)
          .property("category", d => d.properties.CATEGORY)
          .property("description", d => d.properties.DESCRIPTION)
          .property("more-info", d => d.properties.MORE_INFO)
          .property("log-group", d => d.properties.logGroup)
          .property("sub-tag", d => d.properties.subTag)
          .property("orig-opacity", ptOpacity)
          .property("orig-stroke-opacity", ptStrokeOpacity)
          .style("stroke", "whitesmoke")
          .style("stroke-width", "0.05px")
          .style("opacity", 0)
          .style("stroke-opacity", 0)
          .call(async enter => {
            let fill = await getFill(enter.datum());
            if (fill.key) { // typeof fill === "Object"
              enter.attr("patternKey",fill.key)
              enter.classed("patterned",true)
              enter.style("fill", patterns[fill.key].url)
            } else {
              enter.style("fill", fill)
            }
            enter.transition().duration(t)
              .attr("r", d => d.properties.orig_area * 0.00000002 || 0.1)
                // size of circle is a factor of planar (why did i do it this way?) area of polygon the circle is representing, or 0.1 minimum
              .style("opacity", 1)    // COMBAK: aim for initial glow effect
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

  function revealLine(gj,baseT) {

    let t = Math.max(minT,baseT * tpm),
      lineOpacity = 0.8;

    encounteredLines.add(gj)

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
                    .style("fill", "none") // default
                    .style("stroke", getStroke)
                    .style("fill", "none") // default
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

      newLine.transition().duration(t).ease(d3.easeCubicOut)
        .styleTween("stroke-dashoffset",drawDashed)

    } else {

      newLine.transition().duration(t).ease(d3.easeCubicOut)
        .styleTween("stroke-dasharray",tweenDash)

    }

    if (!gj.properties.id.includes("-")) output(newLine)  // don't output partial geometries

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
          .classed("enrich-polygon",true)
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
          .property("hover-opacity", d => Math.min(0.9,+Math.max(0.5,polyOpacity(d) * 1.5).toFixed(2)))
          .style("stroke", getStroke)
          .style("stroke-width", getStrokeWidth)
          .style("stroke-opacity", polyStrokeOpacity)
          .style("opacity", 0)
          .call(async enter => {
            let fill = await getFill(enter.datum());
            if (fill.key) { // typeof fill === "Object"
              enter.attr("patternKey",fill.key)
              enter.classed("patterned",true)
              enter.style("fill", patterns[fill.key].url)
            } else {
              enter.style("fill", fill)
            }
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
              col = geomAssoc[geomType].encounterCol,
               gj = readyAndWaiting[featureId],
                t = geomAssoc[geomType].reverseT;

    uniqueEncounters.delete(featureId);
    geomAssoc[geomType].set.delete(gj);

    let feature = d3.select(geomAssoc[geomType].groupId).select(`#${featureId}`)

    if (feature && feature.node()) {

      switch(geomType) {
        case "pt":
          feature.transition().duration(t)
          .attr("r",0.1)
          .on("end", () => {
            feature.remove();
          })
          break;
        case "ln":
          if (feature.property("category") === "Watershed") {
            feature.transition().duration(t).ease(d3.easeCubicIn)
              .styleTween("stroke-dashoffset", clearDashed)
              .on("end", () => feature.remove())
          } else {
            feature.transition().duration(t).ease(d3.easeCubicIn)
              .styleTween("stroke-dasharray", clearSolid)
              .on("end", () => feature.remove())
          }
          break;
        case "py":
          feature.transition().duration(t)
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

  function output(encountered) {

    let darkText = "#333",
       lightText = "#ddd";

    if (encountered.property("name")) {

      // get encountered group A, B, or C
      let col = geomAssoc[encountered.property("id").slice(0,2)].encounterCol;

      allEncounters[col].unshift(encountered) // array of selections

      updateOutput(allEncounters[col].slice(),col)

      log(encountered)

      function updateOutput(encounters,col) { // allEncounters) {
        // https://observablehq.com/@d3/selection-join

        const t = d3.transition().duration(750)

        // HOW TO SMOOTH OUT SCROLL?
        d3.select(`#encounters-${col}`).selectAll(".encounter")
          .data(encounters, d => d.property("id"))
          .join(
            enter => enter.append("div")
              .classed("flex-child encounter txt-compact mx3 my3 px6 py6", true)
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

          let symbol = styleToSymbol(encountered,group,padLeft),
            symbolId = (encountered.property("sub-tag") ?
              encountered.property("sub-tag").divId
            : encountered.property("log-group").divId) + "-sym";

          symbolSet.add(symbolId)

          let newItem = d3.select(`#${parentDivId}`).append("div")
            .classed("flex-child flex-child--grow flex-child--no-shrink hmin18 hmin24-mm legend-log-item relative",true)
            .html(getLogHtml(group,symbolId,isParent))
            .style("opacity", 0)  // initially

          // when child element, ensure caret-toggle of parent group is visible
          if (!isParent) d3.select(`#${parentDivId}`).classed("hide-triangle",false).classed("show-triangle",true)

          // transition whole item into full opacity
          newItem.transition().duration(300)
            .style("opacity", 1)

          // add fill to new HTML element within newItem
          let swatch = newItem.select(`#${symbolId}`)

          // then iterate through keys
          Object.keys(symbol.styles).forEach(key => {
            swatch.style(key, symbol.styles[key]);
          })

          if (symbol.src) {
            swatch.style("background-image", `url(${symbol.src})`) // avoids [object Object]
          }

          function getLogHtml(group,fillId,isParent) {

            let initCount = 1,
              s = (padLeft > 0) ? 18 : 24;

            let html,
              innerHtml = `<span id="${fillId}" class="flex-child flex-child--no-shrink h${s} w${s} log-symbol"></span>
              <label class="flex-child flex-child--grow log-name px3">${group.fullTxt}</label>
              <span id="${group.divId}-count" class="flex-child flex-child--no-shrink log-count">${initCount}</span>`

            if (isParent) {
              html = `<details id="${group.divId}" class="flex-parent flex-parent--column hide-triangle">
                <summary class="flex-parent flex-parent--space-between-main flex-parent--center-cross border-t border-b border--dash hmin24">
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

          function styleToSymbol(encountered,group,padLeft) {
            // element will already be styled appropriately at this point; turn style to symbol (not all will require textures!)

            let symbol = {
              styles: {
                background: encountered.attr("fillStyle") || encountered.style("fill"),
                color: encountered.attr("strokeStyle") || encountered.style("stroke"),
                opacity: encountered.style("orig-opacity") || 1
              }
            }

            if (encountered.property("category") === "Ecoregion") {
              return symbol;
            }

            if (["#000","#000000","rgb(0,0,0)","rgba(0,0,0,0.75)","rgb(0, 0, 0)","black","none"].includes(symbol.styles.background)) {
              symbol.styles.background = "#e1e2e2"
            }

            let keyBase = (encountered.classed("patterned")) ? encountered.attr("patternKey") : encountered.property("category").toLowerCase() + "-" + encountered.attr("id"),
                    key = keyBase + "-swatch";

            if (!patterns[key] || encountered.property("category") === "Watershed") {

              let texture = processTexture(encountered,true,padLeft); // swatchFlag == true;
              symbol.src = assignPattern(texture,key,true).src; // swatchFlag == true;

            } else {
              symbol.src = patterns[key].src
            }

            return symbol;

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

    let coordsNow = geoMM[i], // || geoMM[i-1] || geoMM[i-2],
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

  function getAzimuth(i) {  // returns rounded value in degrees of azimuth bearing between two unprojected pts

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
          adjustSize()
          isTogglable(subContent,true) // only info btn toggles modal open and closed
        } else {  // subContent === "getOptions"
          d3.select("#select-new").property("disabled", true); // disable select-new btn while getOptions form is open
        }
      }
      d3.select("#veil").classed("none", false);
      d3.select("#modal").classed("none", false);
    } else {  // modal currently open
      // if toggling closed with close button (!subContent) or re-clicking subContent button recently used to open modal
      if (!subContent || (subContent && isTogglable(subContent))) {
        // basic close
        d3.select("#modal").classed("none", true);
        d3.select("#veil").classed("none", true);
        d3.select("#get-options").classed("none", true)
        d3.select("#modal-about").classed("none", true)
        d3.select("#select-new").property("disabled", false);
        if (subContent) {
          isTogglable(subContent,false)
        }
      } else {  // subContent && (!isTogglable(subContent))
        // user wants to switch modal subContent with modal open
        if (d3.select(`#${subContent}`).classed("none")) {
          // open user selected subContent via switch
          let nowOpen = contentAssoc[subContent].opp
          d3.select(`#${subContent}`).classed("none",false)
          d3.select(`#${nowOpen}`).classed("none",true)
          isTogglable(subContent,true)
          isTogglable(nowOpen,false)
          if (subContent === "getOptions") d3.select("#select-new").property("disabled", true); // disable select-new btn while getOptions form is open
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
    // singleClicks only; toggle pause
    if (experience.animating && !experience.manuallyPaused) manualPause()
    else if (experience.manuallyPaused) resumeAnimation()
  }

  function pauseAnimation() {
    // track state
    // experience.animating = false;
    experience.paused = true;
    experience.pausedAt = d3.now() - timer._time;
    // stop timer (after pausedAt stored)
    timer.stop();
    // toggle play/pause
    d3.select("#play-pause")
      .text('\u25BA') // Play
      .on("click.play",resumeAnimation)
      .on("click.pause",null)
    // allow free zooming while paused
    svg.call(zoom)
  }

  function manualPause() {
    experience.manuallyPaused = true;
    pauseAnimation();
  }

  function resumeAnimation(delay = 0) {

    // disable free zooming
    svg.on("wheel.zoom",null)
    svg.on("scroll.zoom",null)

    // realign to zoomAlong transform state if necessary; control timing of continueResume() tasks
    if (transitionResume) {

      // reset
      transitionResume = false;

      let t1 = (reversing.flag) ? reversing.t : tFull,
          tP = (reversing.flag) ? reversing.tPad : tPad;

      let transform = getZoomAlongTransform(experience.pausedAt,t1,tP)

      svg.transition().duration(750).ease(zoomEase)
        .call(zoom.transform, getIdentity(transform))
        .on("end",continueResume)

    } else {
      continueResume();
    }

    function continueResume() {
      // determine time since storing of pausedAt
      let time = d3.now() - experience.pausedAt;
      // track state
      experience.paused = false;
      experience.manuallyPaused = false;
      experience.pausedAt = null;
      // restart timer @ passed time
      // if (animatable) ?
      // d3.timerFlush();
      timer.restart(animate,delay,time);
      // toggle pause-play
      d3.select("#play-pause")
        .text("II") // Pause
        .on("click.pause", manualPause)
        .on("click.play", null)
    }

  }

  function selectNew() {
    // if mid-animation, pause and confirm user intent
    if (experience.animating && !experience.paused) pauseAnimation();
    let confirmed = confirm('Do you wish to select a new route?');
    if (!confirmed) {
      if (experience.paused && !experience.manuallyPaused) resumeAnimation();
      return;
    } else {
      resetConfirmed(); // RESET ALL to stored state0
    }

    // if select new confirmed, continue to show form with options
    d3.select("#submit-btn-txt").classed("none",false);
    d3.select("#submit-btn-load").classed("none",true);

    // open selection form
    toggleModal('get-options')

    function resetConfirmed() {

      // restore orig opacity levels of dimmed base
      // work below into cohensive reset method attached to currentState obj

      resetZoom();
      collapse("dash", "down")

      d3.select("#dash").html(state0.dash)
      d3.select("#getOption0").html(state0.opt0)
      d3.select("#getOption1").html(state0.opt1)

      zoomArc = null;
      experience = { initiated: false, animating: false, paused: false, manuallyPaused: false, pausedAt: null }
      togglesOff = { info: false, select: false }
      panned = { flag: false, transform: null, centerAdjust: null, i0: 0, i1: 0 }
      logBackgrounds = {};
      transitionResume = false;
      reversing = { flag: false, stop: false, i: 0, t: null, tPad: null }

      // add fade transitions to content removal
      d3.select("#journey").selectAll("*").remove()
      g.select("#enrich-layer").selectAll("*").remove();

      // d3.select("#get-options").node().innerHTML = form0;
      // d3.select("#dash-plus").node().innerHTML = dash0;
      // d3.select("#dash-wrapper").node().innerHTML = dash0;
      // d3.select("#dash-content").node().innerHTML = dash0;
      // d3.select("#resizable2").node().innerHTML = dash0;

      // // optional? (would be reset programmatically before they are used anyway)
      // firstIdentity = null, lastIdentity = null;
      // fullPath = null, semiSimp = null
      // tFull,fullLength,tPad,zoomLength
      // routeDashInterpolator
      // data0, data1, data2, data3;

       // empty selections? d3.select("div.parent").html("");

       // https://stackoverflow.com/questions/7671965/how-to-reset-dom-after-manipulation#
       // document.data("map0").replaceAll("#map-plus")
       // document.data("dash0").replaceAll("#dash-plus")
       // document.data("modal0").replaceAll("#modal-plus")

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
        key = props.logGroup.divId + "-" + props.subTag.divId + "-" + geomType;
      } else if (props.logGroup.divId) {
        key = props.logGroup.divId + "-" + geomType;
      }
      fill = {key: key}
      if (!patterns[fill.key]) {
        let texture = processTexture(d);
        assignPattern(texture,key);
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

  function processTexture(d,swatchFlag = false,padLeft = 0) { // d may be gj feature or selected dom node
    let texture,
      props = (d instanceof d3.selection) ? d.datum().properties : d.properties,  // shorthand
      geomType = props.id.slice(0,2),
      textureProps = swatchFlag ? {...props.logGroup.textureProps, ...props.logGroup.swatchAdjust} : props.logGroup.textureProps;
    if (geomType === "ln") {
      texture = getLinedTexture(d,padLeft);
    } else if (props.subTag && props.subTag.color) {
      if (swatchFlag || geomType === "pt") {
        let textureOpts = {...textureProps, ...{background: props.subTag.color, stroke: "whitesmoke"}};
        if (props.logGroup.textureType === "circles") textureOpts.fill = "whitesmoke";
        texture = getTexture(props.logGroup.textureType,textureOpts)
      } else { // not a swatch or point;
        let textureOpts = {...textureProps, ...{stroke: chroma(props.subTag.color).darken().hex() }};
        if (!textureProps.hasOwnProperty("d") && !textureProps.hasOwnProperty("orientation")) {  // circles
          // textureOpts.stroke = props.subTag.color;
          // textureOpts.fill = chroma(props.subTag.color).darken().hex();
          textureOpts.background = "transparent";
        }
        texture = getTexture(props.logGroup.textureType,textureOpts)
      }
    } else { // mostly lakes
      texture = getTexture(props.logGroup.textureType,textureProps);
    }
    swatchFlag ? hiddenSvg.call(texture) : svg.call(texture);
    return texture;
  }

  function getLinedTexture(d,padLeft) {

    let pathSequence, s = (padLeft > 0) ? 18 : 24;

    if (d.property("category") === "Watershed") {

      let arr = d.style("stroke-dasharray").split(', ').slice(0,4).map(d => +d),
        parts = arr.length * 2 + 1;
      // arr.slice().reduce((a,b) => a+b);

      pathSequence = `
          M 0,${s}
          l ${arr[0] * (s/parts)},-${arr[0] * (s/parts)}
          m ${2 * (s/parts)},-${2 * (s/parts)}
          l ${arr[1] * (s/parts)},-${arr[1] * (s/parts)}
          m ${2 * (s/parts)},-${2 * (s/parts)}
          l ${arr[2] * (s/parts)},-${arr[2] * (s/parts)}
          m ${2 * (s/parts)},-${2 * (s/parts)}
          l ${arr[3] * (s/parts)},-${arr[3] * (s/parts)}
          m ${2 * (s/parts)},-${2 * (s/parts)}
          L ${s},0
        `;

    } else if (d.property("category").startsWith("River")) {

      pathSequence = `M 0,${s} L ${s},0`;

    }

    return textures.paths()
        .d(s => pathSequence)
        .size(s)
        .heavier()
        .stroke(d.style("stroke"))
        .background(`rgba(${chroma("#eee").alpha(0.8).rgba().join(",")})`)
        .shapeRendering("crispEdges")

  }

  function assignPattern(texture,key,swatchFlag) {  // was async
    patterns[key] = {
      src: swatchFlag ? textureToSrc(texture) : "none", // for swatches and canvas fill
      url: swatchFlag ? "none" : texture.url()          // for svg use
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

    let src = (type !== "base64") ? getRaw(xml) : getBase64(xml);

    return src;

    function getRaw(xml) {
      // https://css-tricks.com/probably-dont-base64-svg/
      return 'data:image/svg+xml;utf-8,' + xml;
    }

    function getBase64(xml) {
      // reduced from https://jsfiddle.net/Wijmo5/h2L3gw88/
      return 'data:image/svg+xml;base64,' + btoa(xml);
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

  function getTexture(type = "paths",props) {
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

//// TOOLTIPS

  function onMouseenter(d) {

    // visual affordance for element itself
    d3.select(this) // .classed("hover", true) //.raise();
      .transition().duration(100)
        .style("stroke-opacity",0.9)
        .style("opacity", d3.select(this).property("hover-opacity") || 0.9)

    if (d3.select(this).property("name")) {
      // make/bind/style tooltip, positioned relative to location of mouse event (offset 10,-30)
      let tooltip = d3.select("#map").append("div")
        .attr("class","tooltip point-none")
        .html(getHtml(d3.select(this)))
        .style("left", (d3.event.layerX + 10) + "px")
        .style("top", (d3.event.layerY - 30) + "px")
        .attr("fill", "honeydew")
        .attr("stroke", "dimgray")
        .attr("opacity", 0) // initially

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

    let pre = `<span class="name txt-compact2 txt-s txt-m-mxl">`;

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

//// OTHER HELPER FUNCTIONS

  // PARSE, CONVERT, ASSOCIATE

   function getSubstr(string,i0 = 4) { // defaults for use in converting from textures.js url(); assume format "url(#12345)"
    let i1 = string.length - 1;
    return string.substring(i0,i1)
  }

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
  // automatically order legend log categories
  // better clarity/communication of protected areas classifications; their own group with further togglable subgroups? or combine all PAs? (but I rely on their separation in determining symbology)
  // ensure contrast of texture features maintains sufficient visibility
  // clean up code:
    // be super consistent and clear including '' vs "", use of var/const/let, spacing, semicolons, etc
    // refactor, optimize, condense, DRY, improve structure

// WISHLIST/FUN
  // ability to select route visually, by clicking on city/rail stn locations from map
  // visualizing all number data within dash:
    // elevation grid/tracker
    // compass needle
    // better clock/odometer visual approximations
  // mousing over log/narration elements highlights all within map
  // polygon radial animation / so fancy (see styling notes below; must first make a determination re: transitioning to canvas) (*)
  // add underlying shaded relief terrain layer (*)
    // http://www.shadedrelief.com/birds_eye/gallery.html?
  // ability for user to control pace of train (* would have to be adjusted before animation begins since timing of transitions predetermined *)
  // toggle layers on/off: eco, hydro, geo, protected areas
  // user chosen sort of origin/destination options?
    // random shuffle, by distance, alphabetical
  // add autocomplete/suggestions to R2R search (using their API; maybe this would fix some problem cities?)
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

// MAAAAYBE
  // new color for modal?
  // new train icon that rotates along with headlights
  // verbose console errors (in Chrome)
    // "[Violation] Forced reflow while executing JavaScript took 39ms"
      // https://gist.github.com/paulirish/5d52fb081b3570c81e3a
  // create toggle structure for page layout such that DOM responsivity requires less conditional logic; preset toggle groups for  various panes/panels (integrating all the if/else logic within calcSize(), expand(), and collapse() into styles.css doc; creating style groups to toggle on/off)
    // https://developer.mozilla.org/en-US/docs/Web/Events/toggle
    // css states?
  // add circle size reference to legend (radius as representative of orig area for all polygons (under a certain threshold) I collapsed into their centroids)


////// NEWER NOTES /////

// CHANGES / HAVE DONE
  // fixed legend-log symbol issue
  // textures.js svg textures => img srcs that can be rendered in canvas and other html divs
  // start of pause functionality (pause works; resuming the issue)
  // start of effective reset()
  // added categorical background-images to currently passing div (communicates differences without relying on intrusive column headings)
  // when select new route form not visible, select new route btn !== disabled (plus opposite)
  // trainPt, headlights, and fullPath now animations (vs transitions) coordinated with d3.timer

// CURRENTLY WORKING ON
  // debugging PAUSE functionality (how to pass and utilize pausedAt variable?)
  // debugging RESET functionality (how to clone without rendering, including bound event listeners and data at select state?) and making less hacksome
    // ensure select new route btn in particular maintains original event listeners

// PRIORITY FIXES (COMING ASAP)
  // make form fields like responsive like butter
    // also:
      // origin !!= destination (!!= = cannot)
      // get rid of down arrows
  // integrate R2R autocomplete API or otherwise resolve big but error-returning cities (Denver, Atlanta, etc)

// MINOR FIXES (COMING SOON)
  // keep state lines subtly visible through polygon feature reveal
  // have textured backgrounds recalculate from group up on each render
  // grossly pair down accompanying text (esp all that "overly dramatic" stuff)
  // logBackground river should be taller than wide? interweave with mirrored dashed line?
  // station updates:
    // REMOVE: Port Kent, NY

// ADDITIONS (COMING SOON)
  // while animating, single click on map PAUSES (in addition to explicit button)
  // automatic ordering of legend-log category (so pa-grp3 does not appear above pa-grp1, even if that is the order in which features were encountered)
  // visual affordance/invitation: large transparent play btn simulates 'click' upon animation begin, then visually collapses into much smaller play/pause button in top left corner
  // double size of background-images that populate sections of "currently passing" by flipping down mirrored version of first, then set background-image to repeat for continuous coverage
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
  // undisable play/pause visual
  // pa-grp3 count doesn't update appropriately; sometimes pa-grp3 style equivalent to pa-grp2
  // further order legend:
    // hydrological
    // geological
    // ecoregions
    // protected area
    // remaining stations turn greyscale
    // train = greyish, aerial?
    // arrow-out to expand about section
    // start/stop stations remain large and color-coded
    // roadless areas being interpreted as pa-grp3; fix (nylon)

// if Canvas:
  // have done:
    // all baselayer elements == canvas
    // enrich lines = svg
    // remaining enrich = canvas
    // all toplayer and hidden elements == svg (full-route, semi-simp, zoomalong, headlights, trainpt, quadtree data)
    // integrate canvas and svg seamlessly with one another
    // restructure render/zoom/reveal appropriately
    // STRUCTURE
      // layerGroup order:
        // background (separate canvas) (OR SVG?)
        // baselayers (context)
        // midlayers (enrich pool: polygons, lines, then pts)
        // toplayers (journey/route) ==> SVG?
        // hover elements (separate canvas)
      // additionally possible canvas classes: line spread split background base mid over mesh map icon
    // RENDERING USING CANVAS VS SVG
      // rotate values in radians vs degrees
      // path, line etc make actual context call / return null vs returning path string
      // background vs fill url
    // MOUSEOVER: get mouse coordinate via layerX,Y and/or offsetX,y
    // query canvas state to return current feature at coords
    // select and update feature with visual highlights / tooltip
  // RESOURCES
    // Stardust.js: https://www.cs.ucsb.edu/~holl/pubs/Ren-2017-EuroVis.pdf
    // https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource
    //  + SVG??: https://css-tricks.com/rendering-svg-paths-in-webgl/
    // https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Drawing_DOM_objects_into_a_canvas
    // https://beta.observablehq.com/@mbostock/randomized-flood-fill
    // blockbuilder.org/larsvers/6049de0bcfa50f95d3dcbf1e3e44ad48
    // https://medium.freecodecamp.org/d3-and-canvas-in-3-steps-8505c8b27444
    // https://www.datamake.io/blog/d3-zoom#geo-canvas!
