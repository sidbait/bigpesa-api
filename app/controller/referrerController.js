var dbConnection = require('../model/dbConnection');
var sendResp = require('../service/send');
var userModel = require('../model/UserModel');
var md5 = require('md5');
var sha512 = require('js-sha512');
var dateformat = require('dateformat');
var logger = require('tracer').colorConsole();
var btoa = require('btoa');
var atob = require('atob');
var config = require('config');
var uniqid = require('uniqid');
var scratchCardController = require('./scratchCardController'); 
module.exports = {

    playerEvents: function (req, res) {
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        userModel.getUserDetails(userToken, function (err, details) {
            let playerId = details.playerId;
            if (playerId == "") {
                sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
            } else {

                if (playerId != "") {
                    // let query = " select * from tbl_event_master " +
                    //     " where event_type = 'event' " +
                    //     " and is_repeat = false and event_id not in " +
                    //     " (select event_id from  tbl_referer_transaction where player_id = " + playerId + " ) " +
                    //     " union all " +
                    //     "  select * from tbl_event_master " +
                    //     " where event_type = 'referrer'  " +
                    //     " and is_repeat = true and event_id not in  " +
                    //     " ( select event_id from ( select tbl_referer_transaction.event_id,count(*) from  tbl_referer_transaction  " +
                    //     " inner join tbl_event_master on tbl_referer_transaction.event_id = tbl_event_master.event_id " +
                    //     " where from_player_id = " + playerId + "  " +
                    //     " group by tbl_referer_transaction.event_id ,tbl_event_master.repeat_count " +
                    //     " having count(*) >= tbl_event_master.repeat_count  )t )";

                    let query = " select * from ( select tbl_event_master.*,case when " +
                        " tbl_referer_transaction.referer_trans_id is null then false else true end " +
                        " isClaim from tbl_event_master " +
                        " left join  tbl_referer_transaction " +
                        " on tbl_referer_transaction.event_id = tbl_event_master.event_id  " +
                        " and player_id = " + playerId + " " +
                        " where event_type = 'event' " +
                        " union all " +
                        "  select *, false isClaim from tbl_event_master " +
                        " where event_type = 'referrer'  " +
                        " and is_repeat = true and event_id not in  " +
                        " ( select event_id from ( select tbl_referer_transaction.event_id,count(1) from  tbl_referer_transaction  " +
                        " inner join tbl_event_master on tbl_referer_transaction.event_id = tbl_event_master.event_id " +
                        " where from_player_id = " + playerId + "  " +
                        " group by tbl_referer_transaction.event_id ,tbl_event_master.repeat_count " +
                        " having count(1) >= tbl_event_master.repeat_count  )t ) )t order by isclaim asc";
                   // console.log(query)
                    dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                        //console.log(dbResult)
                        sendResp.sendCustomJSON(null, req, res, true, dbResult, "Event Pending List");
                    });
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Player Id Invalid");
                }
            }
        });
    },

    referId: function (req, res) {

        let eventId = req.body.eventId;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];

        userModel.getUserDetails(userToken, function (err, details) {
            if (err) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid");
            } else {
                let playerId = details.playerId;
                let referCode = btoa(playerId);
                let query = "insert into tbl_referrer(event_id,player_id,referer_code,expiry_date) " +
                    " values (" + eventId + "," + playerId + ",'" + referCode + "', " +
                    " ( now() + (50000::int * '1m'::interval)) ) returning referer_id";
                dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                    if (dbResult != null && dbResult != undefined) {
                        var refId = dbResult[0].referer_id;
                        var refCode = referCode;
                        var refUrl = config.web_url + "/refer/" + refId + "/" + refCode + "/" + eventId;
                        var output = { eventId: eventId, refCode: refCode, refId: refId, refUrl: refUrl };
                        sendResp.sendCustomJSON(null, req, res, true, output, "Your ReferrerId Generated Successfully");
                    } else {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
                    }
                });
            }
        });
    },

    claimEvent: function (req, res) {
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        let eventId = req.body.eventId;
        let refererId = req.body.refererId;
        let referCode = req.body.referCode;
        let fingerPrint = req.body.fingerPrint;
        let refererSource = req.body.refererSource;
        let channel = req.body.channel ? req.body.channel : '';

        let isvalidEvent = false;
        let eventDetails = {}
 
        gEventMaster.forEach(event => {
            if (event.event_id == eventId) {
                eventDetails = event;
                isvalidEvent = true;
            }
        });
        //console.log(isvalidEvent)
        if (isvalidEvent) {
            isvalidEvent = false;
            // let queryCheckRefererId = "select * from tbl_referrer where referer_id =" + refererId + "";

            // dbConnection.executeQuery(queryCheckRefererId, "rmg_db", function (err, refererDetails) {
            //     if (err) {
            //         sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
            //     } else {
            //         if (dbResult != undefined && dbResult != null && dbResult.length == 0) {
            //             sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
            //         } else {


                        
                        userModel.getUserDetails(userToken, function (err, details) {
                            if (err) {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid");
                            } else {
                                let playerId = details.playerId;
                                checkOneTimeEvent(playerId, eventId, function (isPass, msg, isOnetime) {
                                    if (!isPass) {
                                        sendResp.sendCustomJSON(null, req, res, false, [], msg);
                                    } else {
                                        if (isOnetime) {
                                            console.log('INSIDE ONE TIME')
                                            let checkOneTimeEventValidity = "select * from tbl_event_master " +
                                                " where event_type = 'event' " +
                                                " and event_id = " + eventId + " " +
                                                " and is_repeat = false and event_id not in " +
                                                " (select event_id from  tbl_referer_transaction where player_id = " + playerId + " )"
                                            console.log(checkOneTimeEventValidity)
                                            dbConnection.executeQuery(checkOneTimeEventValidity, "rmg_db", function (err, dbResult) {
                                                if (err) {
                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Reference Code Not Valid");
                                                } else {
                                                    console.log(dbResult)
                                                    if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                                                        let InsertEventTransactionQuery = " insert into tbl_referer_transaction (event_id,referer_id, " +
                                                            " from_player_id,player_id,referer_source,is_credited,created_at,channel) " +
                                                            " values (" + eventId + ",0,0," + playerId + ",'',false,now(),'"+ channel +"') ";
                                                        console.log(InsertEventTransactionQuery)
                                                        dbConnection.executeQuery(InsertEventTransactionQuery, "rmg_db", function (err, dbResult) {
                                                            if (err) {
                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Try After Some Time", true);
                                                            } else {
                                                                //userModel.creditDebitBonus(eventId,'REFERAL','Referar','CREDIT',10,'Redumption',playerId,appSecretKey,userToken)
                                                                sendResp.sendCustomJSON(null, req, res, true, eventDetails, "Redeemed Successfully", true);
                                                            }
                                                        });
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, false,eventDetails, "Already Redeemed", true);
                                                    }
                                                }
                                            });
                                        } else {
                                            let checkIsNewuser ="select now(),created_at  from tbl_player where player_id =" + playerId + "";
                                            let checkRepeatReferer = "select count(1) from tbl_event_master " +
                                                " inner join tbl_referer_transaction on tbl_event_master.event_id = tbl_referer_transaction.event_id " +
                                                " where event_type = 'referrer' " +
                                                " and tbl_referer_transaction.player_id = " + playerId + " and tbl_event_master.event_id = " + eventId;
                                            let fromPlayerId = atob(referCode);
                                            let chkEventValidityQuery = " select * from tbl_event_master " +
                                                " where event_type = 'event' " +
                                                " and is_repeat = false and event_id not in " +
                                                " (select event_id from  tbl_referer_transaction where player_id = " + fromPlayerId + " ) " +
                                                " union all " +
                                                "  select * from tbl_event_master " +
                                                " where event_type = 'referrer'  " +
                                                " and is_repeat = true and event_id not in  " +
                                                " ( select event_id from ( select tbl_referer_transaction.event_id,count(*) from  tbl_referer_transaction  " +
                                                " inner join tbl_event_master on tbl_referer_transaction.event_id = tbl_event_master.event_id " +
                                                " where from_player_id = " + fromPlayerId + "  " +
                                                " group by tbl_referer_transaction.event_id ,tbl_event_master.repeat_count " +
                                                " having count(*) >= tbl_event_master.repeat_count  )t )";
                                            let InsertEventTransactionQuery = " insert into tbl_referer_transaction (event_id,referer_id, " +
                                                " from_player_id,player_id,referer_source,is_credited,created_at,channel) " +
                                                " values (" + eventId + "," + refererId + "," + fromPlayerId 
                                                + "," + playerId + ",'',false,now(),'"+ channel +"') ";
                                            console.log(checkRepeatReferer);                                    
                                           // scratchCardController.contestReferEvent(fromPlayerId);
                                            dbConnection.executeQuery(checkIsNewuser, "rmg_db", function (err, checkIsNewuserResult) {
                                                if (err) {
                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Reference Code Not Valid");
                                                }else{
                                                    var today =new Date(checkIsNewuserResult[0].created_at);
                                                    var subDate =new Date(checkIsNewuserResult[0].now); 
                                                    var diffMs = (subDate - today); 
                                                    var diffDays = Math.floor(diffMs / 86400000); // days
                                                    var diffHrs = Math.floor((diffMs % 86400000) / 3600000); // hours
                                                    var diffMins = Math.round(((diffMs % 86400000) % 3600000) / 60000); // minutes
                                                    
                                                    if(diffDays == 0 && diffHrs ==0 && diffMins < 10 ){
                                                        console.log('VALID');
                                                        dbConnection.executeQuery(checkRepeatReferer, "rmg_db", function (err, dbResult) {
                                                            if (err) {
                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Reference Code Not Valid");
                                                            } else {
                                                                console.log(dbResult)
                                                                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                                                                    if (dbResult[0].count > 0) {
                                                                        sendResp.sendCustomJSON(null, req, res, false, eventDetails, "Already Redeemed", true);
                                                                    } else {
                                                                        dbConnection.executeQuery(chkEventValidityQuery, "rmg_db", function (err, dbResult) {
                                                                            if (err) {
                                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Reference Code Not Valid");
                                                                            } else {
                                                                                console.log(dbResult.length)
                                                                                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                                                                                    dbResult.forEach(events => {
                                                                                        if (events.event_id == eventId) {
                                                                                            isvalidEvent = true;
                                                                                        }
                                                                                    });
                                                                                    if (isvalidEvent) {
                                                                                        console.log(InsertEventTransactionQuery)
                                                                                        dbConnection.executeQuery(InsertEventTransactionQuery, "rmg_db", function (err, dbResult) {
                                                                                            sendResp.sendCustomJSON(null, req, res, true, eventDetails, "Redeemed Successfully", true);
                                                                                        });
                                                                                    } else {
                                                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Reference Is Not Valid");
                                                                                    }
            
                                                                                } else {
                                                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Reference Is Not Valid");
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                }
                                                            }
                                                        });
            
                                                    }else{
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Reference Code Not Valid");
                                                    }
                                                }           
                                            })
                                    
                                    
                                          
                                    
                                    
                                        }
                                    }
                                })
                            }
                        });


            //         }
            //     }
            // })
        } else {
            sendResp.sendCustomJSON(null, req, res, false, [], "Event Is Invalid");
        }
    },

    checkEvent: function (req, res) {
        var playerId = req.query.playerId;
        console.log(playerId)
        checkOneTimeEvent(playerId, 393916838132678657, function (response) {
            res.send(response)
        })
    },

    refererDetails: function (req, res) {

        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];

        let eventId = req.body.eventId;
        let refererId = req.body.refererId;
        let referCode = req.body.referCode;

        let referer_query = "select tbl_referrer.referer_id, tbl_referrer.event_id, tbl_referrer.referer_code, " +
            "bonus_amount, credit_type, tbl_player.player_id, " +
            "   tbl_event_master.bonus_toplayer,tbl_event_master.credit_type_toplayer, " +
            " first_name, last_name, " +
            "CASE WHEN (full_name IS NULL) OR (full_name = '') THEN replace(phone_number, substring(phone_number, 5, 6), 'XXXXXX') ELSE full_name END AS full_name " +
            "from tbl_referrer " +
            "inner join tbl_event_master on tbl_event_master.event_id = tbl_referrer.event_id " +
            "inner join tbl_player on tbl_player.player_id = tbl_referrer.player_id " +
            "where tbl_referrer.referer_id = " + refererId + " and tbl_referrer.event_id = " + eventId + " " +
            "and tbl_referrer.referer_code = '" + referCode + "'";

        logger.info("refererDetails referer_query - ", referer_query);

        dbConnection.executeQuery(referer_query, "rmg_db", function (err, dbResult) {
            logger.info("refererDetails dbResult - ", JSON.stringify(dbResult));
            sendResp.sendCustomJSON(null, req, res, true, dbResult, "Referer Details");
        });
    },

    claimRegisterEvent: function (req, res) {
        (async function (req, res) {
            var appSecretKey = req.headers["x-nazara-app-secret-key"];
            var userToken = req.headers["authorization"];
            try {
                var userDetails = await userModel.getUserDetailPromise(userToken);
                var playerId = userDetails.playerId;
                if (playerId == "") {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token");
                } else {
                    let checkOneTimeEventValidity = "select * from tbl_event_master " +
                        " where event_type = 'register'  " +
                        " and is_repeat = false " +
                        " and event_id::text not in " +
                        " (select event_id from  tbl_bonus_credit_que " +
                        " where player_id =  " + playerId + " )  ";
                    var eventDetails = await dbConnection.executeQueryAll(checkOneTimeEventValidity, 'rmg_db');
                    console.log(eventDetails.length)
                    if (eventDetails != undefined && eventDetails != null && eventDetails.length != 0) {
                        if (eventDetails[0].credit_type.toLowerCase() == 'coin') {
                            let query = "INSERT INTO public.tbl_bonus_credit_que " +
                                " ( event_id, event_type, event_name, amount, " +
                                " \"comment\", player_id, is_credit, status, add_date,is_claim,next_retry) " +
                                " VALUES( '" + eventDetails[0].event_id + "', '" + eventDetails[0].event_type
                                + "', '" + eventDetails[0].event_name + "'," + eventDetails[0].bonus_amount
                                + ", '" + eventDetails[0].event_desc
                                + "', " + playerId + ",'false', 'ACTIVE', now() ,true,now())RETURNING que_id,'coin' as credit_type,amount;";
                            console.log(query)
                            var insertResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                            if (insertResult != undefined && insertResult != null && insertResult.length != 0) {
                                sendResp.sendCustomJSON(null, req, res, true, insertResult, "Success");
                            } else {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong");
                            }
                        } else {
                            let query = "INSERT INTO public.tbl_wallet_credit_que " +
                                " ( event_id, event_type, event_name, amount, " +
                                " \"comment\", player_id, is_credit, status, add_date,is_claim,next_retry) " +
                                " VALUES( '" + eventDetails[0].event_id + "', '" + eventDetails[0].event_type
                                + "', '" + eventDetails[0].event_name + "'," + eventDetails[0].bonus_amount
                                + ", '" + eventDetails[0].event_desc
                                + "', " + playerId + ",'false', 'ACTIVE', now(),true,now())RETURNING que_id,'coin' as credit_type,amount;";
                            console.log(query)
                            var insertResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                            if (insertResult != undefined && insertResult != null && insertResult.length != 0) {
                                sendResp.sendCustomJSON(null, req, res, true, insertResult, "Success");
                            } else {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong");
                            }
                        }
                    } else {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Already Claimed");
                    }
                }
            }
            catch (error) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
            }
        })(req, res);
    },

    claimShareEvent:function(req,res){       
        (async function (req, res) {
            var appSecretKey = req.headers["x-nazara-app-secret-key"];
            var userToken = req.headers["authorization"];
            console.log('ININ')
            try {
                var userDetails = await userModel.getUserDetailPromise(userToken);
                
                var playerId = userDetails.playerId;
                if (playerId == "") {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token");
                } else {
                    var event_detail ={}
                    gEventMaster.forEach(event => {
                        if (event.event_type == 'share') {
                            event_detail = event;
                        }
                    });
                    
                    console.log(event_detail)
                    if(event_detail.event_type.toUpperCase() == "SHARE" && event_detail.status.toUpperCase() == "ACTIVE"){
                        let query ="";
                        if(event_detail.credit_type.toUpperCase() == "COIN"){
                            let traxid = uniqid()
                            let query = "INSERT INTO public.tbl_bonus_credit_que " +
                            " ( event_id, event_type, event_name, amount, " +
                            " \"comment\", player_id, is_credit, status, add_date,is_claim,next_retry) " +
                            " VALUES( '" + traxid + "', '" + event_detail.event_type
                            + "', '" + event_detail.event_name + "'," + event_detail.bonus_amount
                            + ", '" + event_detail.event_desc 
                            + "', " + playerId + ",'false', 'ACTIVE', now()" +
                            " ,true,now())RETURNING que_id,'coin' as credit_type,amount;";
                            var insertResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                            if (insertResult != undefined && insertResult != null && insertResult.length != 0) {
                                sendResp.sendCustomJSON(null, req, res, true, insertResult, "Success");
                            } else {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong");
                            }

                        }else if(event_detail.credit_type.toUpperCase() == "CASH"){
                            let traxid = uniqid()
                            let query = "INSERT INTO public.tbl_wallet_credit_que " +
                            " ( event_id, event_type, event_name, amount, " +
                            " \"comment\", player_id, is_credit, status, add_date,is_claim,next_retry) " +
                            " VALUES( '" + traxid + "', '" + eventDetails[0].event_type
                            + "', '" + eventDetails[0].event_name + "'," + eventDetails[0].bonus_amount
                            + ", '" + eventDetails[0].event_desc
                            + "', " + playerId + ",'false', 'ACTIVE', now(), " +
                            " true,now())RETURNING que_id,'coin' as credit_type,amount;";
                             var insertResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                             if (insertResult != undefined && insertResult != null && insertResult.length != 0) {
                                sendResp.sendCustomJSON(null, req, res, true, insertResult, "Success");
                            } else {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong");
                            }
                        }
                    }else{
                        sendResp.sendCustomJSON(null, req, res, false, [], "Event Invalid!");
                    }
                }

            }
            catch(err){
                sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong!");
            }
        })(req,res);
    },

    referEvent:function(req,res){
        if(gEventMaster != undefined && gEventMaster !=null){
            gEventMaster.forEach(event => {
                if (event.event_type == 'referrer') {
                    event_detail = event;
                }                
            });
            sendResp.sendCustomJSON(null, req, res, true, event_detail, "Event Details!");
        }else{
            sendResp.sendCustomJSON(null, req, res, false,[], "Event Not Found!");
        }
    },

    addReferrer: async function (req, res) {

        let referrer_player_id = req.body.referrer_player_id ? req.body.referrer_player_id : null;
        let player_id = req.body.player_id ? req.body.player_id : null;
        let action = req.body.action ? req.body.action : null;
        let reference_id = req.body.reference_id ? req.body.reference_id : null;
        let sub_action = req.body.sub_action ? req.body.sub_action : null;

        try {

            if (referrer_player_id && player_id && action && reference_id && sub_action) {
                let query = `select * from fn_insert_referral_transaction(${referrer_player_id},${player_id},'${action}','${sub_action}','${reference_id}')`;

                // console.log(query);
                
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');

                if (dbResult != undefined && dbResult != null) {

                    sendResp.sendCustomJSON(null, req, res, true, dbResult, "Success");

                } else {

                    sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong");

                }
            } else {
                sendResp.sendCustomJSON(null, req, res, false, [], "param missing");
            }

        } catch (error) {
            console.log(error);

            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong!");
        }

    },

    getReferrerDetails: async function (req, res) {

        let player_id = req.body.player_id ? req.body.player_id : null;

        try {

            if (player_id) {
                let query = `select * from fn_referrer_player_stat_details(${player_id})`;

                // console.log(query);
                
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');

                if (dbResult != undefined && dbResult != null) {

                    sendResp.sendCustomJSON(null, req, res, true, dbResult, "Success");

                } else {

                    sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong");

                }
            } else {
                sendResp.sendCustomJSON(null, req, res, false, [], "param missing");
            }

        } catch (error) {
            console.log(error);

            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong!");
        }

    },
    getReferUrl : async function(channel,playerId,callback){ 
        let referCode = btoa(playerId);
        let eventId = "";
        gEventMaster.forEach(event => {
            if (event.event_type == 'referrer') {
                eventId = event.event_id;
            }                
        });
        let query = "insert into tbl_referrer(event_id,player_id,referer_code,expiry_date) " +
            " values (" + eventId + "," + playerId + ",'" + referCode + "', " +
            " ( now() + (50000::int * '1m'::interval)) ) returning referer_id";
        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            if (dbResult != null && dbResult != undefined) {
                var refId = dbResult[0].referer_id;
                var refCode = referCode;
                var refUrl ="";
                if(channel.toLowerCase() =="playstore"){
                    refUrl = `https://bigpesangs.app.link?referrerId=${refId}&code=${refCode}&eventId=${eventId}`;
                }else{
                    refUrl = `https://bigpesa.in/download?referrerId=${refId}&code=${refCode}&eventId=${eventId}`;
                }
               
                callback(null,refUrl);
                
            } else {
                callback('error');
            }
        });
    }
}

