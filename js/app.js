(function () {

  // INITIALIZE MAP

    // mapbox API access Token
      L.mapbox.accessToken = 'pk.eyJ1Ijoia2FmdW5rIiwiYSI6ImNqYmc3dXJzczMzZWIzNHFmcmZuNjY3azMifQ.9i48EOQl4WCGZQqKRvuc_g';

    // initialize map centered on conterminous US
      var map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/kafunk/cjhzu1ypk2nhj2sn6qkg8e3x2',
          center: [-96, 37.8],
          maxBounds: L.latLngBounds([40, -89], [44, -86]),
          zoom: 4,
          minZoom: 3,
          maxZoom: 18
      });
map.on('load', function() {
    map.addLayer({
      id: 'watersheds',
      type: 'polygon',
      source: {
        type: 'geojson',
        data: 'data/wbdhu10_extract.json'
      },
      paint: {
        'polygon-color': [
          'interpolate',
          ['linear'],
          ['number', ['get', getAttribute()]],
          0, '#2DC4B2',
          1, '#3BB3C3',
          2, '#669EC4',
          3, '#8B88B6',
          4, '#A2719B',
          5, '#AA5E79'
        ],
        'polygon-opacity': 0.8
      }
    }, 'huc10s');
  });

  // LOAD DATA
    // use d3?
    d3.json ('data/RAILROUTES')
    d3.json ('data/railnodes')
    d3.json ('data/huc10s')
    d3.json ('data/ecopolys')
    d3.json ('data/hydrolines')
    d3.json ('data/otherlines')
    d3.json ('data/ecopts')
    d3.json ('data/otherpts')
      .on('ready', function (e) {
        // pass data as GeoJSON to drawMap function
        // drawLegend(e.target.toGeoJSON());
        drawMap(e.target.toGeoJSON());
      })
      .on('error', function (e) {
        console.log(e.error[0].message);
      });


  // variables to be populated dynamically pending on UI
    // start point
    var start = [-122.414, 37.776];

    // end point
    var end = [-77.032, 38.913];

    // FETCH LINE OF TRAIN ROUTE from start to end
    var route = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    start,
                    end
                ]
            }
        }]
    };

    // A single point that animates along the route.
    // Coordinates are initially set to start.
    var point = {
        "type": "FeatureCollection",
        "features": [{
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Point",
                "coordinates": start
            }
        }]
    };

    // Calculate the distance in miles between route start/end point.
    var lineDistance = turf.lineDistance(route.features[0], 'miles');


// // receive data from async function
//    function drawMap(data) {
//      // separate data into layers;
          //  var csLayer = L.geoJson(data,options).addTo(map),
          //    circLayer = L.geoJson(data,options).addTo(map);

//      // declare default/shared styling options;
          // var options = {
          //  stroke: whatever
          // }

//      // fit map bounds to extent of initial data;
          // map.fitBounds(<last layer loaded?>.getBounds(), {
          //  paddingBottomRight: [200,0]
          // });

//      // assign custom styles by layer
          // layerGroup.setStyle({
            // color: '#8dbf90',
            // fillColor: '#8dbf90',
            // fillOpacity: 0.5
            // fillColor: '#dee27d' //fillColor will be invisible except on mouseover
          // });

//      // pass hard-coded timestamp along with all layers
          // updateMap()
          // prepUIelements()
        // }
      // }

