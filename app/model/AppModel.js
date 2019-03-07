var request = require('request-promise');
var config = require('config');
var logger = require('tracer').colorConsole();

var domainValidate = function (domain) {
    var options = {
        method: 'GET',
        uri: config.uri_server + 'app/domain',
        headers: {
            'x-nazara-app-secret-key': secretKey,
        },
        qs: {
            domain_name: domain
        }
    };
    logger.info(options);
    return request(options);
};

var appValidate = function (secretKey, checksum) {
    var options = {
        method: 'GET',
        uri: config.uri_server + 'app',
        headers: {
            'x-nazara-app-secret-key': secretKey,
            'checksum': checksum
        }
    };
    logger.info(options);
    return request(options);
};

var getAppSecret = function (appId){
    var returnValue="";
    appDataList.forEach(element => {
        if(appId == element.appId){
            returnValue = element.app_secret;
        }
    });
    return returnValue;
};

var app = {
    appValidate: appValidate,
    domainValidate: domainValidate,
    getAppSecret
};



module.exports = app;