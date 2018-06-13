//
// FOR VIA STATIONS:
// make txt file with queries
// wget request for all stations (use github person's in the meantime)
// combine json objects
// batch geocode for lat/long:
// // https://developer.here.com/documentation/batch-geocoder/topics/quick-start-batch-geocode.html
//

ATTEND SEPARATELY:
Alaska??FOR ALL:

AMTRAK:
batch geocode:


var stationNames = {
  ABE: 'Aberdeen, MD',
  ABQ: 'Albuquerque, NM',
  ACA: 'Antioch, CA',
  ACD: 'Arcadia, MO',
  ADM: 'Ardmore, OK',
  AKY: 'Ashland, KY',
  ALB: 'Albany-Rensselaer, NY',
  ALC: 'Alliance, OH',
  ALD: 'Alderson, WV',
  ALI: 'Albion, MI',
  ALN: 'Alton, IL',
  ALP: 'Alpine, TX',
  ALT: 'Altoona, PA',
  ALX: 'Alexandria, VA',
  ALY: 'Albany, OR',
  AMS: 'Amsterdam, NY',
  ANA: 'Anaheim, CA',
  ARB: 'Ann Arbor, MI',
  ARD: 'Ardmore, PA',
  ARK: 'Arkadelphia, AR',
  ARN: 'Auburn, CA',
  ASD: 'Ashland, VA',
  AST: 'Aldershot, ON',
  ATL: 'Atlanta, GA',
  ATN: 'Anniston, AL',
  AUS: 'Austin, TX',
  BAL: 'Baltimore, MD',
  BAM: 'Bangor, MI',
  BAR: 'Barstow, CA',
  BBY: 'Boston, MA (Back Bay)',
  BCV: 'Burke, VA',
  BEL: 'Bellingham, WA',
  BEN: 'Benson, AZ',
  BER: 'Berlin, CT',
  BFD: 'Bakersfield, CA',
  BFX: 'Buffalo, NY (Exchange St)',
  BHG: 'Benton Harbor, MI (Golf Club)',
  BHM: 'Birmingham, AL',
  BKY: 'Berkeley, CA',
  BLF: 'Bellows Falls, VT',
  BMT: 'Beaumont, TX',
  BNC: 'Burlington, NC',
  BNG: 'Bingen, WA',
  BNL: 'Bloomington-Normal, IL',
  BON: 'Boston, MA (North)',
  BOS: 'Boston, MA (South)',
  BRA: 'Brattleboro, VT',
  BRH: 'Brookhaven, MS',
  BRK: 'Brunswick, ME',
  BRL: 'Burlington, IA',
  BRO: 'Browning, MT',
  BRP: 'Bridgeport, CT',
  BTL: 'Battle Creek, MI',
  BUF: 'Buffalo, NY (Depew)',
  BUR: 'Burbank, CA',
  BWI: 'BWI Airport, MD',
  BYN: 'Bryan, OH',
  CAM: 'Camden, SC',
  CBR: 'Cleburne, TX',
  CBN: 'Canadian Border',
  CBS: 'Columbus, WI',
  CBV: 'Carlsbad, CA',
  CDL: 'Carbondale, IL',
  CEN: 'Centralia, IL',
  CHI: 'Chicago, IL',
  CHM: 'Champaign, IL',
  CHS: 'Charleston, SC',
  CHW: 'Charleston, WV',
  CIC: 'Chico, CA',
  CIN: 'Cincinnati, OH',
  CLA: 'Claremont, NH',
  CLB: 'Columbia, SC',
  CLE: 'Cleveland, OH',
  CLF: 'Clifton Forge, VA',
  CLP: 'Culpeper, VA',
  CLT: 'Charlotte, NC',
  CML: 'Camarillo, CA',
  CMO: 'Chemult, OR',
  CNV: 'Castleton, VT',
  COC: 'Corcoran, CA',
  COI: 'Connersville, IN',
  COT: 'Coatesville, PA',
  COV: 'Connellsville, PA',
  COX: 'Colfax, CA',
  CPN: 'Carpinteria, CA',
  CRF: 'Crawfordsville, IN',
  CRN: 'Creston, IA',
  CRT: 'Croton-Harmon, NY',
  CRV: 'Carlinville, IL',
  CSN: 'Clemson, SC',
  CTL: 'Centralia, WA',
  CUM: 'Cumberland, MD',
  CUT: 'Cut Bank, MT',
  CVS: 'Charlottesville, VA',
  CWH: 'Cornwells Heights, PA',
  CWT: 'Chatsworth, CA',
  CYN: 'Cary, NC',
  DAL: 'Dallas, TX',
  DAN: 'Danville, VA',
  DAV: 'Davis, CA',
  DDG: 'Dodge City, KS',
  DEM: 'Deming, NM',
  DEN: 'Denver, CO',
  DER: 'Dearborn, MI',
  DET: 'Detroit, MI',
  DFB: 'Deerfield Beach, FL',
  DHM: 'Durham, NH',
  DIL: 'Dillon, SC',
  DLB: 'Delray Beach, FL',
  DLD: 'DeLand, FL',
  DLK: 'Detroit Lakes, MN',
  DNC: 'Durham, NC',
  DNK: 'Denmark, SC',
  DOA: 'Dowagiac, MI',
  DOV: 'Dover, NH',
  DOW: 'Downingtown, PA',
  DQN: 'Du Quoin, IL',
  DRD: 'Durand, MI',
  DRT: 'Del Rio, TX',
  DUN: 'Dunsmuir, CA',
  DVL: 'Devils Lake, ND',
  DWT: 'Dwight, IL',
  DYE: 'Dyer, IN',
  EDM: 'Edmonds, WA',
  EFG: 'Effingham, IL',
  EKH: 'Elkhart, IN',
  ELK: 'Elko, NV',
  ELP: 'El Paso, TX',
  ELT: 'Elizabethtown, PA',
  ELY: 'Elyria, OH',
  EMY: 'Emeryville, CA',
  EPH: 'Ephrata, WA',
  ERI: 'Erie, PA',
  ESM: 'Essex, MT',
  ESX: 'Essex Junction, VT',
  EUG: 'Eugene, OR',
  EVR: 'Everett, WA',
  EWR: 'Newark Airport, NJ',
  EXR: 'Exeter, NH',
  EXT: 'Exton, PA',
  FAR: 'Fargo, ND',
  FAY: 'Fayetteville, NC',
  FBG: 'Fredericksburg, VA',
  FED: 'Fort Edward, NY',
  FFV: 'Fairfield-Vacavlle, CA',
  FLG: 'Flagstaff, AZ',
  FLN: 'Flint, MI',
  FLO: 'Florence, SC',
  FMD: 'Fort Madison, IA',
  FMG: 'Fort Morgan, CO',
  FMT: 'Fremont, CA',
  FNO: 'Fresno, CA',
  FRA: 'Framingham, MA',
  FRE: 'Freeport, ME',
  FTC: 'Ticonderoga, NY',
  FTL: 'Fort Lauderdale, FL',
  FTN: 'Fulton, KY',
  FTW: 'Fort Worth, TX',
  FUL: 'Fullerton, CA',
  GAC: 'Santa Clara, CA (Great America)',
  GAS: 'Gastonia, NC',
  GBB: 'Galesburg, IL',
  GCK: 'Garden City, KS',
  GDL: 'Glendale, CA',
  GFD: 'Greenfield, MA',
  GFK: 'Grand Forks, ND',
  GGW: 'Glasgow, MT',
  GJT: 'Grand Junction, CO',
  GLE: 'Gainesville, TX',
  GLM: 'Gilman, IL',
  GLN: 'Glenview, IL',
  GLP: 'Gallup, NM',
  GMS: 'Grimsby, ON',
  GNB: 'Greensburg, PA',
  GNS: 'Gainesville, GA',
  GPK: 'East Glacier Park, MT',
  GRA: 'Granby, CO',
  GRI: 'Green River, UT',
  GRO: 'Greensboro, NC',
  GRR: 'Grand Rapids, MI',
  GRV: 'Greenville, SC',
  GSC: 'Glenwood Springs, CO',
  GTA: 'Goleta, CA',
  GUA: 'Guadalupe, CA',
  GVB: 'Grover Beach, CA',
  GWD: 'Greenwood, MS',
  HAM: 'Hamlet, NC',
  HAR: 'Harrisburg, PA',
  HAS: 'Hastings, NE',
  HAV: 'Havre, MT',
  HAY: 'Hayward, CA',
  HAZ: 'Hazlehurst, MS',
  HBG: 'Hattiesburg, MS',
  HEM: 'Hermann, MO',
  HER: 'Helper, UT',
  HFD: 'Hartford, CT',
  HFY: 'Harpers Ferry, WV',
  HGD: 'Huntingdon, PA',
  HHL: 'Haverhill, MA',
  HIN: 'Hinton, WV',
  HLD: 'Holdrege, NE',
  HLK: 'Holyoke, MA',
  HMD: 'Hammond, LA',
  HMI: 'Hammond, IN',
  HMW: 'Homewood, IL',
  HNF: 'Hanford, CA',
  HOL: 'Hollywood, FL',
  HOM: 'Holland, MI',
  HOP: 'Hope, AR',
  HOS: 'Houston, TX',
  HPT: 'High Point, NC',
  HUD: 'Hudson, NY',
  HUN: 'Huntington, WV',
  HUT: 'Hutchinson, KS',
  IDP: 'Independence, MO',
  IND: 'Indianapolis, IN',
  IRV: 'Irvine, CA',
  JAN: 'Jackson, MS',
  JAX: 'Jacksonville, FL',
  JEF: 'Jefferson City, MO',
  JOL: 'Joliet, IL',
  JSP: 'Jesup, GA',
  JST: 'Johnstown, PA',
  JXN: 'Jackson, MI',
  KAL: 'Kalamazoo, MI',
  KAN: 'Kannapolis, NC',
  KCY: 'Kansas City, MO',
  KEE: 'Kewanee, IL',
  KEL: 'Kelso, WA',
  KFS: 'Klamath Falls, OR',
  KIN: 'Kingston, RI',
  KIS: 'Kissimmee, FL',
  KKI: 'Kankakee, IL',
  KNG: 'Kingman, AZ',
  KTR: 'Kingstree, SC',
  KWD: 'Kirkwood, MO',
  LAB: 'Latrobe, PA',
  LAF: 'Lafayette, IN',
  LAG: 'La Grange, IL',
  LAJ: 'La Junta, CO',
  LAK: 'Lakeland, FL',
  LAP: 'La Plata, MO',
  LAU: 'Laurel, MS',
  LAX: 'Los Angeles, CA',
  LCH: 'Lake Charles, LA',
  LCN: 'Lincoln, IL',
  LDB: 'Lordsburg, NM',
  LEE: 'Lee\'s Summit, MO',
  LEW: 'Lewistown, PA',
  LEX: 'Lexington, NC',
  LFT: 'Lafayette, LA',
  LIB: 'Libby, MT',
  LKL: 'Lakeland, FL',
  LMR: 'Lamar, CO',
  LMY: 'Lamy, NM',
  LNC: 'Lancaster, PA',
  LNK: 'Lincoln, NE',
  LNS: 'East Lansing, MI',
  LOD: 'Lodi, CA',
  LOR: 'Lorton, VA',
  LPE: 'Lapeer, MI',
  LPS: 'Surf, CA',
  LRC: 'Lawrence, KS',
  LRK: 'Little Rock, AR',
  LSE: 'La Crosse, WI',
  LSV: 'Las Vegas, NM',
  LVW: 'Longview, TX',
  LWA: 'Leavenworth, WA',
  LYH: 'Lynchburg, VA',
  MAC: 'Macomb, IL',
  MAL: 'Malta, MT',
  MAT: 'Mattoon, IL',
  MAY: 'Maysville, KY',
  MCB: 'McComb, MS',
  MCD: 'Merced, CA',
  MCG: 'McGregor, TX',
  MCI: 'Michigan City, IN',
  MCK: 'McCook, NE',
  MDN: 'Meriden, CT',
  MDR: 'Madera, CA',
  MDT: 'Mendota, IL',
  MEI: 'Meridian, MS',
  MEM: 'Memphis, TN',
  MET: 'Metropark, NJ',
  MHL: 'Marshall, TX',
  MIA: 'Miami, FL',
  MID: 'Middletown, PA',
  MIN: 'Mineola, TX',
  MJY: 'Mount Joy, PA',
  MKA: 'Milwaukee, WI (Airport)',
  MKE: 'Milwaukee, WI (Downtown)',
  MKS: 'Marks, MS',
  MNG: 'Montgomery, WV',
  MOD: 'Modesto, CA',
  MOT: 'Minot, ND',
  MPK: 'Moorpark, CA',
  MPR: 'Montpelier, VT',
  MRB: 'Martinsburg, WV',
  MRC: 'Maricopa, AZ',
  MSP: 'St. Paul, MN',
  MSS: 'Manassas, VA',
  MTP: 'Mount Pleasant, IA',
  MTR: 'Montreal, QC',
  MTZ: 'Martinez, CA',
  MVN: 'Malvern, AR',
  MVW: 'Mount Vernon, WA',
  MYS: 'Mystic, CT',
  NBK: 'New Brunswick, NJ',
  NBN: 'Newbern, TN',
  NBU: 'New Buffalo, MI',
  NCR: 'New Carrollton, MD',
  NDL: 'Needles, CA',
  NEW: 'Newton, KS',
  NFK: 'Norfolk, VA',
  NFL: 'Niagara Falls, NY',
  NFS: 'Niagara Falls, ON',
  NHT: 'Northampton, MA',
  NHV: 'New Haven, CT',
  NIB: 'New Iberia, LA',
  NLC: 'New London, CT',
  NLS: 'Niles, MI',
  NOL: 'New Orleans, LA',
  NOR: 'Norman, OK',
  NPN: 'Newport News, VA',
  NPV: 'Naperville, IL',
  NRK: 'Newark, DE',
  NRO: 'New Rochelle, NY',
  NSF: 'NC State Fair',
  NWK: 'Newark, NJ',
  NYF: 'NY State Fair',
  NYP: 'New York, NY (Penn)',
  NYG: 'New York, NY (GCT)',
  OAC: 'Oakland Coliseum, CA',
  OKC: 'Oklahoma City, OK',
  OKE: 'Okeechobee, FL',
  OKJ: 'Oakland, CA',
  OKL: 'Oakville, ON',
  OLT: 'San Diego, CA (Old Town)',
  OLW: 'Lacey, WA',
  OMA: 'Omaha, NE',
  ONA: 'Ontario, CA',
  ORB: 'Old Orchard Beach, ME',
  ORC: 'Oregon City, OR',
  ORL: 'Orlando, FL',
  OSB: 'Old Saybrook, CT',
  OSC: 'Osceola, IA',
  OSD: 'Oceanside, CA',
  OTM: 'Ottumwa, IA',
  OXN: 'Oxnard, CA',
  PAK: 'Palatka, FL',
  PAO: 'Paoli, PA',
  PAR: 'Parkesburg, PA',
  PBF: 'Poplar Bluff, MO',
  PCT: 'Princeton, IL',
  PDX: 'Portland, OR',
  PGH: 'Pittsburgh, PA',
  PHL: 'Philadelphia, PA',
  PHN: 'North Philadelphia, PA',
  PIC: 'Picayune, MS',
  PIT: 'Pittsfield, MA',
  PJC: 'Princeton Junction, NJ',
  PLB: 'Plattsburgh, NY',
  PLO: 'Plano, IL',
  PNT: 'Pontiac, MI',
  POG: 'Portage, WI',
  POH: 'Port Henry, NY',
  PON: 'Pontiac, IL',
  POR: 'Portland, ME',
  POS: 'Pomona, CA',
  POU: 'Poughkeepsie, NY',
  PRB: 'Paso Robles, CA',
  PRC: 'Prince, WV',
  PRK: 'Port Kent, NY',
  PRO: 'Provo, UT',
  PSC: 'Pasco, WA',
  PSN: 'Palm Springs, CA',
  PTB: 'Petersburg, VA',
  PTH: 'Port Huron, MI',
  PUR: 'Purcell, OK',
  PVD: 'Providence, RI',
  PVL: 'Pauls Valley, OK',
  QAN: 'Quantico, VA',
  QCY: 'Quincy, IL',
  RAT: 'Raton, NM',
  RDD: 'Redding, CA',
  RDW: 'Red Wing, MN',
  REN: 'Rensselaer, IN',
  RGH: 'Raleigh, NC',
  RHI: 'Rhinecliff-Kingston, NY',
  RIC: 'Richmond, CA',
  RIV: 'Riverside, CA',
  RKV: 'Rockville, MD',
  RLN: 'Rocklin, CA',
  RMT: 'Rocky Mount, NC',
  RNO: 'Reno, NV',
  RNK: 'Roanoke, VA',
  ROC: 'Rochester, NY',
  ROM: 'Rome, NY',
  ROY: 'Royal Oak, MI',
  RPH: 'Randolph, VT',
  RSP: 'Rouses Point, NY',
  RSV: 'Roseville, CA',
  RTE: 'Route 128, MA',
  RTL: 'Rantoul, IL',
  RUD: 'Rutland, VT',
  RUG: 'Rugby, ND',
  RVM: 'Richmond, VA (Main St)',
  RVR: 'Richmond, VA (Staples Mill)',
  SAB: 'St Albans, VT',
  SAC: 'Sacramento, CA',
  SAL: 'Salisbury, NC',
  SAN: 'San Diego, CA (Santa Fe)',
  SAO: 'Saco, ME',
  SAR: 'Saratoga Springs, NY',
  SAS: 'San Antonio, TX',
  SAV: 'Savannah, GA',
  SBA: 'Santa Barbara, CA',
  SBG: 'Sebring, FL',
  SBY: 'Shelby, MT',
  SCA: 'St. Catharines, ON',
  SCC: 'Santa Clara, CA (University)',
  SCD: 'St. Cloud, MN',
  SCH: 'Schriever, LA',
  SDL: 'Slidell, LA',
  SDY: 'Schenectady, NY',
  SEA: 'Seattle, WA',
  SED: 'Sedalia, MO',
  SFA: 'Sanford, FL',
  SIM: 'Simi Valley, CA',
  SJC: 'San Jose, CA',
  SJM: 'St. Joseph, MI',
  SKN: 'Stockton, CA (SJ St)',
  SKT: 'Stockton, CA (Downtown)',
  SKY: 'Sandusky, OH',
  SLC: 'Salt Lake City, UT',
  SLM: 'Salem, OR',
  SLO: 'San Luis Obispo, CA',
  SLQ: 'St. Lambert, QC',
  SMC: 'San Marcos, TX',
  SMT: 'Summit, IL',
  SNA: 'Santa Ana, CA',
  SNB: 'San Bernardino, CA',
  SNC: 'San Juan Capistrano, CA',
  SND: 'Sanderson, TX',
  SNP: 'San Clemente, CA',
  SNS: 'Salinas, CA',
  SOB: 'South Bend, IN',
  SOL: 'Solana Beach, CA',
  SOP: 'Southern Pines, NC',
  SPB: 'Spartanburg, SC',
  SPG: 'Springfield, MA',
  SPI: 'Springfield, IL',
  SPK: 'Spokane, WA',
  SPL: 'Staples, MN',
  SPM: 'South Portsmouth, KY',
  SPT: 'Sandpoint, ID',
  SRB: 'Sorrento Valley, CA',
  SSM: 'Selma-Smithfield, NC',
  STA: 'Staunton, VA',
  STL: 'St. Louis, MO',
  STM: 'Stamford, CT',
  STN: 'Stanley, ND',
  STW: 'Stanwood, WA',
  SUI: 'Suisun-Fairfield, CA',
  SVT: 'Sturtevant, WI',
  SYR: 'Syracuse, NY',
  TAC: 'Tacoma, WA',
  TAY: 'Taylor, TX',
  TCA: 'Toccoa, GA',
  TCL: 'Tuscaloosa, AL',
  THN: 'Thurmond, WV',
  TOH: 'Tomah, WI',
  TOL: 'Toledo, OH',
  TOP: 'Topeka, KS',
  TPA: 'Tampa, FL',
  TPL: 'Temple, TX',
  TRE: 'Trenton, NJ',
  TRI: 'Trinidad, CO',
  TRK: 'Denair, CA',
  TRM: 'Troy, MI',
  TRU: 'Truckee, CA',
  TUK: 'Tukwila, WA',
  TUS: 'Tucson, AZ',
  TWO: 'Toronto, ON',
  TXA: 'Texarkana, AR/TX',
  TYR: 'Tyrone, PA',
  UCA: 'Utica, NY',
  VAC: 'Vancouver, BC',
  VAN: 'Vancouver, WA',
  VEC: 'Ventura, CA',
  VNC: 'Van Nuys, CA',
  VRV: 'Victorville, CA',
  WAB: 'Waterbury, VT',
  WAC: 'Wasco, CA',
  WAH: 'Washington, MO',
  WAR: 'Warrensburg, MO',
  WAS: 'Washington, DC',
  WBG: 'Williamsburg, VA',
  WDB: 'Woodbridge, VA',
  WDL: 'Wisconsin Dells, WI',
  WEM: 'Wells, ME',
  WEN: 'Wenatchee, WA',
  WFD: 'Wallingford, CT',
  WFH: 'Whitefish, MT',
  WGL: 'West Glacier Park, MT',
  WHL: 'Whitehall, NY',
  WIH: 'Wishram, WA',
  WIL: 'Wilmington, DE',
  WIN: 'Winona, MN',
  WIP: 'Fraser, CO',
  WLN: 'Wilson, NC',
  WLO: 'Winslow, AZ',
  WLY: 'Westerly, RI',
  WMJ: 'Williams Junction, AZ',
  WND: 'Windsor, CT',
  WNL: 'Windsor Locks, CT',
  WNM: 'Windsor, VT',
  WNN: 'Winnemucca, NV',
  WNR: 'Walnut Ridge, AR',
  WOB: 'Woburn, MA',
  WOR: 'Worcester, MA',
  WPB: 'West Palm Beach, FL',
  WPK: 'Winter Park, FL',
  WPR: 'Winter Park, CO',
  WPT: 'Wolf Point, MT',
  WRJ: 'White River Junction, VT',
  WSP: 'Westport, NY',
  WSS: 'White Sulphur Springs, WV',
  WTH: 'Winter Haven, FL',
  WTI: 'Waterloo, IN',
  WTN: 'Williston, ND',
  YAZ: 'Yazoo City, MS',
  YEM: 'Yemassee, SC',
  YNY: 'Yonkers, NY',
  YUM: 'Yuma, AZ'
};
https://asm.transitdocs.com/js/stations.json

