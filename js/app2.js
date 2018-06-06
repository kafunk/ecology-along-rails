(function () {

// SET UP ENVIRONMENT

  // mapbox API access Token
  //   L.mapbox.accessToken = 'pk.eyJ1Ijoia2FmdW5rIiwiYSI6ImNqYmc3dXJzczMzZWIzNHFmcmZuNjY3azMifQ.9i48EOQl4WCGZQqKRvuc_g';
  //
  // // initialize map centered on conterminous US
  //   var map = new mapboxgl.Map({
  //     container: 'map',
  //     style: 'mapbox://styles/kafunk/cjhzu1ypk2nhj2sn6qkg8e3x2',
  //     center: [-96, 37.8],
  //     maxBounds: L.latLngBounds([40, -89], [44, -86]),
  //     zoom: 4,
  //     minZoom: 3,
  //     maxZoom: 18
  //   });

  // https://beta.observablehq.com/@mbostock/disposing-content
  // try {
  //   yield map;
  //   yield invalidation;
  // } finally {
  //   map.remove();
  // }

var width = 960,
    height = 1160;
var projection = d3.geo.mercator()
		.center([100, 50])
    .scale(240)
		.rotate([-180,0]);
var path = d3.geo.path()
    .projection(projection);
var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);
d3.json("nam.json", function(error, nam) {
  var subunits = topojson.feature(nam, nam.objects.subunits)
 /*     ,places = topojson.feature(nam, nam.objects.places) */
;
  svg.selectAll(".subunit")
      .data(subunits.features)
    .enter().append("path")
      .attr("class", function(d) { return "subunit " + d.id; })
      .attr("d", path);
  svg.append("path")
      .datum(topojson.mesh(nam, nam.objects.subunits, function(a, b) { return a !== b; }))
      .attr("d", path)
      .attr("class", "subunit-boundary");
  svg.selectAll(".subunit-label")
      .data(subunits.features)
    .enter().append("text")
      .attr("class", function(d) { return "subunit-label " + d.id; })
      .attr("transform", function(d) { return "translate(" + path.centroid(d) + ")"; })
      .attr("dy", ".35em")
      .text(function(d) { return d.properties.name; });
  svg.append("path")
      .datum(places)
      .attr("d", path)
      .attr("class", "place");
/*
  svg.selectAll(".place-label")
      .data(places.features)
    .enter().append("text")
      .attr("class", "place-label")
      .attr("transform", function(d) { return "translate(" + projection(d.geometry.coordinates) + ")"; })
      .attr("x", function(d) { return d.geometry.coordinates[0] > -1 ? 6 : -6; })
      .attr("dy", ".35em")
      .style("text-anchor", function(d) { return d.geometry.coordinates[0] > -1 ? "start" : "end"; })
      .text(function(d) { return d.properties.name; });
*/
});
});
// // LOAD DATA
//   var railwaysJson = d3.json("data/us-states.json"),
//     railnodesJson = d3.json(""),
//     huExtractJson = d3.json(""),
//     ecoRegJson = d3.json("")
//     // poisJson = d3.json("poiExtract.json")
//     // basemap: other rail, hydrolines, lrger watersheds,etc
//
//      // pois include eco, geo, tunnel, etc
//
//   // make sure both data files are completely loaded before sending data on to callback function
//   Promise.all([railwaysJson,railnodesJson,huExtractJson,ecoRegJson]).then(drawMap, error)
//
//   // catch errors, if any
//   function error(error) {
//     console.log(error)
//   }
//
//   // accepts the data array
//   function drawMap(data) {
//     console.log(data);
//     var railways = data[0],
//        railnodes = data[1],
//       watersheds = data[2],
//       ecoregions = data[3];
//
//     // define width and height of our SVG
//     var width = 960,
//        height = 600
//
//     // create svg element as child of #map element
//     var svg = d3.select("#map")
//       .append("svg")
//       .attr("width", width) // give the SVG element a width and height attributes and value
//       .attr("height", height)
//
//     // d3 feature method converts topoJSON back to geoJSON (convenient for most mapping applications)
//     var geojson = topojson.feature(statesData, {
//       type: "GeometryCollection",
//       geometries: statesData.objects.cb_2016_us_state_20m.geometries
//     })
//
//     // define a projection using the US Albers USA
//       // fit the extent of the GeoJSON data to specified width and height
//     var projection = d3.geoAlbersUsa()
//       .fitSize([width, height], geojson)
//
//     // define a path generator, which will use the specified projection
//     var path = d3.geoPath()
//       .projection(projection)
//
//     // create and append a new SVG 'g' element to the SVG
//     var states = svg.append("g")
//       .selectAll("path")        // select all the paths (as yet non-existent)
//       .data(geojson.features)   // access the GeoJSON data
//       .enter()                  // enter the selection (all pre-selected path elements)
//       .append("path")           // create one new path element for each data feature
//       .attr("d", path)          // give each path a d attribute value
//       .attr("class", "state")   // give each path a class of state
//   }
//
// });
