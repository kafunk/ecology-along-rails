### Decisions I need to make (input welcome)
Render d3 overlay on top of MapboxGL vector tiles / custom MapboxStudio basemap, or


To what extent do I want to use HERE routing API data?
-Originally though I would just match user-selected start/end points with a route
, but it seems likely I could actually also rely on their geometries, waypoints, distance/time calculations, station data, etc...


### MAIN TO DO AREAS

  - retransform/simplify data on command line (preproject)
  - get form working (request route)
  - get routing api working (get route)
  - connect returned route with spatially intersecting data (enrich route)
  - bind this data to the dom and visualize using transitions and color (bind route)
  - offer smooth, informative, pleasurable animation experience (render route)
  - output select properties dynamically as train-node intersects them (log route)


### functions to focus on

  // Relate route waypts/nodes/links to spatially intersecting (given buffer) data for interesting and illuminating route experience

  function enrich(route){
    // receive object of waypts/nodes/links
    // cluster basic route elements (links/nodes) in a way that makes sense [Q: optimization](#optimization)
    // retrieve BBoxes for route clusters
    // filter all enrichData to elements within these BBoxes
      ==> function retrievePotentiallyIntersecting(routeClustersBBoxes) {
            // return selection to inspect further
          }
    // potentiallyIntersectingPOLYGONS ONLY (I think this will be most efficient):
      // iterate through polygons,compare with entireline of route;
        // for those polygons that indicate ANY intersection,
          // retrieve routeNode at polygonEnter
          // retrieve routeNode at polygonExit
    // iterate through all route nodes (including those already containing polygon enter/exit points)
      // use specific intersect queries to pair remaining potentiallyIntersecting elements (lines/points) with each route node
      ==> function retrieveIntersecting(routeNodes,potentialIntersectClusters) {
            // compare each node to remaining potentialIntersect data (again, optimize this somehow! not all railNodes/allPOIs; not Wisconsin to California):
              // run specific queries with turf.js (or even just stick with d3 since it can clearly do everything?)
              // store references to matching points/lines for each node (there will be crossover/overlap: all nodes with radius of point, all intersections of line and line)
            // return completely enriched route object
          }
    ==> prep(routeData)
  }

// set up svg incl filters and gradients

var radius = <?>,
 currentPt = <start>,
 currentCompassBearing = <>; // ie direction headed; (bearingof2pts, bearing2azimuth)

  ==> function prep(routeData) {
    // declare initial categories/clusters to manage interaction with DOM:
      // routeObject (entirety of route data) divided into array clusters of dynamically set length (but keep stored in script in case route reselected or replayed, even possibly to reduce need for future API calls?)
    [1]   var remainingFeatures = routeObject.features; // initially all features; gets smaller as items passed/rendered
    [2]   var allPassing = remainingFeatures.within(buffer(radius,currentPoint);
          // PASSING => class overlaps with those before and after; no updates   
             necessary, just let transition continue to unfold; perhaps this is the data array to limit?? (num of active nodes at a time)
    2a)   var approaching = allPassing.ahead; // sector of whole in direction of currentBearing
      ->  // APPROACHING => <defs>.data.enter().append())
      ->  // IMMINENT: cycle through approaching in sorted order; append transitions
            // => data.use().append("transition")
                    .attr("transition", d => fadeIn)
    2b)   var passed = allPassing.behind; // section of whole in opposite direction of currentBearing    
          // PASSED: within x radius sector of train behind
            // => data.update().append("transition")
                    .attr("transition", d => fadeToFlat)
    [3]   // PAST: upon transition complete, flattened, frozen, sepia()-ed?, removed excessive attributes and nodes as possible to minimize browser sluggishness
            // => data.exit().remove()
            // other ways to render non-animated elements on screen? Canvas??
              // is this me giving up on tooltips/post-animation interactivity?
  }          


// 'NOW' = tiny sectors to right and left of currentPt/Bearing? illuminate/ripple as a way to separate from approaching and passed. no need to separate sectors; ripple out from center (and back?+)

// variables
  sort a,b (a in min (closest to origin [0,0]), b is max (farthest from origin))

  allPassing = {
    currentPt: <>,
    currentBearing: <>,
    bufferSpec: {
      r:   ,
      d:   , // pt at which route line intersected forward-facing sector
      i:    // pt at which route line intersected rear-facing sector  
    },
    refresh(): getRefreshed(this),   // returns refreshed object (reset with )

    // sort all
    sorted(): d => { pt = assoc.d; return sortNearFar(this.currentPt, this.bufferSpec.pt) },
      getVar(d)} Ahead: sortAhead(this.bufferSpec.d, this.currentPt),  
    sortBehind: sortBehind(this.bufferSpec.i, this.currentPt),
    ahead:
  // methods




