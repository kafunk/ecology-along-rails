// CONTENT: preprojected (epsg:102008) topojson base layers, simplified to maximum potential zoom and rendered as mesh

  // CLI workflow as follows:
// shp2json all-watersheds-na-4326.shp -o na_watersheds_all.json
// mapshaper all_na_watersheds.geojson \
//   -proj crs=aea +proj=aea +lat_1=20 +lat_2=60 +lat_0=40 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs \
//   -simplify planar resolution=1920x1600 \
//   -clean \
//   -o quantization=1e5 width=960 height=860 format=topojson mapshaped/watersheds102008_pcsoneg96.json

  // ALTERNATIVE (unused)
    // geoproject 'd3.geoConicEqualArea().rotate([-255,0]).fitExtent([[0,0], [960,860]], d)' < na_watersheds_all.json > na_watersheds_102008.json
    // geo2topo watersheds=na_watersheds_102008.json > watersheds102008.json

////////////////////////////////////



// all watersheds:
// shp2json all-watersheds-na-4326.shp -o na_watersheds_all.json
// mapshaper all_na_watersheds.geojson \
//   -proj crs=aea +proj=aea +lat_1=20 +lat_2=60 +lat_0=40 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs \
//   -simplify planar resolution=1920x1600 \
//   -clean \
//   -o quantization=1e5 width=960 height=860 format=topojson mapshaped/watersheds102008.json

// all ecoregions:
// shp2json all-watersheds-na-4326.shp -o na_watersheds_all.json
// mapshaper all_na_watersheds.geojson \
//   -proj crs=aea +proj=aea +lat_1=20 +lat_2=60 +lat_0=40 +lon_0=-96 +x_0=0 +y_0=0 +datum=NAD83 +units=m +no_defs \
//   -simplify planar resolution=1920x1600 \
//   -clean \
//   -o quantization=1e5 width=960 height=860 format=topojson mapshaped/watersheds102008.json


// watershed extract:

// ecoregion extract:

// all railroads:

// pass railroads:

// all pass rail nodes:

// main rail stations:
