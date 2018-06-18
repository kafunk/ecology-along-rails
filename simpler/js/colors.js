
  var width = 960,
     height = 860;

  // define gradient color scale
  var gradientScale = d3.scaleLinear()
    .range(["#ff6347","#f36b40","#e87238","#dc7830","#d17d27","#c6811d","#b8860b","#a87d22","#977330","#866b3a","#766243","#64594a"]);

  var gradientScale2 = d3.scaleLinear()
    .range(["#483597","#4d3b8a","#503f81","#524375","#524868","#524d5d","#515151"].reverse());

  var x = d3.scaleLinear()
    .domain([-1, width + 1])
    .range([-1, width + 1]);

  var y = d3.scaleLinear()
    .domain([-1, height + 1])
    .range([-1, height + 1]);
