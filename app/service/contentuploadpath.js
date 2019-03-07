var pgConnection = require('../model/pgConnection');
module.exports = {
    getfilepath: function (contentid, callback) {
        var _getpathQuery = "select * from fn_getcontentuploadpath(" + contentid + ")";
           console.log(_getpathQuery);
        pgConnection.ExecuteQuery(_getpathQuery, function (err, result) {
    console.log("-----------------------------------------------");
            console.log(result);
            var partnername = replaceAll(result[0].data[0].partner, ' ', '');
            var cpname = replaceAll(result[0].data[0].name, ' ', '');
            var contenttype = replaceAll(result[0].data[0].contenttype, ' ', '');
            var category = replaceAll(result[0].data[0].category, ' ', '');
            var subcategory = replaceAll(result[0].data[0].subcategory, ' ', '');
            var contentname = replaceAll(result[0].data[0].contentname, ' ', '');
            var fullpath = partnername + "/" + cpname + "/" + contenttype + "/"
                + category + "/" + subcategory + "/" + contentname ;
            callback('', fullpath);
        });
    }

}
function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}