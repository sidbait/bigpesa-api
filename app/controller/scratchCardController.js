var dbConnection = require('../model/dbConnection');
var sendResp = require('../service/send');
var userModel = require('../model/UserModel');
var config = require('config');
var refer_module = require('./referrerController');
var push = require('../model/push');
let msg = "Congratulations! You've earned a scratch card, Big Prizes waiting for you!";
module.exports = {
    scratchCardContests: async function (req, res) {
        try {
            var userToken = req.headers["authorization"];
            userModel.getUserDetails(userToken, async function (err, userDetails) {
                if (err) {
                    playerId = "";
                } else {
                    playerId = userDetails.playerId;
                }
                if (playerId != "") {

                    let query = `  select * from fn_scratch_contest_details(${playerId}) `;
                    let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                    if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                        let campaigns = dbResult[0].data;
                        let prizes = dbResult[1].data;
                        let events = dbResult[2].data;
                        let banners = dbResult[3].data;
                        if (campaigns != null && campaigns != undefined && campaigns.length > 0) {
                            campaigns.forEach(campaign => {
                                campaign.banners = [];
                                campaign.prizes = [];
                                campaign.events = [];
                                prizes.forEach(prize => {
                                    if (campaign.camp_id == prize.camp_id) {
                                        campaign.prizes.push(prize);
                                    }
                                });
                                events.forEach(event => {
                                    if (campaign.camp_id == event.camp_id) {
                                        if (event.event_code == 'CONTEST_JOIN') {
                                            campaign.msg = 'Play for ' + event.remaining_amount + 'Rs. more to get next scratch card.'
                                        } else if (event.event_code == 'REFERRER') {
                                            campaign.msg = 'Refer '+ event.remaining_amount + ' more friend to get next scratch card.'
                                        }

                                        campaign.events.push(event);
                                    }
                                });
                                banners.forEach(event => {
                                    if (campaign.camp_id == event.camp_id) {
                                        campaign.banners.push(event);
                                    }
                                });
                            });


                            sendResp.sendCustomJSON(null, req, res, true, campaigns, "Scratch Campaign Details");
                        } else {
                            sendResp.sendCustomJSON(null, req, res, false, [], "No Data Found");
                        }

                    } else {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
                    }

                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token");

                }
            });

        } catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
        }
    },

    getScratchCards: function (req, res) {
        var userToken = req.headers["authorization"];
        var channel = req.body.channel;
        userModel.getUserDetails(userToken, async function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            if (playerId != "") {
                let bonusCash = 0;
                let paytmCash = 0;
                // let query = ` select  trans.id,prize_master.prize_title, prize_master.prize_code,
                //             prize_master.prize_description,
                //             event_master.event_code,
                //             event_master.name as event_name,event_master.image,
                //             event_master.description,event_master.win_description,
                //             prize_master.prize_image,prize_master.gratification_type, 
                //             trans.is_claim, trans.winner_date ,trans.credit_date,
                //             trans.add_date,prize_master.prize_amount
                //             from tbl_scratch_transaction trans
                //             inner join tbl_scratch_prize_master prize_master 
                //             on prize_master.prize_id = trans.prize_id
                //             inner join tbl_scratch_event_master event_master
                //             on trans.scratch_event_id = event_master.scratch_event_id  
                //             where player_id = ${playerId} and 
                //             trans.status in('ACTIVE','SUCCESS') order by is_claim,add_date desc `;
                let query = `select id,prizemaster.prize_title,prizemaster.prize_code,
                                prizemaster.prize_description,event_master.event_code,
                                event_master.name as event_name,event_master.image ,event_master.description,event_master.win_description,
                                prizemaster.prize_image,prizemaster.gratification_type ,prize_details.is_claim,prize_details.winner_date, 
                                prize_details.credit_date,prize_details.add_date,prizemaster.prize_amount
                                from tbl_scratch_campaign_prizes_details  prize_details
                                inner join tbl_scratch_prize_master  prizemaster on  
                                prize_details.prize_id = prizemaster.prize_id
                                inner join tbl_scratch_event_master event_master on event_master.scratch_event_id =  prize_details.scratch_event_id
                                where is_win = true 
                                and  player_id =  ${playerId}
                                order by is_claim,winner_date desc `
                console.log(query)
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                    let outJson = {};
                    refer_module.getReferUrl(channel, playerId, function (err, ref_url) {
                        if (err) {
                            sendResp.sendCustomJSON(null, req, res, true, [], "Something got wrong");
                        } else {
                            dbResult.forEach(scratchCard => {
                                if (scratchCard.is_claim) {
                                    if (scratchCard.gratification_type.toLowerCase() == "bonus_cash") {
                                        bonusCash = parseInt(bonusCash) + parseInt(scratchCard.prize_amount);
                                    }
                                    else if (scratchCard.gratification_type.toLowerCase() == "paytm_cash") {
                                        paytmCash = parseInt(paytmCash) + parseInt(scratchCard.prize_amount);
                                    }
                                }
                                if (scratchCard.gratification_type.toLowerCase() == "bonus_cash") {
                                    scratchCard.refer_text = "I have won Bonus Cash of " + scratchCard.prize_amount + " Rs. through BigPesa. Hurry up and join using below url " + ref_url;
                                }
                                else if (scratchCard.gratification_type.toLowerCase() == "paytm_cash") {
                                    scratchCard.refer_text = "I have won Bonus Cash of " + scratchCard.prize_amount + " Rs. through BigPesa. Hurry up and join using below url " + ref_url;
                                } else if (scratchCard.gratification_type.toLowerCase() == "gift") {
                                    scratchCard.refer_text = "I have won " + scratchCard.prize_title + " through BigPesa. Hurry up and join using below url " + ref_url;
                                }
                            });
                            outJson.bonusCash = bonusCash;
                            outJson.paytmCash = paytmCash;
                            outJson.scratchCards = dbResult;
                            //console.log(JSON.stringify(outJson))
                            sendResp.sendCustomJSON(null, req, res, true, outJson, "Success");
                        }
                    });

                } else {
                    sendResp.sendCustomJSON(null, req, res, true, [], "No Data Found");
                }
            } else {
                sendResp.sendCustomJSON(null, req, res, true, campaigns, "Token Invalid");
            }
        });
    },

    claimScratchCard: async function (req, res) {
        var userToken = req.headers["authorization"];
        let scratchCardId = req.body.scratch_card_id;
        userModel.getUserDetails(userToken, async function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            if (playerId != "") {

                let msgTemplate = [
                    //"{player_name}, jeete hai Rs. ({amount}) {type}, Aap bhi jeet sakte hai. Participate kijiye.",
                    "{player_name}, has won Rs {amount} {type}, play cash contest to win grand prizes!"
                ];
                let randomNumber = Math.round(Math.random() * (msgTemplate.length - 1 - 0) + 0);
                let player_name = userDetails.player_name;
                let query = ` select * from fn_scratch_claim_new(${scratchCardId})`;
                let queryGetFollowers = ` select * from tbl_follow  where player_id = ${playerId} and status = 'ACTIVE' `;
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                    let msg = msgTemplate[randomNumber];
                    console.log(dbResult[0].data[0].prize_type)
                    msg = msg.replace('{player_name}', player_name);
                    let prize_type = dbResult[0].data[0].prize_type;
                    let amount = dbResult[0].data[0].amount;
                    msg = msg.replace('{amount}', amount);
                    let sendPush = false;
                    if (prize_type.toLowerCase() == "bonus_cash") {
                        sendPush = true;
                        msg = msg.replace('{type}', 'Bonus Cash');
                    } else if (prize_type.toLowerCase() == "paytm_cash") {
                        sendPush = true;
                        msg = msg.replace('{type}', 'Paytm Cash');
                    }
                    //console.log(msg)
                    if (sendPush) {
                        // console.log(queryGetFollowers)
                        var dbFollower = await dbConnection.executeQueryAll(queryGetFollowers, 'rmg_db');
                        //  console.log(dbFollower)
                        if (dbFollower != null && dbFollower != undefined && dbFollower.length > 0) {
                            dbFollower.forEach(player => {
                                let player_id = player.from_player_id;
                                push.sendPushPlayerId(player_id, 'Scratch Card', msg);
                            });
                        }
                    }
                    sendResp.sendCustomJSON(null, req, res, true, dbResult, "Successfully Claimed.");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "No Data Found");
                }
            } else {
                sendResp.sendCustomJSON(null, req, res, true, campaigns, "Token Invalid");
            }
        });
    },

    contestJoinEvent: function (player_id, join_amount, matrix_code, channel) {
        try {
            (async function () {

                let isMatrix_Code_Valid = false;
                let query_matrix = ` select  matrix_code from tbl_wallet_debit_matrix where 
                                     reward_balance = -1 `;
                console.log('contestJoinEvent :-player_id-' + player_id + 'join_amount' + join_amount + 'matrix_code' + matrix_code);
                let query = ` select campaign.camp_id,events.scratch_event_id,events.amount from 
                            tbl_scratch_campaign_master campaign
                            inner join tbl_scratch_campaign_details details on 
                            details.camp_id = campaign.camp_id
                            inner join tbl_scratch_event_master events on 
                            events.scratch_event_id = details.scratch_event_id
                            where campaign.valid_from <= nowInd() and 
                            campaign.valid_to >= nowInd() and
                            campaign.status = 'ACTIVE' and 
                            details.status = 'ACTIVE' and
                            events.event_code = 'CONTEST_JOIN' `;
                let dbquery_matrix = await dbConnection.executeQueryAll(query_matrix, 'rmg_db', true, 300);
                dbquery_matrix.forEach(element => {
                    if (element.matrix_code == matrix_code) {
                        isMatrix_Code_Valid = true;
                    }
                });
                if (isMatrix_Code_Valid) {
                    let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                    if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                        let camp_id = dbResult[0].camp_id;
                        let scratch_event_id = dbResult[0].scratch_event_id;
                        let amount = dbResult[0].amount;
                        let queryScratchCheck = ` select * from fn_scratch_contest_join(${camp_id}, 
                     ${scratch_event_id},${player_id},${amount},${join_amount})`;
                        console.log(queryScratchCheck);
                        let dbScratchCheck = await dbConnection.executeQueryAll(queryScratchCheck, 'rmg_db');
                        if (dbScratchCheck != null && dbScratchCheck != undefined &&
                            dbScratchCheck.length > 0) {
                            if (dbScratchCheck[0].data[0].is_claim) {
                                let queryGetScratchCard = ` select * from fn_get_prize_new(${player_id},${camp_id},${scratch_event_id},'${channel}') `;
                                console.log(queryGetScratchCard)
                                let dbGetScratchCard = await dbConnection.executeQueryAll(queryGetScratchCard, 'rmg_db');
                                console.log(dbGetScratchCard);
                                if (dbGetScratchCard[0].data[0].isscratch) {
                                    push.sendPushPlayerId(player_id, 'Scratch Card', msg);
                                }
                            }
                        }
                    }
                }
            })();;
        } catch (error) {
            console.log(error);
        }
        this.contestReferEvent(player_id, channel);
    },

    contestReferEvent: function (player_id, channel) {
        try {
            (async function () {
                let query = ` select campaign.camp_id,events.scratch_event_id,events.amount from 
                            tbl_scratch_campaign_master campaign
                            inner join tbl_scratch_campaign_details details on 
                            details.camp_id = campaign.camp_id
                            inner join tbl_scratch_event_master events on 
                            events.scratch_event_id = details.scratch_event_id
                            where campaign.valid_from <= nowInd() and 
                            campaign.valid_to >= nowInd()
                            and campaign.status = 'ACTIVE' 
                            and details.status = 'ACTIVE' and
                            events.event_code = 'REFERRER' `;
                let checkisNewReferrer = ` select * from fn_isPlayReferrer(${player_id}) `;
                let dbisNewReferrer = await dbConnection.executeQueryAll(checkisNewReferrer, 'rmg_db');
                if (dbisNewReferrer != null && dbisNewReferrer != undefined && dbisNewReferrer.length > 0) {
                    let results = dbisNewReferrer[0].data;
                    if (results[0].isnewrefer) {
                        let fromPlayer_id = results[0].from_player_id;
                        let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                        if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                            let camp_id = dbResult[0].camp_id;
                            let scratch_event_id = dbResult[0].scratch_event_id;
                            let amount = dbResult[0].amount;
                            let queryScratchCheck = ` select * from fn_referer_join(${camp_id}, 
                             ${scratch_event_id},${fromPlayer_id},${amount} )`;

                            let dbScratchCheck = await dbConnection.executeQueryAll(queryScratchCheck, 'rmg_db');
                            if (dbScratchCheck != null && dbScratchCheck != undefined && dbScratchCheck.length > 0) {
                                if (dbScratchCheck[0].data[0].is_claim) {
                                    let queryGetScratchCard = ` select * from fn_get_prize_new(${fromPlayer_id},${camp_id},${scratch_event_id},'${channel}') `;
                                    let dbGetScratchCard = await dbConnection.executeQueryAll(queryGetScratchCard, 'rmg_db');
                                    console.log(dbGetScratchCard);
                                    if (dbGetScratchCard[0].data[0].isscratch) {
                                        push.sendPushPlayerId(player_id, 'Scratch Card', msg);
                                    }
                                }
                            }
                        }
                    }
                }
            })();;
        } catch (error) {
            console.log(error);
        }
    },

    checkscratchcard: function (req, res) {
        var userToken = req.headers["authorization"];
        userModel.getUserDetails(userToken, async function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            if (playerId != "") {
                let query = ` select * from fn_checknewscratch(${playerId}); `;
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {

                    sendResp.sendCustomJSON(null, req, res, true, dbResult[0].data[0], "Success");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "No Data Found");
                }
            } else {
                sendResp.sendCustomJSON(null, req, res, true, campaigns, "Token Invalid");
            }
        });
    },

    scratchWinnerBanners: async function (req, res) {
        try {

            let query = `    select * from tbl_scratch_winner_banners where nowInd() 
                        between from_date and to_date
                       and status = 'ACTIVE' order by banner_priority `;

            let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db', true, 3000);
            if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                sendResp.sendCustomJSON(null, req, res, true, dbResult, "Success");
            } else {
                sendResp.sendCustomJSON(null, req, res, true, [], "No Data Found");
            }
        } catch (error) {
            sendResp.sendCustomJSON(null, req, res, true, [], "something got wrong");

        }
    }

}
