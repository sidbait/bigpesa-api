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
                let queryFavGames =` select app.app_id,app.app_name,app.app_icon_url,total_contest_played,cash_contest_played,
                coin_contest_played,free_contest_played,win_cash_count,win_cash_amount,
                win_coin_count,win_coin_amount,coin_used,cash_used
                 from tbl_player_contest_summary summary 
                inner join tbl_app app on summary.app_id = app.app_id 
                where app.status = 'ACTIVE' and player_id = ${playerIdProfile}
                order by total_contest_played desc `;

                let winCoinCash = `select sum(win_cash_count) as totalCashWin , 
                    sum(win_cash_amount) as totalCoinWin 
                    from tbl_player_contest_summary   where player_id = ${playerIdProfile} `;
                
                let followCount = "select count(1) as followCount from " +
                    " tbl_follow where player_id = " + playerIdProfile + " and status ='ACTIVE' ";
                let profileViews = "select count(1) as profileViewCount " +
                    " from tbl_profile_visits where player_id = " + playerIdProfile + "  "; 
                let player_details = ` select  CASE
                WHEN tbl_player.full_name IS NULL OR tbl_player.full_name = ''::text THEN replace(tbl_player.phone_number, 
                "substring"(tbl_player.phone_number, 5, 6), 'XXXXXX'::text) ELSE tbl_player.full_name
                END AS player_name,first_name,last_name,photo from tbl_player where player_id =  ${playerIdProfile} `
                let isFollowquery =` select count(1) from tbl_follow where from_player_id = ${playerId}  and player_id = ${playerIdProfile}  limit 10 `
                let output = {};
                console.log(winCoinCash)
                Promise.all([ 
                dbConnection.executeQueryAll(winCoinCash, 'rmg_db'),
                dbConnection.executeQueryAll(queryFavGames, 'rmg_db'),
                dbConnection.executeQueryAll(followCount, 'rmg_db'),
                dbConnection.executeQueryAll(profileViews, 'rmg_db'),
                dbConnection.executeQueryAll(player_details,'rmg_db'),
                dbConnection.executeQueryAll(isFollowquery,'rmg_db'),
                ]).then(function (values) {   
                    console.log(values);
                    output.totalCoinWin = values[0][0].totalcoinwin;
                    output.totalCashWin = values[0][0].totalcashwin;
                    output.favGames = values[1];
                    output.followersCount = values[2][0].followcount;
                    output.profileViewCount = values[3][0].profileviewcount;                   
                    output.player_details = values[4][0];
                    output.crown = { name: 'Alexander', icon: "" }                     
                    output.isFollow = 'N';
                    if(parseInt(values[5][0].count)>0){
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
                    console.log(err)
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
                sendResp.sendCustomJSON(null, req, res, true, [], "Already Followed");
            } else {
                let insertResult = await dbConnection.executeQueryAll(insertFollow, 'rmg_db');
                if (insertResult[0].follow_id > 0) {
                    sendResp.sendCustomJSON(null, req, res, true, [], "Followed Successfully");
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
                sendResp.sendCustomJSON(null, req, res, true, [], "Already Unfollowed");
            } else {
                let updateFollowResult = await dbConnection.executeQueryAll(updateFollow, 'rmg_db');
                if (updateFollowResult[0].follow_id > 0) {
                    sendResp.sendCustomJSON(null, req, res, true, [], "Unfollowed Successfully");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Please Try again after some time");;
                }
            }
        }
    },
    followerList: async function (req, res) {
        try {
            var userToken = req.headers["authorization"];
            //var userDetails = await userModel.getUserDetailPromise(userToken);
            var playerIdProfile = req.body.playerIdProfile ? req.body.playerIdProfile : '';
            //let playerId = userDetails.playerId;
            let followerlist = ` select  player.player_id,
                          CASE  WHEN player.full_name IS NULL OR player.full_name = ''::text THEN replace(player.phone_number, 
                          "substring"(player.phone_number, 5, 6), 'XXXXXX'::text) ELSE player.full_name
                          END AS player_name,first_name,photo
                          from tbl_follow follow
                          inner join tbl_player player on player.player_id = follow.from_player_id
                          where follow.player_id = ${playerIdProfile}  and follow.status = 'ACTIVE' `;
            let followerList = await dbConnection.executeQueryAll(followerlist, 'rmg_db');
            if (insertResult[0].follow_id > 0) {
                sendResp.sendCustomJSON(null, req, res, true, followerList, "Followed List");   
            }else{
                sendResp.sendCustomJSON(null, req, res, false, [], "Please Try again after some time");;
            }
        }
        catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
        }

    },
    followingList: async function (req, res) {
        try {
            var userToken = req.headers["authorization"];
            //var userDetails = await userModel.getUserDetailPromise(userToken);
            var playerIdProfile = req.body.playerIdProfile ? req.body.playerIdProfile : '';
            //let playerId = userDetails.playerId;
            let followerlist = `  select  player.player_id,
            CASE  WHEN player.full_name IS NULL OR player.full_name = ''::text THEN replace(player.phone_number, 
            "substring"(player.phone_number, 5, 6), 'XXXXXX'::text) ELSE player.full_name
            END AS player_name,first_name,photo
            from tbl_follow follow
            inner join tbl_player player on player.player_id = follow.player_id
            where follow.from_player_id = ${playerIdProfile}  and follow.status = 'ACTIVE'`;
            let followerList = await dbConnection.executeQueryAll(followerlist, 'rmg_db');
            if (insertResult[0].follow_id > 0) {
                sendResp.sendCustomJSON(null, req, res, true, followerList, "Following List");   
            }else{
                sendResp.sendCustomJSON(null, req, res, false, [], "Please Try again after some time");;
            } 
        }
        catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
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