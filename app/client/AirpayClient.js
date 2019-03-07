var promise = require("bluebird");
var request = require('request-promise');
var  config = require('config')
var logger = require('tracer').colorConsole();
var md5 = require('md5');
var sha256 = require('sha256');
var dateformat = require('dateformat');
var querystring = require('querystring');
var https = require('https');
var moment = require('moment-timezone');

function createPrivateKey() {
    var udata = config.airpay.username + ':|:' + config.airpay.password;
    var privatekey = sha256(config.airpay.apiKey + '@' + udata);
    return privatekey
}

function airpayRequestOption(path, dataLength) {
    return {
        hostname: config.airpay.baseHost,
        port: 443,
        path: path,
        method: 'POST',
        rejectUnauthorized: false,
        requestCert: true,
        agent: false,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': dataLength,
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/27.0.1453.110 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    }
}

var walletCreate = function (phoneNumber, playerId, callback) {
    var now = moment.tz((new Date()), "Asia/Kolkata").format('YYYY-MM-DD');
    var postData = querystring.stringify({
        mercid: config.airpay.merchantId,
        privatekey: createPrivateKey(),
        buyerEmail: "",
        buyerPhone: phoneNumber,
        buyerFirstName: "fname",
        buyerLastName: "lname",
        UID: playerId,
        outputFormat: config.airpay.outputFormat,
        checksum: md5("" + phoneNumber + "fname" + "lname" + playerId + now + createPrivateKey())
    })

    var options = airpayRequestOption("/wallet/api/walletCreate.php", postData.length);
    logger.info(postData)
    var req = https.request(options, (res) => {
        logger.info('statusCode:', res.statusCode);
        res.on('data', (d) => {
            //   console.log('BODY: ' + d);
            //   process.stdout.write(d);
            var txtData = d.toString('utf8');
            var data = JSON.parse(txtData)
            logger.info(data)
            callback(null, data)
        });
    });

    req.on('error', (e) => {
        // console.error(e);
        callback(e, null)
    });

    req.write(postData);
    req.end();
};

var walletBalance = function (playerId, token, callback) {
    var now = moment.tz((new Date()), "Asia/Kolkata").format('YYYY-MM-DD');
    logger.info("playerid token ", typeof playerId, typeof token, playerId, token)
    var postData = querystring.stringify({
        mercid: config.airpay.merchantId,
        token: token,
        privatekey: createPrivateKey(),
        walletUser: playerId,
        outputFormat: config.airpay.outputFormat,
        checksum: md5(config.airpay.merchantId + token + playerId + now + createPrivateKey())
    })
    // logger.info(md5(config.airpay.merchantId + token + playerId + dateformat(now, 'yyyy-mm-dd') + createPrivateKey()))
    var options = airpayRequestOption("/wallet/api/walletBalance.php", postData.length);
    logger.info(postData)
    var req = https.request(options, (res) => {
        logger.info('statusCode:', res.statusCode);
        res.on('data', (d) => {
            var txtData = d.toString('utf8');
            var data = JSON.parse(txtData)
            logger.info(data)
            callback(null, data)
        });
    });

    req.on('error', (e) => {
        callback(e, null)
    });

    req.write(postData);
    req.end();
};

var walletHistory = function (playerId, token, callback) {
    var now = moment.tz((new Date()), "Asia/Kolkata").format('YYYY-MM-DD');
    var postData = querystring.stringify({
        mercid: config.airpay.merchantId,
        token: token,
        privatekey: createPrivateKey(),
        walletUser: playerId,
        displayorder: "desc",
        displayrec: 100,
        displaypage: 1,
        outputFormat: config.airpay.outputFormat,
        checksum: md5(config.airpay.merchantId + token + playerId + "desc" + 1 + 100 + now + createPrivateKey())
    })

    var options = airpayRequestOption("/wallet/api/walletHistory.php", postData.length);
    logger.info(postData)

    var req = https.request(options, (res) => {
        logger.info('statusCode:', res.statusCode);

        var chunks = '';
        res.on('data', (chunk) => {
            logger.info(chunk.length);
            chunks += chunk;
        });

        res.on('end', () => {
            var txtData = chunks.toString('utf8');
            try {
                var data = JSON.parse(txtData);
                logger.info(data);
                callback(null, data);
            } catch(e) {
                logger.info(txtData);
                callback(e, null);
            }
        });
    });

    req.on('error', (e) => {
        callback(e, null)
    });

    req.write(postData);
    req.end();
};

var walletTransactionDebit = function (playerId, token, txnId, amount, callback) {
    var now = moment.tz((new Date()), "Asia/Kolkata").format('YYYY-MM-DD');
    var encUrl = encodeURI("http://localhost:4000");
    var b64Url = Buffer.from(encUrl).toString('base64')
    var postData = querystring.stringify({
        txnmode: 'debit',
        mercid: config.airpay.merchantId,
        token: token,
        privatekey: createPrivateKey(),
        walletUser: playerId,
        orderid: txnId,
        amount: amount,
        outputFormat: config.airpay.outputFormat,
        mer_dom: b64Url,
        checksum: md5(config.airpay.merchantId + token + playerId + "debit" + txnId + amount + now + createPrivateKey())
    })
    logger.info(postData)
    var options = airpayRequestOption("/wallet/api/walletTxn.php", postData.length);

    var req = https.request(options, (res) => {
        logger.info('statusCode:', res.statusCode);
        res.on('data', (d) => {
            var txtData = d.toString('utf8');
            var data = JSON.parse(txtData)
            logger.info(data)
            callback(null, data)
        });
    });
    req.on('error', (e) => {
        callback(e, null)
    });
    req.write(postData);
    req.end();
};

var walletTransactionCredit = function (playerId, token, txnId, amount, callback) {
    var now = moment.tz((new Date()), "Asia/Kolkata").format('YYYY-MM-DD');
    var encUrl = encodeURI("http://localhost:4000");
    var b64Url = Buffer.from(encUrl).toString('base64')
    var postData = querystring.stringify({
        txnmode: 'credit',
        mercid: config.airpay.merchantId,
        token: token,
        privatekey: createPrivateKey(),
        walletUser: playerId,
        orderid: txnId,
        amount: amount,
        outputFormat: config.airpay.outputFormat,
        mer_dom: b64Url,
        checksum: md5(config.airpay.merchantId + token + playerId + "credit" + txnId + amount + now + createPrivateKey())
    })
    logger.info(postData)
    var options = airpayRequestOption("/wallet/api/walletTxn.php", postData.length);

    var req = https.request(options, (res) => {
        logger.info('statusCode:', res.statusCode);
        res.on('data', function (d)  {
            var txtData = d.toString('utf8');
            var data = JSON.parse(txtData);
            logger.info(data);
            callback(null, data);
        });
    });
    req.on('error', function (e) {
        callback(e, null);
    });
    req.write(postData);
    req.end();
};

var walletTransactionRedeem = function (playerId, token, txnId, amount, channel, payeeIdentifier, callback) {
    var now = moment.tz((new Date()), "Asia/Kolkata").format('YYYY-MM-DD');
    var encUrl = encodeURI(config.AppHost);
    var b64Url = Buffer.from(encUrl).toString('base64');
    // var channel = "upi",
    // payeeIdentifier ="yadav.hanik@okicici";
    var postData = querystring.stringify({
        mercid: config.airpay.merchantId,
        token: token,
        privatekey: createPrivateKey(),
        walletUser: playerId,
        orderid: txnId,
        amount: amount,
        channel: channel,
        payeeIdentifier: payeeIdentifier,
        outputFormat: config.airpay.outputFormat,
        mer_dom: b64Url,
        checksum: md5(config.airpay.merchantId + token + playerId + payeeIdentifier + txnId + amount + channel + now + createPrivateKey())
    });
    logger.info(postData);
    var options = airpayRequestOption("/wallet/api/redeemApi.php", postData.length);

    var req = https.request(options, function (res) {
        logger.info('statusCode:', res.statusCode);
        res.on('data', function (d) {
            var txtData = d.toString('utf8');
            var data = JSON.parse(txtData);
            logger.info(data);
            callback(null, data);
        });
    });
    req.on('error', function (e) {
        callback(e, null);
    });
    req.write(postData);
    req.end();
};

var walletToken = function (mobileNo, playerId, callback) {
    var now = moment.tz((new Date()), "Asia/Kolkata").format('YYYY-MM-DD');
    var postData = querystring.stringify({
        mercid: config.airpay.merchantId,
        privatekey: createPrivateKey(),
        buyerPhone: mobileNo,
        UID:playerId,
        outputFormat: config.airpay.outputFormat,
        checksum: md5(config.airpay.merchantId + "" + mobileNo + playerId + now + createPrivateKey())
    });
    // logger.info(md5(config.airpay.merchantId + token + playerId + dateformat(now, 'yyyy-mm-dd') + createPrivateKey()))
    var options = airpayRequestOption("/wallet/api/walletGetToken.php", postData.length);
    logger.info(postData);
    var req = https.request(options, function (res) {
        logger.info('statusCode:', res.statusCode);
        res.on('data', function(d)  {
            var txtData = d.toString('utf8');
            var data = JSON.parse(txtData);
            logger.info(data);
            callback(null, data);
        });
    });

    req.on('error', function(e) {
        callback(e, null);
    });

    req.write(postData);
    req.end();
};

var airpay = {
    createPrivateKey: createPrivateKey,
    walletCreate: walletCreate,
    walletBalance: walletBalance,
    walletHistory: walletHistory,
    walletTransactionRedeem: walletTransactionRedeem,
    walletTransactionDebit: walletTransactionDebit,
    walletTransactionCredit:walletTransactionCredit,
    walletToken:walletToken
};

module.exports = airpay;