function checkOneTimeEvent(playerId, eventId, callback) {
    if (playerId != null && playerId != undefined && playerId != "") {
        var query = " select * from tbl_player where player_id = " + playerId;
        console.log(query)
        if (eventId == 393916838132678657) {//name
            dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                if (err) {
                    console.log(err)
                    callback(false, 'Invalid Token')
                } else {
                    if (dbResult == null || dbResult == undefined || dbResult.length == 0) {
                        callback(false, 'Invalid Token')
                    } else {
                        if (dbResult[0].first_name != "" && dbResult[0].first_name != undefined && dbResult[0].first_name != null) {
                            callback(true, '', true)
                        } else {
                            callback(false, 'Event Not Completed')
                        }

                    }
                }
            });
        } else if (eventId == 393916904482406401) {//email_id
            dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                if (err) {
                    callback(false, 'Invalid Token')
                } else {
                    if (dbResult == null || dbResult == undefined || dbResult.length == 0) {
                        callback(false, 'Invalid Token')
                    } else {
                        if (dbResult[0].email_id != "" && dbResult[0].email_id != undefined && dbResult[0].email_id != null) {
                            callback(true, '', true)
                        } else {
                            callback(false, 'Event Not Completed')
                        }

                    }
                }
            });
        } else {
            callback(true)
        }
    } else {
        callback(false, 'Invalid Token')
    }
}