var request = require('request-promise');
var config = require('config');
var logger = require('tracer').colorConsole();
var md5 = require('md5');
var sha512 = require('js-sha512');
var dateformat = require('dateformat');
var JSONbig = require('json-bigint');
var checksum = require('./checksum');
var uniqid = require('uniqid');
var requestIp = require('request-ip');
var rp = require('request-promise');
var dbConnection = require('./dbConnection');
module.exports = {

    playerWalletTokenUpdate: function (token, consumerId, authToken, secretKey) {
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
    },

    playerWalletBalance: function (appId, appSecretKey, userToken, airpayToken, callback) {

        console.log('userToken', userToken)
        console.log('airpayToken', airpayToken);

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
    },

    creditDebitBonus: function (eventId, eventType, eventName, bonusType, bonusAmount, comment, fromPlayerId,
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

            logger.info('creditDebitBonus options - ', options)

            request(options)
                .then(function (data) {

                    //logger.info('ceditDebitBonus response - ' + JSON.stringify(data));

                    logger.info('ceditDebitBonus response\n' +
                        'options - ' + JSON.stringify(options) + '\n' +
                        'response - ' + JSON.stringify(data) + '\n' +
                        'err - null');

                    let _data = JSONbig.parse(data);

                    if (_data.statusCode === 200) {
                        callback(true, _data)
                    } else {
                        callback(false, _data.message);
                    }
                })
                .catch(function (err) {
                    //logger.info('ceditDebitBonus err - ' + JSON.stringify(err));

                    logger.info('ceditDebitBonus err\n' +
                        'options - ' + JSON.stringify(options) + '\n' +
                        'response - null \n' +
                        'err - ' + JSON.stringify(err));

                    callback(false, err.toString());
                });
        }
    },

    debitCreditAmountAirpay: function (token, airpayToken, order_id, type, amount,event,event_id,event_name, callback) {
        var appSecret = config.app.client_key;
        var app_id = config.app.app_id;
        if(type.toUpperCase() == "CREDIT"){
            order_id = "BP-Cr-"+order_id
        }else if (type.toUpperCase() == "DEBIT"){
            order_id = "BP-Dr-"+order_id
        }
        var param1 = airpayToken + "$" + order_id + "$" + amount.toString() + "$" + type;
        var param2 = appSecret + "$" + app_id;
        var now = new Date();
        var param3 = dateformat(now, "yyyy-mm-dd");
        
        var md5checksum = md5(param1) + "|" +
            md5(param2) + "|" +
            md5(param3);

        var sha512Checksum = sha512(md5checksum);
        var options = {
            method: 'POST',
            uri: config.webapp_api_server + 'v1/wallet/' + type.toLowerCase(),
            qs: {
                airpay_token: airpayToken,
                order_id: order_id,
                nz_txn_event:event,
                nz_txn_event_id:event_id,
                nz_txn_event_name:event_name,
                amount: amount 
            },
            headers: {
                'x-nazara-app-secret-key': appSecret,
                'checksum': sha512Checksum,
                'authorization': token,
            },
            json: false,
        };
        if(type.toUpperCase() == "DEBIT"){
            options.qs.balance_type ="DEBIT"
        }

        logger.info('debitCreditAmountAirpay options - ', options)

        rp(options)
            .then(function (data) {

                logger.info('debitCreditAmountAirpay response\n' +
                    'options - ' + JSON.stringify(options) + '\n' +
                    'response - ' + JSON.stringify(data) + '\n' +
                    'err - null');

                let _data = JSONbig.parse(data);

                if (_data.statusCode === 200) {
                    callback(null, _data, _data.message)
                } else {
                    callback(true, null, _data.message);
                }
            })
            .catch(function (err) {

                logger.info('debitCreditAmountAirpay err\n' +
                    'options - ' + JSON.stringify(options) + '\n' +
                    'response - null \n' +
                    'err - ' + JSON.stringify(err));

                callback(true, null, err.toString());
            });
    },
    debitAmountAirpayContestJoin: function (token, airpayToken, order_id, type, amount,event,event_id,event_name, matrix_code,callback) {
        var appSecret = config.app.client_key;
        var app_id = config.app.app_id;
        if(type.toUpperCase() == "CREDIT"){
            order_id = "BP-Cr-"+order_id
        }else if (type.toUpperCase() == "DEBIT"){
            order_id = "BP-Dr-"+order_id
        }
        var param1 = airpayToken + "$" + order_id + "$" + amount.toString() + "$" + type;
        var param2 = appSecret + "$" + app_id;
        var now = new Date();
        var param3 = dateformat(now, "yyyy-mm-dd");
        
        var md5checksum = md5(param1) + "|" +
            md5(param2) + "|" +
            md5(param3);

        var sha512Checksum = sha512(md5checksum);
        var options = {
            method: 'POST',
            uri: config.webapp_api_server + 'v1/wallet/debit-contest',
            qs: {
                airpay_token: airpayToken,
                order_id: order_id,
                nz_txn_event:event,
                nz_txn_event_id:event_id,
                nz_txn_event_name:event_name,
                amount: amount,
                matrix_code : matrix_code
            },
            headers: {
                'x-nazara-app-secret-key': appSecret,
                'checksum': sha512Checksum,
                'authorization': token,
            },
            json: false,
        };
        if(type.toUpperCase() == "DEBIT"){
            options.qs.balance_type ="DEBIT"
        }

        logger.info('debitCreditAmountAirpay options - ', options)

        rp(options)
            .then(function (data) {

                logger.info('debitCreditAmountAirpay response\n' +
                    'options - ' + JSON.stringify(options) + '\n' +
                    'response - ' + JSON.stringify(data) + '\n' +
                    'err - null');

                let _data = JSONbig.parse(data);

                if (_data.statusCode === 200) {
                    callback(null, _data, _data.message)
                } else {
                    callback(true, null, _data.message);
                }
            })
            .catch(function (err) {

                logger.info('debitCreditAmountAirpay err\n' +
                    'options - ' + JSON.stringify(options) + '\n' +
                    'response - null \n' +
                    'err - ' + JSON.stringify(err));

                callback(true, null, err.toString());
            });
    },
    paytmDebit: function (req, mobNumberPayee, amount, metadata, callback) {
        let orderId = uniqid();
        let ipAddress = requestIp.getClientIp(req);
        var merchantGuid = config.paytm.merchantGuid;
        var merchantkey = config.paytm.merchantkey;
        var salesWalletGuid = config.paytm.salesWalletGuid;
        var url = "https://trust-uat.paytm.in/wallet-web/salesToUserCredit";
        // let metadata = "Testing Data"        
        var samarray = new Array();
        samarray =
            {
                "request":
                {
                    "requestType": "VERIFY",
                    "merchantGuid": merchantGuid,
                    "merchantOrderId": orderId,
                    "salesWalletName": null,
                    "salesWalletGuid": salesWalletGuid,
                    "payeeEmailId": null,
                    "payeePhoneNumber": mobNumberPayee,
                    "payeeSsoId": "",
                    "appliedToNewUsers": "Y",
                    "amount": amount,
                    "currencyCode": "INR"
                },
                "metadata": metadata,
                "ipAddress": ipAddress,
                "platformName": "PayTM",
                "operationType": "SALES_TO_USER_CREDIT"
            };
        console.log(samarray)
        var finalstring = JSON.stringify(samarray);
        checksum.genchecksumbystring(finalstring, merchantkey, function (err, result) {
            request({
                url: url, //URL to hit
                //  qs: finalstring, //Query string data
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'mid': merchantGuid,
                    'checksumhash': result
                },
                body: finalstring//Set the body as a string
            }, function (error, response, body) {
                if (error) {
                    console.log(true);
                } else {
                    console.log('----------FIRST HIT RAJ-----')
                    // console.log(body);
                    var body = JSON.parse(body);
                    console.log(body.statusCode + "|" + "SUCCESS")
                    if (body.statusCode == "SUCCESS") {
                        samarray.request.requestType = null;
                        var finalstring = JSON.stringify(samarray);
                        checksum.genchecksumbystring(finalstring, merchantkey, function (err, result) {
                            request({
                                url: url, //URL to hit
                                //  qs: finalstring, //Query string data
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'mid': merchantGuid,
                                    'checksumhash': result
                                },
                                body: finalstring//Set the body as a string
                            }, function (error, response, body) {
                                if (error) {
                                    callback(true);
                                } else {
                                    var body = JSON.parse(body);
                                    console.log('----------Second HIT-----')
                                    console.log(body);
                                    callback(false, body);
                                }
                            });
                        });
                    } else {
                        callback(false, body);
                    }
                }
            });
        });
    },
    insertIntoBonusQue(event_id, event_type, event_name, amount, comment, player_id, is_claim, callback) {
        let query = "INSERT INTO public.tbl_bonus_credit_que " +
            " ( event_id, event_type, event_name, amount, " +
            " \"comment\", player_id, is_credit, status,is_claim, add_date,next_retry) " +
            " VALUES( '" + event_id + "', '" + event_type + "', '" + event_name + "'," + amount
            + ", '" + comment + "', " + player_id + ",false, 'ACTIVE',true, now(),now() )";
        console.log(query)
        dbConnection.executeQuery(query, 'rmg_db', function (err, dbResult) {
            if (err) {
                callback(false, null);
            } else {
                request('http://localhost:3001/notification?playerid=' + player_id, function (err, result, body) { });
                callback(true, dbResult);
            }
        })
    },
    insertIntoWalletQue(event_id, event_type, event_name, amount, comment, player_id, is_claim, callback) {
        let query = "INSERT INTO public.tbl_wallet_credit_que " +
            " (event_id, event_type, event_name, amount, \"comment\", " +
            " player_id, is_credit, status,is_claim, add_date,next_retry) " +
            " VALUES('" + event_id + "', '" + event_type + "', '" + event_name + "'," + amount
            + ", '" + comment + "', " + player_id + ", false, 'ACTIVE'," + is_claim + ", now(),now()); ";
            console.log(query)
        dbConnection.executeQuery(query, 'rmg_db', function (err, dbResult) {
            if (err) {
                callback(false, null);
            } else {
                request('http://localhost:3001/notification?playerid=' + player_id, function (err, result, body) { });
                callback(true, dbResult);
            }
        })
    }
}