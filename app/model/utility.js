var md5 = require('md5');
var config = require('config')
var logger = require('tracer').colorConsole();

var CookieNameToMD5 = function (name) {
    return md5(name + "|" + config.cookieMd5Key)
}

var CleanMobileNumber = function (mobileNo) {
    if (mobileNo.length === 13) {
        var pre = mobileNo.substring(0, 3);
        var pos = mobileNo.substring(4, 13);
        if (pre === "254") {
            mobileNo = pre + pos;
        } else {
            pre = mobileNo.substring(0, 2);
            pos = mobileNo.substring(3, 13);
            mobileNo = pre + pos;
        }
        logger.info("Updated Mobile No : ", mobileNo)
    }
    return mobileNo
}

var utility = {
    CookieNameToMD5: CookieNameToMD5,
    CleanMobileNumber: CleanMobileNumber
}



module.exports = utility;