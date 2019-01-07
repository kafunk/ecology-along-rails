// remoteControl module

// import/export things

// PLAY/PAUSE
  function playPause(booElement){
    let playing = (booElement) ? false : true;
    (playing) ? pauseAnimation() : resumeAnimation()
  }
  function pauseAnimation() {
    // capture pause state?
    // g.interrupt()?
    if (experience.animating) {
      let pauseMatrix = g.select("#train-point").node().transform.animVal[0].matrix,
              pausePt = [pauseMatrix.e, pauseMatrix.f];
      experience.animating = false;
      pauseTrain(pausePt);
    }
  }
  function pauseTrain(where){
    // console.log(where)
    // g.interrupt()?
  }
  function resumeAnimation() {
    if (experience.initiated) {
      // get resume point?
      experience.animating = true;
      // goTrain(resumePt,+++)
    } else {
      selectNew()
    }
  }

// REWIND

// REPLAY FROM BEGINNING

// SELECT NEW (ERASE CURRENT)



// function rewindAll(point,path,reversedPath,reversedArc,t) {  // enrichRendered)
//
//   point.transition().delay(3000).duration(tFull).ease(d3.easeLinear)
//   		 .attrTween("transform", translateAlong(reversedPath))
//        // point transition triggers additional elements
//        .on("start", () => {
//          path.transition().duration(t).ease(d3.easeLinear)
//            .styleTween("stroke-dasharray",dashBack)
//          g.transition().duration(t).ease(d3.easeLinear)
//            .attrTween("transform", zoomAlong(reversedArc)) //,scale))
//        })
// }


// d3.select("#replay").on("click", () => {
//   let pausedAt = projection.invert(pauseTrain()),
//      traversed = turf.lineSlice(firstLast[0][0],pausedAt,routeObj.lineString),
//   reversedPath = makeFeature(traversed.geometry.coordinates.slice().reverse(), "LineString"),
//    reversedArc = makeFeature(turf.lineSlice(firstLast[0][0],pausedAt,fullSimp).geometry.coordinates.slice().reverse(), "LineString"),
//        rewindT = turf.length(traversed, {units: "miles"}) * tpm/2;
//
//   g.transition().duration(rewindT)
//     .on("start", rewindAll(point,traversed,reversedPath,reversedArc,rewindT))
//     .on("end", () => {
//       // confirm g exactly in alignment for next transition
//       g.attr("transform",firstIdentity.toString())
//       // restart with same data
//       goTrain(point,path,zoomArc,tprm,tpsm,simpLength,firstLast)
//     })
// });
