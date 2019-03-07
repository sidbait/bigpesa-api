var request = require('request-promise');
var config = require('config');
var logger = require('tracer').colorConsole();
var dbConnection = require('./dbConnection');
var airpay = require('../client/AirpayClient');

var md5 = require('md5');
var sha512 = require('js-sha512');
var dateformat = require('dateformat');
var JSONbig = require('json-bigint');


var playerWalletTokenUpdate = function (token, consumerId, authToken, secretKey) {
    var options = {
        method: 'POST',
        uri: config.uri_server + 'user/airpay',
        headers: {
            'x-nazara-app-secret-key': secretKey,
            'Authorization': authToken
        },
        qs: {
            airpay_token: token,
            airpay_consumerId: consumerId
        }
    };
    logger.info(options)
    return request(options)
}

var playerWalletBalance_airpay = function (mobileNumber, airpayToken, callback) {

    if (!mobileNumber) {
        callback(0);
    }
    else {

        airpay.walletBalance(mobileNumber, airpayToken, function (err, balanceInfo) {

            logger.info(JSON.stringify(balanceInfo));

            if (err)
                callback(0);
            else {

                // var response = {
                //     "TRANSACTION":
                //     {
                //         "TRANSACTIONSTATUS": "200",
                //         "MESSAGE": "Successful",
                //         "CHMOD": "wallet",
                //         "MERCHANTID": "25427",
                //         "USERNAME": "919711224321",
                //         "WALLETBALANCE": "99300.00"
                //     }
                // }

                if (!balanceInfo) {
                    callback(0);
                } else {
                    if (balanceInfo.TRANSACTION.TRANSACTIONSTATUS &&
                        balanceInfo.TRANSACTION.TRANSACTIONSTATUS == "200")
                        callback(Math.floor(balanceInfo.TRANSACTION.WALLETBALANCE));
                    else
                        callback(0);
                }
            }
        })
    }
}

var playerWalletBalance = function (appId, appSecretKey, userToken, airpayToken, callback) {

    ///console.log('userToken', userToken)
    //console.log('airpayToken', airpayToken);

    if (userToken == null || airpayToken == null) {
        callback(100, 100);
    } else {
        var now = new Date();
        var md5checksum = md5(airpayToken) + '|' +
            md5(config.app.client_key + "$" + config.app.app_id) + '|' +
            md5(dateformat(now, 'yyyy-mm-dd'));
        var sha512Checksum = sha512(md5checksum);

        var options = {
            method: 'POST',
            uri: config.uri_server + 'wallet/balance',
            //"http://stg-api.bigpesa.in/v1/wallet/balance"
            headers: {
                'x-nazara-app-secret-key': config.app.client_key,
                'checksum': sha512Checksum,
                'Authorization': userToken
            },
            qs: {
                airpay_token: airpayToken,
            },
            json: false
        };

        logger.info(options)


        request(options)
            .then(function (data) {

                logger.info('playerWalletBalance response - ' + JSON.stringify(data));

                let _data = JSONbig.parse(data);

                if (_data.statusCode === 200) {
                    logger.info("Inside success getPlayerInfo", _data);
                    callback(Math.floor(_data.data.TRANSACTION.WALLETBALANCE), Math.floor(_data.data.TRANSACTION.NZBonus))
                } else {
                    logger.info("Inside error getPlayerInfo", _data.message, _data);
                    callback(0, 0);
                }
            })
            .catch(function (err) {
                //res.json('SignIn Catch Error!!!!!', err);
                callback(0, 0);
            });
    }
}

var creditDebitBonus = function (eventId, eventType, eventName, bonusType, bonusAmount, comment, fromPlayerId,
    appSecretKey, userToken, callback) {

    if (userToken == null || userToken == '') {
        callback(false, "Please provide userToken");
    } else if (appSecretKey == null || appSecretKey == '') {
        callback(false, "Please provide appSecretKey");
    } else {
        var now = new Date();
        var md5checksum = md5(eventType.toUpperCase() + "$" + eventName + "$" +
            eventId + "$" + bonusType.toUpperCase() + "$" + bonusAmount) + '|' +
            md5(config.app.client_key + "$" + config.app.app_id) + '|' +
            md5(dateformat(now, 'yyyy-mm-dd'));
        var sha512Checksum = sha512(md5checksum);

        var options = {
            method: 'POST',
            uri: config.uri_server + 'bonus/transaction',
            //"http://stg-api.bigpesa.in/v1/wallet/balance"
            headers: {
                'x-nazara-app-secret-key': config.app.client_key,
                'checksum': sha512Checksum,
                'Authorization': userToken
            },
            qs: {
                event_type: eventType.toUpperCase(),
                event_name: eventName,
                event_id: eventId,
                bonus_type: bonusType.toUpperCase(),
                bonus_value: bonusAmount,
                comment: comment ? comment : "",
                from_player_id: fromPlayerId,
            },
            json: false
        };

        logger.info(options)

        request(options)
            .then(function (data) {

                logger.info('ceditDebitBonus response - ' + JSON.stringify(data));

                let _data = JSONbig.parse(data);

                if (_data.statusCode === 200) {
                    callback(true, "Success")
                } else {
                    callback(false, _data.message);
                }
            })
            .catch(function (err) {
                callback(false, err.toString());
            });
    }
}

