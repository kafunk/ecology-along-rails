
// North America Projection

//////////////////////////////////////////
// ROUTING
//
// http://bl.ocks.org/alexhornbake/5980804
//
//
//
//
// ANIMATION
//
//
//
//
// DATA
// Canada rail stations - https://github.com/pndurette/viastations/blob/master/stations_via_full.json
//https://www.viarail.ca/en/explore-our-destinations/trains/regional-trains
//
//
//Sources/Cite/Metadata
//https://www.fra.dot.gov/eLib/Details/L19316
//
// More info:
// http://webarchive.bac-lac.gc.ca:8080/wayback/20140227212043/http://www.collectionscanada.gc.ca/trains/index-e.html
// https://asm.transitdocs.com/map
//



// backup if HERE routing no good:
 $.getJSON('https://asm.transitdocs.com/api/get_coords.php', {
        code: findStation

    var d = 'https://asm.transitdocs.com/train/';
    d += r[2],
    d += '/',
    d += parseInt(r[0]),
    d += '/',
    d += parseInt(r[1]),
    d += '/',
    d += n.number;
    k = 'http://reservia.viarail.ca/tsi/GetTrainStatus.aspx?l=en&TsiCCode=VIA&TsiTrainNumber=';