FORM
<input autocomplete="off" id="stationSelect" name="station" style="visibility: visible;" placeholder="Station name or code" class="es-input" type="text">
<input value="Lookup" class="button button_disabled" id="sta_button" onclick="return load_station(station.value);" disabled="" type="submit">


function load_station(allStations)
{
var startPt = allStations.match(/^\[([A-Z]{3})\]/i);
return a?(window.location="https://asm.transitdocs.com/station/"+a[1],
!1):3==t.length&&(window.location="https://asm.transitdocs.com/station/"+t,
!1)}$(document).ready(function(){

		<form>
			<div id="trainForm">
				<label for="trainIdSelect">Train Number</label>
				<input type="text" id="trainIdSelect" name="trainId">

        </div>

			LETS GO:
      <input type="submit" value="Lookup" class="button button_disabled" id="train_button" onClick= "return load_train(trainId.value);" disabled>
		</form>


AMTRAK:
VIA: http://reservia.viarail.ca/GetStations.aspx?q=Y [A-Z]
 '//maps.amtrak.com/rttl/js/RoutesList.v.json'
    route_list_url: hostConfig.hostPath + '/js/RoutesList.json',
    route_listview_url: hostConfig.hostPath + '/js/RoutesList.v.json',
    https://asm.transitdocs.com/js/stations.json
	 route_properties_url: hostConfig.hostPath + '/js/route_properties.json',

        'ID',
        'TrainNum',
        'Aliases',
        'OrigSchDep',
        'OriginTZ',
        'TrainState',
        'Velocity',
        'RouteName',
        'CMSID',
        'OrigCode',
        'DestCode',
        'EventCode'
$.ajax({
            url: contextPath + "/AjxUpdStRes",
            type: "GET",
            iframe: true,
            data: {
                lat: mapBounds.getCenter().lat(),
                lon: mapBounds.getCenter().lng(),
                // Note: radius computation is in meters. Convert to feet.
                radius: Math.floor(3.28084 * ((cirRadius > MAX_RADIUS) ? MAX_RADIUS : cirRadius)),
                excludeBus: true
            }
        }).done(function (data) {
            if (data.resultType !== "LatLong") {
                return;
            }
            stationOrder = stationOrder.concat(data._stations);
            stationOrder.forEach(function (s) {
                if (station[s._stationID].markerDetail === null) {
                    var markerOptions = {
                        lat: s._latitude,
                        lon: s._longitude,
                        iw: s._info,
                        title: (
                            s._city + ", " +
                            s._state +
                            ((s._stationName !== null && s._stationName.length) ? "-" + s._stationName : "")
                        ),
                        isBus: s._isBusStation
                    };
            //contextPath = '/amtrak';

            // Set Street View Data
            $.getJSON(config.hostPath + '/js/data/street-view.json', function (data) {

            });
 webservices: {
        mapdataservice: {
            getStationInfoMethodUrl: '//' + config.mapDataServiceHost + '/' + config.mapDataServiceRoot + '/MapDataService/StationInfo/getStationInfo?stationCode=',
            getAllStationsMethodUrl: '//' + config.mapDataServiceHost + '/' + config.mapDataServiceRoot + '/MapDataService/stations/allStations',
            allStations: 'https://' + config.aemHost + '/services/contentService.stations.json',
            //allStations: 'js/data/contentService.stations.json',
            stationPage: "https://" + config.aemHost + "/content/amtrak/en-us/stations/"
        }
        //
        // '/js/routes/routes_manifest.json

// VIA RAIL SORT
// data/allData.json
var sortedTrains = Object.keys(allData).sort(function(a, b) {
		var aNum = a.indexOf(' ') === -1 ?
				a:
				a.slice(0, a.indexOf(' '));

		var bNum = b.indexOf(' ') === -1 ?
				b:
				b.slice(0, b.indexOf(' '));

		if (aNum === bNum) {
			var aDate = a.slice(a.indexOf('(') + 1, -1); // get date, ignoring parentheses
			var bDate = b.slice(b.indexOf('(') + 1, -1);

			return new Date(aDate) - new Date(bDate);
		} else {
			return aNum - bNum;
		}
	});
  function formatLi(train) {
		return train.indexOf('(') === -1 ?
			'<span class="trainVal">' + train + '</span>':
			'<span class="trainVal">' + train.slice(0, train.indexOf(' ')) + ' <span class="not-departed">' + train.slice(train.indexOf('(')) + '</span></span> <span class="glyphicon glyphicon-question-sign" data-toggle="tooltip" data-placement="left" data-trigger="click" title="' + (lang === "en" ? "Departure Date": "Jour de Départ") + '"></span>';
	}

let chosenRoute = {

    // eg
    start:

    end: {

    }
  }

currentRoute = {
  stationNodes
  allNodes
}
currentPoint = get.
var coordinates = {lat: allData[currTrain]['lat'], lng: allData[currTrain]['lng']};


rrCom,routeName,stations






// SQL / Data
  // select * from focus_train.canada_rail_stns where city in ('New York','Eugene','Vancouver','DC','D.C.','Seattle','Detroit','Chicago','Boston','Edmonton','Truro','Quebec City','Winnipeg','Saskatoon','Regina','Sarnia','Kapuskasing','Prince Rupert','Ontario','Kingston','Port Arthur','Duluth','Calgary','Lethbridge','Moose Jaw','Rocky Mountains','Sault Ste Marie','Yarmouth','Windsor','Portland','Minneapolis','St Paul','St. Paul','Denver','Buffalo','Philadelphia','Cleveland','Prince George','Whistler','Squamish','Senneterre','Sydney','Kentville','Churchhill','Courtenay','Skagway','Fraser','San Francisco','Grand Junction','Green River','Flagstaff','Albuquerque','New Orleans','Pittsburgh','Tucson','St Louis','St. Louis','Sault Ste. Marie','Austin','Asheville','Ottumwa','Osceola','Milwaukee')



// create table focus_train.na_rail_stns as
// (select 1 as id, geom, null as lat,null as lon,stncode as stn_code,null as stn_name,stnname as name_lng,null as rr_comp,city,null as county,state,null as province,'USA' as country,null as osm_wiki, id::varchar as oid, objectid::varchar as orig_oid
// from focus_train.amtrak_rail_stns)
// union
// (select 2 as id, geom,lat,lon,sc as stn_code,sn as stn_name,name_o as name_lng,null as rr_comp,city,county,state,pv as province,country,null as osm_wiki, id::varchar as oid,recid::varchar as orig_oid
// from focus_train.canada_rail_stns)
// union
// (select 3 as id, geom, null as lat,null as lon, "ref:amtrak" as stn_code,name as stn_name,alt_name as name_lng,operator as rr_comp,null as city,null as county,null as state,null as province,null as country,wikidata as osm_wiki, id::varchar as oid,"@id" as orig_oid
// from focus_train.osm_rail_merged)
// order by id,state,stn_name
