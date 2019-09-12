## IF I EVER DECIDE TO TRY AGAIN WITH CANVAS

### HAVE DONE
- all baselayer elements == canvas
- enrich lines = svg
- remaining enrich = canvas
- all toplayer and hidden elements == svg (full-route, zoomalong, headlights, trainpt, quadtree data)
- integrate canvas and svg seamlessly with one another
- restructure render/zoom/reveal appropriately

### STRUCTURE
#### layerGroup order:
- background (separate canvas) (OR SVG?)
- baselayers (context)
- midlayers (enrich pool: polygons, lines, then pts)
- toplayers (journey/route) ==> SVG?
- hover elements (separate canvas)

### NOTES ON RENDERING USING CANVAS VS SVG
- rotate values in radians vs degrees
- path, line etc make actual context call / return null vs returning path string
- background vs fill url

### MOUSEOVER CONSIDERATIONS
- get mouse coordinate via layerX,Y and/or offsetX,y
- query canvas state to return current feature at coords
- select and update feature with visual highlights / tooltip

### OTHER NOTES
- additionally possible canvas classes: line spread split background base mid over mesh map icon

### RESOURCES
- Stardust.js: https://www.cs.ucsb.edu/~holl/pubs/Ren-2017-EuroVis.pdf
- https://html.spec.whatwg.org/multipage/canvas.html#canvasimagesource
-  + SVG??: https://css-tricks.com/rendering-svg-paths-in-webgl/
- https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Drawing_DOM_objects_into_a_canvas
- https://beta.observablehq.com/@mbostock/randomized-flood-fill
- blockbuilder.org/larsvers/6049de0bcfa50f95d3dcbf1e3e44ad48
- https://medium.freecodecamp.org/d3-and-canvas-in-3-steps-8505c8b27444
- https://www.datamake.io/blog/d3-zoom#geo-canvas!
