var dbConnection = require('../model/dbConnection');
var sendResp = require('../service/send');
var redisConnection = require('../model/redisConnection');

module.exports = {

    gameWiseLeaderBoard: function (req, res) {

        let query = "select * from fn_gamewise_leaderboard(null)";

        let appId = req.body.appId;

        if (appId) {
            query = "select * from fn_gamewise_leaderboard(" + appId + ")";
        }
        else {
            query = "select * from fn_gamewise_leaderboard(null)";
        }

        console.log('gameWiseLeaderBoard query - ', query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {

            // console.log("gameWiseLeaderBoard err - ", JSON.stringify(err));
            // console.log("gameWiseLeaderBoard details - ", JSON.stringify(dbResult));

            if (err) {
                sendResp.sendCustomJSON(null, req, res, false, null, "Leaderboard Details")
            } else {
                if (dbResult) {
                    sendResp.sendCustomJSON(null, req, res, false, dbResult, "Leaderboard Details")
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, null, "Leaderboard Details")
                }
            }
        }, true, 900)
    },
}