//    function updateMap(layerGroupsToUpdate) {
//      layerGroup.eachLayer(function(layer){
//        // do a thing
//      });
//
//      updateDash(content1);
//      updateLog(content2)
//   }

    // function updateDash(content1) {
    //   // 1-3 announcements from 3 priority levels
    // }
    // function updateLog(content2) {
    //   // aka legend
    //   // categories
    //   // counts
    // }



  // BELOW MAY ALL CHANGE with more complex line:
    // FETCH NODES from this selected rail route
    var path = [];

    // Number of steps to use in the arc and animation, more steps means
    // a smoother arc and animation, but too many steps will result in a
    // low frame rate
    var steps = 500;

    // Draw an arc between the `start` & `end` of the two points
    for (var i = 0; i < lineDistance; i += lineDistance / steps) {
        var segment = turf.along(route.features[0], i, 'miles');
        arc.push(segment.geometry.coordinates);
    }

    // Update the route with calculated arc coordinates
    route.features[0].geometry.coordinates = arc;

    // Used to increment the value of the point measurement against the route.
    var counter = 0;

  map.on('load', function () {
    // Add a source and layer displaying a point which will be animated in a circle.
    map.addSource('route', {
        "type": "geojson",
        "data": route
    });

    map.addSource('point', {
        "type": "geojson",
        "data": point
    });

    // COMPLETE LINE OF ROUTE
    map.addLayer({
        "id": "route",
        "source": "route",
        "type": "line",
        "paint": {
            "line-width": 2,
            "line-color": "#007cbf"
        }
    });

    // ROUTE PASSED

    // ROUTE TO COME

    // TRAIN ICON as animated point visual with proper bearing
    map.addLayer({
        "id": "point",
        "source": "point",
        "type": "symbol",
        "layout": {
            "icon-image": "airport-15",
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true
        }
    });

    function animatePoint() {

        // Update point geometry to a new position based on counter denoting
        // the index to access the arc.
        point.features[0].geometry.coordinates = route.features[0].geometry.coordinates[counter];

        // Calculate the bearing to ensure the icon is rotated to match the route arc
        // The bearing is calculate between the current point and the next point, except
        // at the end of the arc use the previous point and the current point
        point.features[0].properties.bearing = turf.bearing(
            turf.point(route.features[0].geometry.coordinates[counter >= steps ? counter - 1 : counter]),
            turf.point(route.features[0].geometry.coordinates[counter >= steps ? counter : counter + 1])
        );

        // Update the source with this new data.
        map.getSource('point').setData(point);

        // Request the next frame of animation so long the end has not been reached.
        if (counter < steps) {
            requestAnimationFrame(animate);
        }

        counter = counter + 1;
    }

// DATA REVEALED AS ANIMATION PROGRESSES
  // Add and remove classes for dynamic styling
    // passed (cumulative/all), just_passed (radius=medium), now_passing (radius=small)
  // var features_passed = [],  // all that have been within radius thus far
  // most_recent_passing = [],  // all within radius upon previous query
  //    features_padding = [],  // all within radius as of current query
  //   new_within_radius = []   // difference between current and previous (newly revealed)

  // ON DATA CHANGE
  // map.on(DATACHANGE, function(e) {

    // select all features currently within x radius of train location

    // var features_passing = map.querySourceFeatures('counties', {
        // sourceLayer: 'original',
        // single out all features where the ‘key’ is equal to the “value” of the specified type
          // "filter": ['==', ['type',['get', 'key']],'value'] // Filter by location? all within x radius of train
        // });

    // var featuresPassed = map.queryRenderedFeatures(trainLocation, {layers: ['name','name']})
    //   // if no features passed, return nothing
    //   if (!featuresPassed.length) {
    //     return;
    //   }
    //   // otherwise, return first in array of features
    //   var featuresPassed = featuresPassed[0];
    //
    //   var withinXradius = turf.js // some function
    //   var withinYradius = turf.js // similar function
    //
    //   // If a nearest library is found
    //   if (withinXYradius !== null) {
    //     // Update the featuresPassed data source to include
    //     // the features currently passing
    //     map.getSource('featuresPassed').setData({
    //       type: 'FeatureCollection',
    //       features: [
    //         new_withinXYradius
    //       ]
    //     }
    //   );
    //   // Create a new polygon layer from the newlyPassing data source
    //     map.addLayer({
    //       id: 'newlyPassing',
    //       type: 'polygon',
    //       source: 'withinXYradius',
    //       paint: {
    //         'polygon-color': '#486DE0'
    //       }
    //     }, 'thisJourney');
    //   }
    // });

    // combine filters?
      // https://www.mapbox.com/help/show-changes-over-time/#combine-the-filters

    // compare to previous list and filter newly added
      // new_within_radius = features_passing - most_recent_passing;

    // new features get extra special style and brief popup intro (?)
      // new_within_radius.style

      // popup
        // popup.setLngLat(e.lngLat)
        //     .setText(feature.properties.COUNTY)
        //     .addTo(map);
            // automatically expire after 5 seconds?

    // current radius list becomes prev_radius
      // most_recent_passing = features_passing;
      // features_passing = [];

  // });

// WOULD BE A NICE TOUCH
  // Zoom to bounds of selected route
    // https://www.mapbox.com/mapbox-gl-js/example/zoomto-linestring/
  // More comprehensive popups upon click when map animation is paused
    // https://www.mapbox.com/help/analysis-with-turf/#add-interactivity

// EVENT LISTENERS

  // UPON CLICK ON MAP OR PAUSE BUTTON, PAUSE ANIMATION
    document.getElementById('pause').addEventListener('click', function() {
      // ??
      // Restart the animation
      animate(counter);

  // UPON DOUBLE CLICK ON MAP, RESET ORIGIN POINT
    // Set the coordinates of the original point back to start
    point.features[0].geometry.coordinates = start;

    // Update the source layer
    map.getSource('point').setData(point);

    // Reset the counter
    counter = 0;

  // UPON CLICK OF PLAY BUTTON
    // Restart the animation.
    animate(counter);

  // ADJUST POINT EN ROUTE
    // Get click coordinates
    var flyTo = [,]; // ??
    // Set the coordinates of the original point back to start
    point.features[0].geometry.coordinates = flyTo;

    // Update the source layer
    map.getSource('point').setData(point);

    // Adjust the counter appropriately
      // counter = ??;
    // Restart the animation.
    animate(counter);

  });

// GET USER SELECTION
  // PROMPT USER FOR ROUTE selection
    // Save inputs as start / end

// INITIATE ACTION
  // Upon click of "Go" button
    // Start the animation.
    animate(counter);

});

});
