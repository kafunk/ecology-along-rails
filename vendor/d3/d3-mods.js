module.exports = {
  scaleLinear: require('d3-scale').scaleLinear,
  scaleSqrt: require('d3-scale').scaleSqrt,
  easeLinear: require('d3-ease').easeLinear,
  easeSinInOut: require('d3-ease').easeSinInOut,
  easeCubicOut: require('d3-ease').easeCubicOut,
  drag: require('d3-drag').drag,
  dispatch: require('d3-dispatch').dispatch,
  quadtree: require('d3-quadtree').quadtree,
  interpolate: require('d3-interpolate').interpolate,
  interpolateString: require('d3-interpolate').interpolateString,
  zoom: require('d3-zoom').zoom,
  zoomTransform: require('d3-zoom').zoomTransform,
  zoomIdentity: require('d3-zoom').zoomIdentity,
  select: require('d3-selection').select,
  selectAll: require('d3-selection').selectAll,
  selection: require('d3-selection').selection,
  transition: require('d3-transition').transition,
  active: require('d3-transition').active,
  geoIdentity: require('d3-geo').geoIdentity,
  geoPath: require('d3-geo').geoPath,
  geoConicEquidistant: require('d3-geo').geoConicEquidistant,
  json: require('d3-fetch').json,
  csv: require('d3-fetch').csv,
  xml: require('d3-fetch').xml,
  line: require('d3-shape').line,
  arc: require('d3-shape').arc,
  curveCardinal: require('d3-shape').curveCardinal,
  timer: require('d3-timer').timer,
  timeout: require('d3-timer').timeout,
  now: require('d3-timer').now,
  get event() { return require('d3-selection').event; }
};

// easeCubicIn: require('d3-ease').easeCubicIn,
// get mouse() { return require('d3-selection').mouse; }