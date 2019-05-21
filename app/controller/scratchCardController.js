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

                campaigns.forEach(campaign => {
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
                });

                sendResp.sendCustomJSON(null, req, res, true, campaigns, "Scratch Campaign Details");


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
                let query = ` select  trans.id, prize_master.prize_code,prize_master.prize_description,
                        prize_master.prize_image,prize_master.gratification_type, 
                        trans.is_claim, trans.winner_date ,trans.credit_date,trans.add_date,prize_master.prize_amount
                        from tbl_scratch_transaction trans
                        inner join tbl_scratch_prize_master prize_master 
                        on prize_master.prize_id = trans.prize_id
                        where player_id = ${playerId} order by is_claim `;
                console.log(query)
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                    sendResp.sendCustomJSON(null, req, res, true, dbResult, "Success");
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

    contestJoinEvent: function (player_id, join_amount) {
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
                            events.event_code = 'CONTEST_JOIN' `;
                let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                    let camp_id = dbResult[0].camp_id;
                    let scratch_event_id = dbResult[0].scratch_event_id;
                    let amount = dbResult[0].amount;
                    let queryScratchCheck = ` select * from fn_scratch_contest_join(${camp_id}, 
                     ${scratch_event_id},${player_id},${amount},${join_amount})`;

                    let dbScratchCheck = await dbConnection.executeQueryAll(queryScratchCheck, 'rmg_db');
                    if (dbScratchCheck != null && dbScratchCheck != undefined && dbScratchCheck.length > 0) {
                        if (dbScratchCheck[0].data[0].is_claim) {
                            let queryGetScratchCard = ` select * from fn_get_prize(${player_id},${camp_id}) `;
                            let dbGetScratchCard = await dbConnection.executeQueryAll(queryGetScratchCard, 'rmg_db');
                            console.log(dbGetScratchCard);
                        }
                    }

                }

            })();;
        } catch (error) {
            console.log(error);
        }
    }

}