var getUserDetails = function (token, callback) {
    //console.log('Token Check' + token)
    if (token == "" || token == undefined || token == null || token == 'null') {
        var userdetails = {}
        userdetails.playerId = "";
        userdetails.phone_number = "";
        userdetails.airpay_token = "";
        userdetails.player_name ="";
        userdetails.imgurl = ""; 
        callback(true, userdetails);
    } else {
        let getUserDetails = " SELECT tbl_player.player_id,tbl_player.phone_number, " +
        " tbl_player.airpay_token ,case " +
        " when (full_name is null) or (full_name = '') then replace(phone_number, " +
        " substring(phone_number, 5, 6), 'XXXXXX') else full_name end as player_name, " +
        " tbl_player.photo FROM public.tbl_token inner join  tbl_player on " +
        " tbl_token.player_id = tbl_player.player_id where token = '" + token + "'";
        //console.log(getUserDetails)
        dbConnection.executeQuery(getUserDetails, "rmg_db", function (err, dbResult) {
            if (err) {
                callback(true);
            } else {
                if (dbResult != null && dbResult.length != 0) {
                    var userdetails = {}
                    userdetails.playerId = dbResult[0].player_id;
                    userdetails.phone_number = dbResult[0].phone_number;
                    userdetails.airpay_token = dbResult[0].airpay_token;
                    userdetails.player_name = dbResult[0].player_name;
                    userdetails.imgurl = dbResult[0].photo; 
                    callback(false, userdetails);
                } else {
                    var userdetails = {}
                    userdetails.playerId = "";
                    userdetails.phone_number = "";
                    userdetails.airpay_token = "";
                    userdetails.player_name ="";
                    userdetails.imgurl = ""; 
                    callback(false, userdetails);
                }
            }
        },true,600);
    }

}

let getUserDetailPromise = function(token){
    return new Promise(function(resolve,reject){
        if (token == "" || token == undefined || token == null || token == 'null') {
            var userdetails = {}
            userdetails.playerId = "";
            userdetails.phone_number = "";
            userdetails.airpay_token = "";
            resolve(userdetails);
        } else {
            let getUserDetails = " SELECT tbl_player.player_id,tbl_player.phone_number, " +
            " tbl_player.airpay_token ,case " +
            " when (full_name is null) or (full_name = '') then replace(phone_number, " +
            " substring(phone_number, 5, 6), 'XXXXXX') else full_name end as player_name, " +
            " tbl_player.photo FROM public.tbl_token inner join " +
            " tbl_player on tbl_token.player_id = tbl_player.player_id " +
            " where token = '" + token + "'";
            //console.log('getUserDetailPromise - ',getUserDetails)
            dbConnection.executeQuery(getUserDetails, "rmg_db", function (err, dbResult) {
                if (err) {
                    var userdetails = {}
                    userdetails.playerId = "";
                    userdetails.phone_number = "";
                    userdetails.airpay_token = "";
                    resolve(userdetails);
                } else {
                    if (dbResult != null && dbResult.length != 0) {
                        var userdetails = {}
                        userdetails.playerId = dbResult[0].player_id;
                        userdetails.phone_number = dbResult[0].phone_number;
                        userdetails.airpay_token = dbResult[0].airpay_token;
                        resolve(userdetails);
                    } else {
                        var userdetails = {}
                        userdetails.playerId = "";
                        userdetails.phone_number = "";
                        userdetails.airpay_token = "";
                        resolve(userdetails);
                    }
                }
            },true,600);
        }
    })
}

var player = {
    playerWalletTokenUpdate: playerWalletTokenUpdate,
    playerWalletBalance: playerWalletBalance,
    getUserDetails: getUserDetails,
    creditDebitBonus: creditDebitBonus,
    getUserDetailPromise :getUserDetailPromise
}

module.exports = player;