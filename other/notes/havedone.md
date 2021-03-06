## IN NO HUGELY SPECIFIC ORDER  
### _just have to get these notes out of my main.js_

- clicking on log name while animated paused/stopped zooms to feature
- disabling panning while waiting for user input
- refactored zoomClick function
- remove reliance on label#zoomBtns value
- scaleExtent set and updated in adjustSize and resetZoom
- no need for limit-reached class
- recalc scaleExtent on adjustSize?
- FIXED: post zoomclick button press, spacebar triggers further zoom? (chrome); fixed with prevent default
- pannedState => transformAdjustments with zoom property for zoomRespect flagging
- remove need for 'active' var
- setup (and comment out again) transformAdjustments.zoomed.strayFlag to track user departure from zoom0, prompting adjustSize() to calculate new transform vs call resetZoom
  - related to above (done then undone):
  - resolved issues when using with aside collapse/expand (thrown with click sourceEvents)
  - zoomclick doesn't fire zoomevent (dispatch custom)
- filter dblclicks from svg.on('click') to ensure reset background still accessible
- resetting zoom during animation triggers zoomRespect/transitionResume flags like anything other transform
- take only what i need from turf.js
- automatically order legend log categories
- new train icon that rotates along with headlights
- mousing over log/narration elements highlights all within map
- ensure contrast of texture features maintains sufficient visibility
- fixed legend-log symbol issue
- fixed: roadless areas being interpreted as pa-grp3
- textures.js svg textures => img srcs that can be rendered in canvas and other html divs
- remaining stations turn greyscale
- start/stop stations remain large and color-coded
- arrow-out to expand about section
- start of pause functionality (pause works; resuming the issue)
- start of effective reset()
- added categorical background-images to currently passing div (communicates differences without relying on intrusive column headings)
- when select new route form not visible, select new route btn !== disabled (plus opposite)
- trainPt, headlights, and fullPath now animations (vs transitions) coordinated with d3.timer
- more improvements to zoom bx and user panning responsivity
- pause functionality
- basic reset functionality
- reverse/replay functionality!
- keep state lines subtly visible through polygon feature reveal
- while animating, single click on map PAUSES (in addition to explicit button)
- double size of background-images that populate sections of "currently passing" by flipping down mirrored version of first, then set background-image to repeat for continuous coverage
- fixed: undisable play/pause visual
- fixed: pa-grp3 count doesn't update appropriately; sometimes pa-grp3 style equivalent to pa-grp2
- automatic ordering of legend-log category (so pa-grp3 does not appear above pa-grp1, even if that is the order in which features were encountered)
- logBackground river should be taller than wide? interweave with mirrored dashed line?
- debug RESET functionality (how to clone without rendering, including bound event listeners and data at select state?) and making less hacksome
- ensure select new route btn in particular maintains original event listeners
- visual affordance/invitation: large transparent play btn simulates 'click' upon animation begin, then visually collapses into much smaller play/pause button in top left corner
- show all of north america (data updates)
- remove projection.fitExtent in favor of zoomToBounds
- adjust strokewidths and icon sizes accordingly
- fix zoom calculations once again (routeBounds, first, last)
- fix reset and adjustSize functions (use currentBounds)
- timeout on tooltips
- slightly simplify train path (improves rrties viz); now train and headlights follow route exactly (rid of semiSimp)
- ensure 'select new route' correctly expands dash
- fix selectnewroute glitches // REMAKE QUADTREE
- fix glitchiness on sibling drag within legend log (due to recent h-full addition?)
- fix zoom jump on about collapse
- adjustsize/reset multiple times to avoid stalling before cache occurs
- first/last identity calculated dynamically, as all other centerTransforms (avoids miszoom if screen size adjusted in the meantime -- esp relevant on reverse)
- browser stuff fixed:
  - firefox: journey log extends container
  - play-pause icons compatible (safari)
  - safari: about down and expand up arrows get cut off / tucked behind other content
  - about pane reopen right DOES NOT WORK; on first open, collapse bar misaligned (fixed on adjustsize()...); subsequently opening causes entire pane to pop off screen (safari)
  - credit bar (bottom right) gets cut off by dash expand on all screen sizes (firefox)
  - make sure manual-close class removed as appropriate
  - no details triangles visible within legend-log (firefox)
  - safari 'select new' cut off
  - watershed html texture doesn't render (legend-log, narrative) (safari and firefox)
  - safari legend-log summary content not on one line
- change otherwise preserved/reserved color (icky orange)
- cues to click or hit spacebar for pause
- add autocomplete/suggestions to R2R search (fixed a few some others)
- addressed remaining PROBLEM CITIES (R2R issue)
- improve center calculations of lrg control icons/text
- fixed cities: atlanta, grand junction, ann arbor, memphis, burlington IA, Greenville SC, cincinnatti, charleston, saskatoon
- instead of only applying rightPad within feature zoom click, adjust whole of map when (window.innerWidth >= 1200 && d3.select("#about").classed("disappear-right")) via slight svg transform
- change strokes on enrich data (incorporate primaryHex of pattern)
- fixed initial routeBoundsIdentity overzooming issues (occured when k2 < k1 || k3 < k1) by having transform take bottomPad into account when calculating scale, but *not* applying bottomPad in actual shift
- even if !zoomFollow.necessary, still adjust zoom (x <= maxInitZoom) and accommodate dash via padBottom
- reintegrate explicit scalePad values on calculated identity transforms
- more sophisticated highlighting (and unhighlighting) within highlightAssoc (stroke and stroke-width)
- fixed double station stop/starts showing
- removed need for getStroke function, reduced repetititve calculations in highlight/unhighlight
- set bottom tether slightly further down for center-controls (bundled in attuneMapBottomDashTop())
- invert geothermal, volcanoes, & inv-roadless pts within html encounters background
- tweak texture processing calculations