// TURF JS
// points on lines :
  // http://turfjs.org/docs#along

// for associating railnodes with polygons? http://turfjs.org/docs#tag

// comparing points and points
// http://turfjs.org/docs#bearing
// for determining large-scale order of reveal: http://turfjs.org/docs#nearestPoint

// path nodes must already be sorted! assume this //
approaching =
var h = sortedArray.indexOf(this.currentPt)
slice()

passed =
var h = sortedArray.reverse().indexOf(this.currentPt)
// confirm reversed in place?
// passed is portion of reversed array between current point and end of array
  passed = sortedArray.slice(h)

// vectorAhead


var sortedArray = $array.sort(sortLngLat);
    console.log(sortedArray);
    reutnr h, t
    where
    o = this.currentPt; // origin pt on which buffer was initially called
    v = assoc.
  }
}

// default sort order
function orderEncountered (o, e){
  var x = o[0] / o[1];
  var y = e[0] / e[1];
}

    function getRefreshed(allPassingObj)

      return ;
    }
  ==> function updateRender(allPassing)

        // receive (initial or) refreshed 'allPassing' object

        // sort and parse data
        // parse data into (at least) two arrays:
          // var approaching = allPassing.ahead;
          // var passed = allPassing.behind; // i.e


// at start: assuming start[0,0] and a not tooooo nutty railway, initial buffer will only return 1 route/circumference intersection. assign d and i based on this (for calculating sort function / directionality)
// possibly could also fetch this from HERE data return

    // parse into (at least) two arrays:
      // var approaching =
      // var passed = **
    // use lat OR lon to sort by approximate proximity given currentPt, currentBearing, and slope of travel between [route[d]] & currentPt and currentPt & [route[i]] (where d and i are points of route intersection with original buffer circumference
      // assuming route[d] represents point in the distance, route[i] is in the past;
        // can I assign buffer pts as such upon orig buffer calc? make generalizations about this proving hard..
      // approaching.sort(a before b == a c)

  // bind refreshed 'approaching' array to svg <defs> element
    defsBind(approaching)

  // iterate through approaching' features in orderanimate the imminent features entered to <g><path> via <use> [is this legit?]
    pathAnimate(pathEnter(defsUse(imminent)))

  // once <used> i.e. transferred to normal rendering svg path?
    defsRmv(imminent)

  ==> function refresh(passing) {
        var prevPassing = passing;          // momentarily store current Passing object
        var nowPassing = passing.refresh()  // call .refresh() method on Passing and save new
        var past = prevPassing - nowPassing // determine different; ie. features that were in 'passing' group but are no longer
    ==> function remove(past) {

        }
      }
  // (while (remainingFeatures.length > 0)) call self to update, passing refreshed 'passing' data    
    updateRendering(nowPassing)


passing.refresh() = this => { }
  function bind(routeData) {

  // bind all (or chunk by chunk?) preassociated intersecting data to <defs> element
  // bind route path and render all as grey, subdued
  // bind and render current position (start) with train icon
  // initExp
  ==> function initExp() {
    // set interval for refresh/pattern/cycling
    // append initial transitions with minimal delay:
      // train icon moves along route line               *
      // as line touched by train, line becomes bolder   *
    // provide countdown/feedback to user
    // train(go)
  }

// * = transition functions to work on

  ==> function train(go) {
    // for each traversed railNode, update route rendering: style and animate new, update current?, remove old (passed --> past)

    prepInitial(data)
  }

function lookAround() {

  orient() { }
  getApproaching(currentPt,) { }

  // assume originally sorted
  prevApproaching = nowApproaching;
  nowApproaching = getApproaching()

  route.selectAll(".approaching")
    .data(refreshed)
    .enter().append(.approaching)
}


### more questions I anticipate:

  - Q: how to keep train line on top of dynamically rendering polygon layers?

  - lots re: optimization

    - given the slowness of my computer + the extent and optimism of my data layers (though I did use mapshaper to simplify where possible) + general goals of the project, how much am going to need to worry about browser sluggishness and DOM overload? Where will I need to tread lightly; where can I optimize and be smart?
    - how to set up intersect queries in a way that is not too expensive?
      - I.E., no need to compare nodes from leg B with POIs that we obviously won't encounter until leg Q
      - chunk/cluster nodes; return (overlapping?) bBox(es) of each cluster; select all POIs that fall within a buffer distance of those bounds; THEN iterate individually through all nodes within chunk B, running intersect queries with filtered subset?
      - functionality/expense of binding vs. rendering // svg <defs> and <use> elements
