module.exports = {
  lineChunk: require('@turf/line-chunk'),
  buffer: require('@turf/buffer'),
  booleanPointInPolygon: require('@turf/boolean-point-in-polygon').default,
  length: require('@turf/length').default,
  lineSlice: require('@turf/line-slice'),
  along: require('@turf/along').default,
  simplify: require('@turf/simplify'),
  truncate: require('@turf/truncate').default,
  nearestPointOnLine: require('@turf/nearest-point-on-line').default,
  distance: require('@turf/distance').default,
  centroid: require('@turf/centroid').default,
  area: require('@turf/area').default,
  bearing: require('@turf/bearing').default,
  convertArea: require('@turf/helpers').convertArea,
  bearingToAzimuth: require('@turf/helpers').bearingToAzimuth,
  convertLength: require('@turf/helpers').convertLength,
  lineString: require('@turf/helpers').lineString,
  multiLineString: require('@turf/helpers').multiLineString,
  point: require('@turf/helpers').point,
  degreesToRadians: require('@turf/helpers').degreesToRadians,
  radiansToDegrees: require('@turf/helpers').radiansToDegrees,
  coordAll: require('@turf/meta').coordAll
};
