
  var platform = new H.service.Platform({
    'app_id': '{YOUR_APP_ID}',
    'app_code': '{YOUR_APP_CODE}'
  });


apiCall(startCoords,endCoords)

https://route.cit.api.here.com/routing/7.2/calculateroute.json?
&waypoint0=geo!50.8857,14.81589
&waypoint1=geo!50.8681536,14.8308207
&mode=fastest%3BpublicTransport
&avoidtransporttypes=railMetro%2CrailLight%2CrailRegional%2CtrainRegional
&combineChange=true
&routeattributes=wp,sm,sh,sc

&waypoint0=geo!{startCoords[0]}{startCoords[1]};;Origin   // startpoint with label
&waypoint1=geo!{endCoords[0]}{endCoords[1]};;Destination  // endpoint with label
&representation: overview (?),ORlinkpaging?;               // test both for my needs!
&routeAttributeType: wp,sm,sh,bb,lg,no,li,la,ri,zo
&routeLegAttributes: wp,li,le,tt,sh,bt,sm
&routeLinkAttributes: sh,le,(tz-slowsthingdown),nl,pt,rt,rd,ns
&publicTransportLineAttributes:ls,cs,tn?,li,ci?,si?,st
&jsonAttributes=16,32 // OR &jsonAttributes=16,64 so that I can request returnelevation=true
&requestId=##
metricSystem=imperial?

&avoidTransportTypes=busPublic%2CbusTouristic%2CbustIntercity%2CbusExpress%2CrailMetro%2CrailMetroRegional%2CrailLight%2CprivateService%2CmonoRail    // hoping for: trainHighSpeed,trainIntercity,trainRegional?
&combineChange=true    // in case of transport line change, makes parsing client-side much easier
&jsonCallback=parse(routeData)  // name of user defined function!
&metricSystem=imperial
app_code=K4UnG46a6j5YXg3QucpK3w
&app_id=MSivPhUxnH2qCqaJWGfo


??
jsonAttributes=9 // 	Flag to control JSON output. Combine parameters by adding their values. See also JSON Representation .
generalizationTolerances




function parse(routeData) {
  // potentially receiving:
  Route summary: waypts,summary,shape,bbox,notes,lines,labels,legs;
    Route legs: waypts,length links:
      Route links

  // provide user feedback, e.g. 'You have chosen to travel from {ptA} to {ptB} on {railCompany}'s {lineName} line. IRL, this route would take you about {travelTime} to complete, but we are going to more a little more quickly. Keep your eye on the dashboard and journey log for more details as the journey unfolds in {countdown?... until data loads?}'

  // OUTPUT initial orienting data to dashboard (and store for easy updating)
    // total length (leg length sum?)
    // full travel time(basetime?)
    // remainTime, remainDistance


  // ENRICH route by pairing POIs and other geo data
    // pass leg waypoints AND/OR links as 'chunks' for intersect comparisons
    // pass 'notes' if relevant?

  // Set up map / get ready!
    // flyTo route.boundingBox;
    // start binding data + transitions to DOM
}

function prepare(routeViz){
  // bind subtle, static underlay outlining chosen route path

}

function enrich(route){

}



// use to prepare more ENRICH data
  //
//  could use for display purposes if I choose to og that route:
  // full shape, leg shapes,
  // linestyle


waypoints,summary,shape,boundingBox,legs,notes,lines,labels,routeId(mightfail),zones (?):

return waypoints,links,length,traveltime,shape,basetime?,summary

shape,length,nextlink,publictransportline,remaintime,remaindistance,nextstopname

linestyle,company short name,type name?,lineid,companyid?,systemid?,stops






MIGHT be in response:

 adminDivisionChange: Indicates that some part of route crosses administrative division border (state, province, etc.)
countryChange: Indicates that some part of route crosses country border.
passingPlace **


*ShapeQualityTpe: exact or coarse :(


RouteLinkFlagType: tunnel
RouteNoteCodeType:
passingPlace,linkFeatureAhead,adminDivisionChange,countryChange



```JAVASCRIPT

    <meta name="viewport" content="initial-scale=1.0,
      width=device-width" />


@param   {H.service.Platform} platform

function calculateRoute(platform) {
  var router = platform.getRoutingService(),
    parameters = {
      waypoint0: '52.5208,13.4093',
      waypoint1: '52.5034,13.3295',
      mode: 'fastest;publicTransport',
      combineChange: 'true'
    };

  router.calculateRoute(parameters,
    function (result) {
      alert(result);
    }, function (error) {
      alert(error);
    });
}


<label class="param-label" for="params-waypoint0">waypoint0</label>
<input checked="checked" type="checkbox">


data-toggle="tooltip"
as attribute?

<label class="param-label" for="params-waypoint1">waypoint1</label>
<input checked="checked" type="checkbox">

    let default = ?
  <input class="form-control " id="params-waypoint0" value={default?} name="waypoint0" data-type="latlng" data-method="params">


<input class="form-control " id="params-waypoint1" value="52.5206,13.3862" name="waypoint1" data-type="latlng" data-method="params">

    <label class="param-label" for="params-mode">mode</label>

       <input class="form-control " id="params-mode" value="fastest;car;traffic:enabled" name="mode" data-type="text" data-method="params">


  <label class="param-label" for="params-app_id">app_id</label>
              <input checked="checked" type="checkbox">

            <td class="col-md-10" data-toggle="tooltip" title="" data-original-title="A 20 byte Base64 URL-safe encoded string used for the authentication of the client application.<br></td><br/>You must include an <code>app_id</code> with every request.">

                 <input class="form-control " id="params-app_id" value="DemoAppId01082013GAL" name="app_id" data-type="text" data-method="params">


    <label class="param-label" for="params-app_code">app_code</label>
    <input checked="checked" type="checkbox">

    <input class="form-control " id="params-app_code" value="AJKnXv84fjrb0KIHawS0Tg" name="app_code" data-type="text" data-method="params">

<label class="param-label" for="params-departure">departure</label>
              <input checked="checked" type="checkbox">
                 <input class="form-control " id="params-departure" value="now" name="departure" data-type="text" data-method="params">

    <button id="go-btn" class="btn btn-sm btn-primary" data-loading-text="Requesting...">Send Request</button>

    <input class="form-control " id="params-waypoint1" value="52.5206,13.3862" name="waypoint1" data-type="latlng" data-method="params">  Send Request


  <label class="param-label" for="<%=method%>-<%=item.key%>"><%=item.key%></label>

<select class="form-control selectpicker <%=item.enabled ? '' : 'disabled'%>" id="<%=method%>-<%=item.key%>" value="<%=item.value%>" name="<%=item.key%>" data-type="<%=item.type%>" data-method="<%=method%>" >



   https://batch.geocoder.cit.api.here.com/6.2/jobs?&app_code=K4UnG46a6j5YXg3QucpK3w&app_id=MSivPhUxnH2qCqaJWGfo&action=run&mailto=%3Ckafunk@gmail.com%3E&header=true&indelim=%7C&outdelim=%7C&outcols=displayLatitude%2CdisplayLongitude%2ClocationLabel%2ChouseNumber%2Cstreet%2Cdistrict%2Ccity%2CpostalCode%2Ccounty%2Cstate%2Ccountry&outputCombined=false
