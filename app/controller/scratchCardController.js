var dbConnection = require('../model/dbConnection');
var sendResp = require('../service/send');
var userModel = require('../model/UserModel');
var config = require('config');
module.exports = {
    scratchCardContests: async function (req, res) {
        try {
            let query = `  select * from fn_scratch_contest_details() `;
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
        } catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
        }
    },

    getScratchCards: function (req, res) {
        var userToken = req.headers["authorization"];
        userModel.getUserDetails(userToken, async function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            if (playerId != "") {
                let bonusCash = 0;
                let paytmCash = 0;
                let query = ` select  trans.id,prize_master.prize_title, prize_master.prize_code,
                            prize_master.prize_description,
                            event_master.event_code,
                            event_master.name as event_name,
                            event_master.description,event_master.win_description,
                            prize_master.prize_image,prize_master.gratification_type, 
                            trans.is_claim, trans.winner_date ,trans.credit_date,
                            trans.add_date,prize_master.prize_amount
                            from tbl_scratch_transaction trans
                            inner join tbl_scratch_prize_master prize_master 
                            on prize_master.prize_id = trans.prize_id
                            inner join tbl_scratch_event_master event_master
                            on trans.scratch_event_id = event_master.scratch_event_id 
                            where player_id = ${playerId} order by is_claim,add_date desc `;
                console.log(query)
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                    let outJson = {};

                    dbResult.forEach(scratchCard => {
                        if (scratchCard.is_claim) {
                            if (scratchCard.gratification_type.toLowerCase() == "bonus_cash") {
                                bonusCash = parseInt(bonusCash) + parseInt(scratchCard.prize_amount);
                            }
                            else if (scratchCard.gratification_type.toLowerCase() == "paytm_cash") {
                                paytmCash = parseInt(paytmCash) + parseInt(scratchCard.prize_amount);
                            }
                        }
                    });
                    outJson.bonusCash = bonusCash;
                    outJson.paytmCash = paytmCash;
                    outJson.scratchCards = dbResult;
                    sendResp.sendCustomJSON(null, req, res, true, outJson, "Success");
                } else {
                    sendResp.sendCustomJSON(null, req, res, true, [], "No Data Found");
                }
            } else {
                sendResp.sendCustomJSON(null, req, res, true, campaigns, "Token Invalid");
            }
        });
    },

    claimScratchCard: function (req, res) {
        var userToken = req.headers["authorization"];
        let scratchCardId = req.body.scratch_card_id;
        userModel.getUserDetails(userToken, async function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            if (playerId != "") {
                let query = `  update tbl_scratch_transaction set is_claim = true 
                        where is_claim = false and id = ${scratchCardId} returning id; `;
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                    sendResp.sendCustomJSON(null, req, res, true, dbResult, "Successfully Claimed.");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "No Data Found");
                }
            } else {
                sendResp.sendCustomJSON(null, req, res, true, campaigns, "Token Invalid");
            }
        });
    },

    contestJoinEvent: function (player_id, join_amount, matrix_code,channel) {
        try {
            (async function () {

                let isMatrix_Code_Valid = true;
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
                            campaign.valid_to >= nowInd()
                            and campaign.status = 'ACTIVE' and 
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
                                let queryGetScratchCard = ` select * from fn_get_prize_new(${player_id},${camp_id},${scratch_event_id},${channel}) `;
                                console.log(queryGetScratchCard)
                                let dbGetScratchCard = await dbConnection.executeQueryAll(queryGetScratchCard, 'rmg_db');
                                console.log(dbGetScratchCard);
                            }
                        }
                    }
                }
            })();;
        } catch (error) {
            console.log(error);
        }
        this.contestReferEvent(player_id,channel);
    },

    contestReferEvent: function (player_id,channel) {
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
                            and campaign.status = 'ACTIVE' and 
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
                                    let queryGetScratchCard = ` select * from fn_get_prize_new(${fromPlayer_id},${camp_id},${scratch_event_id},${channel}) `;
                                    let dbGetScratchCard = await dbConnection.executeQueryAll(queryGetScratchCard, 'rmg_db');
                                    console.log(dbGetScratchCard);
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
