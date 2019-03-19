var dbConnection = require('../model/dbConnection');
var sendResp = require('../service/send');
var userModel = require('../model/UserModel');
var config = require('config')
module.exports = {
    playerProfile: async function (req, res) {
        try {
            var appSecretKey = req.headers["x-nazara-app-secret-key"];
            var userToken = req.headers["authorization"];
            var userDetails = await userModel.getUserDetailPromise(userToken);
            var playerIdProfile = req.body.playerIdProfile ? req.body.playerIdProfile : '';
            let playerId = userDetails.playerId;
            console.log(playerId);
            if (playerId == "" || playerIdProfile == "") {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token/Player");
            } else {
                let queryFavGames =` select distinct app.app_id,app.app_name ,  
                     '${config.icon_url}' || app_icon as app_icon,app_icon_url ,  
                     count(1) from tbl_contest_leader_board as contest  
                     inner join tbl_app as app on app.app_id = contest.app_id 
                     where contest.player_id = ${playerIdProfile} and app.status = 'ACTIVE'  
                     and app.islive = true group by app.app_id,app_icon ,app.app_name  
                     order by count(1) desc `;
                let winCoin = "select sum(amount) as totalCoinWin from tbl_bonus_credit_que " +
                    " where player_id = " + playerIdProfile + " and event_type ='CONTEST-WIN' ";
                let winCash = "select sum(amount) as totalCashWin " +
                    " from tbl_wallet_credit_que where player_id = " + playerIdProfile + " and event_type ='CONTEST-WIN' ";
                let followCount = "select count(1) as followCount from " +
                    " tbl_follow where player_id = " + playerIdProfile + " and status ='ACTIVE' ";
                let profileViews = "select count(1) as profileViewCount " +
                    " from tbl_profile_visits where player_id = " + playerIdProfile + "  "; 
                let player_details = ` select full_name,first_name,last_name,photo from tbl_player where player_id =  ${playerIdProfile} `
                let isFollowquery =` select count(1) from tbl_follow where from_player_id = ${playerId}  and player_id = ${playerIdProfile}  limit 10 `
                let output = {};
                Promise.all([dbConnection.executeQueryAll(winCoin, 'rmg_db'),
                dbConnection.executeQueryAll(winCash, 'rmg_db'),
                dbConnection.executeQueryAll(queryFavGames, 'rmg_db'),
                dbConnection.executeQueryAll(followCount, 'rmg_db'),
                dbConnection.executeQueryAll(profileViews, 'rmg_db'),
                dbConnection.executeQueryAll(player_details,'rmg_db'),
                dbConnection.executeQueryAll(isFollowquery,'rmg_db'),
                ]).then(function (values) {                   
                    output.totalCoinWin = values[0][0].totalcoinwin;
                    output.totalCashWin = values[1][0].totalcashwin;
                    output.favGames = values[2];
                    output.followersCount = values[3][0].followcount;
                    output.profileViewCount = values[4][0].profileviewcount;                   
                    output.player_details = values[5][0];
                    output.crown = { name: 'Alexander', icon: "" }                     
                    output.isFollow = 'N';
                    if(parseInt(values[6][0].count)){
                        output.isFollow = 'Y';
                    }
                   
                    if (playerId != playerIdProfile) {
                        let insertProfileVisit = "insert into tbl_profile_visits (player_id,from_player_id,created_at) " +
                            " values (" + playerIdProfile + "," + playerId + ",now() ) ";
                        console.log(insertProfileVisit)
                        dbConnection.executeQuery(insertProfileVisit, 'rmg_db', function () { });
                    }else{
                        output.isFollow ='Self'
                    }
                    sendResp.sendCustomJSON(null, req, res, true, output, "Profile Info Found");
                }).catch(function (err) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
                });
            }
        }
        catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
        }
    },
    followPlayer: async function (req, res) {
        let userToken = req.headers["authorization"];
        let userDetails = await userModel.getUserDetailPromise(userToken);
        let playerIdToFollow = req.body.playerIdToFollow ? req.body.playerIdToFollow : '';
        let playerId = userDetails.playerId;
        if (playerId == "" || playerIdToFollow == "") {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token/Player");
        } else {
            chkIsAlreadyFollow = "select count(1) from tbl_follow where " +
                " player_id = " + playerIdToFollow + " and " +
                " status='ACTIVE' and from_player_id = " + playerId + " ";
            insertFollow = " insert into tbl_follow (player_id,from_player_id,created_at,status) " +
                " values( " + playerIdToFollow + "," + playerId + ",now(),'ACTIVE' )  " +
                " ON conflict (player_id,from_player_id) " +
                " do update set status = 'ACTIVE' " +
                " where  tbl_follow.player_id = " + playerIdToFollow + " and " +
                " tbl_follow.from_player_id = " + playerId + " " +
                " returning follow_id ";
            console.log(insertFollow)
            let checkIfAlreadyFollow = await dbConnection.executeQueryAll(chkIsAlreadyFollow, 'rmg_db');
            console.log(checkIfAlreadyFollow[0].count)
            if (checkIfAlreadyFollow[0].count > 0) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Already Followed");
            } else {
                let insertResult = await dbConnection.executeQueryAll(insertFollow, 'rmg_db');
                if (insertResult[0].follow_id > 0) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Followed Successfully");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Please Try again after some time");;
                }
            }
        }
    },
    unfollowPlayer: async function (req, res) {
        var userToken = req.headers["authorization"];
        var userDetails = await userModel.getUserDetailPromise(userToken);
        var playerIdToFollow = req.body.playerIdToFollow ? req.body.playerIdToFollow : '';
        let playerId = userDetails.playerId;
        if (playerId == "" || playerIdToFollow == "") {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token/Player");
        } else {
            chkIsAlreadyFollow = "select count(1) from tbl_follow where " +
                " player_id = " + playerIdToFollow + " and status='ACTIVE' and  from_player_id = " + playerId + " ";
            updateFollow = " update tbl_follow set status = 'DEACTIVE' where  " +
                " player_id = " + playerIdToFollow + " and  " +
                " from_player_id = " + playerId + " returning follow_id ";
            let checkIfAlreadyFollow = await dbConnection.executeQueryAll(chkIsAlreadyFollow, 'rmg_db');
            console.log(checkIfAlreadyFollow[0].count)
            if (checkIfAlreadyFollow[0].count == 0) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Already Unfollowed");
            } else {
                let updateFollowResult = await dbConnection.executeQueryAll(updateFollow, 'rmg_db');
                if (updateFollowResult[0].follow_id > 0) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Unfollowed Successfully");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Please Try again after some time");;
                }
            }
        }
    },
    newPlayerOnboard: async function (req, res) {
        var contestquery = "select * from vw_apps_upcoming_contests_new";
        let contestList = await dbConnection.executeQueryAll(contestquery, "rmg_db");
        let outContest_Free = [];
        let outContest_lessCoin = [];
        let outContest_lessCash = [];
        if (contestList != undefined && contestList != null && contestList.length > 0) {
            contestList.forEach(contest => {

               
                var currenttime = new Date(contest.currenttime);
                var conteststarttime = new Date(contest.start_date_actual);
                var contestendtime = new Date(contest.end_date_actual);

                var remainingstartseconds = (conteststarttime.getTime() - currenttime.getTime()) / 1000;
                var remainingendseconds = (contestendtime.getTime() - currenttime.getTime()) / 1000;

                contest.remainingstartseconds = remainingstartseconds;
                contest.remainingendseconds = remainingendseconds;
                
              
                if (remainingendseconds > 600 
                     && contest.max_players >(contest.player_joined + 3)
                    && contest.live_status == true) { 
                     if (contest.debit_type = 'FREE') {
                         if (outContest_Free.length != 1) {
                             contest.ranks = [];
                             g15daysRankDetails.forEach(rank => {                                
                                if(rank.contest_id == contest.contest_id){
                                    contest.ranks.push(rank)
                                }
                             });
                             outContest_Free.push(contest);
                         }
                     }
                }
            });
            if (outContest_Free.length > 0) {
                sendResp.sendCustomJSON(null, req, res, true, outContest_Free, "Contest")
            } else {
                sendResp.sendCustomJSON(null, req, res, false, [], "No Contest Found")
            }
        }
       
    }
}