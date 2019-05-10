var dbConnection = require('../model/dbConnection');
var sendResp = require('../service/send');
var userModel = require('../model/UserModel');
var contestModel = require('../model/contestModel');
var airpay = require('../client/AirpayClient');
var md5 = require('md5');
var sha512 = require('js-sha512');
var dateformat = require('dateformat');
var logger = require('tracer').colorConsole();
var debitcredit = require('../model/debitcredit');
const crypto = require('crypto');
const moment = require('moment-timezone');
const TokenGenerator = require('uuid-token-generator');
const tokgen2 = new TokenGenerator(256, TokenGenerator.BASE62);
var config = require('config');
var uniqid = require('uniqid');
var redisConnection = require('../model/redisConnection');
var push = require('../model/push');

module.exports = {

    appListing: function (req, res) {
        console.log("appListing")
        let query = "select * from tbl_app where app_code != 'BP' and status = 'ACTIVE' order by app_priority";
        console.log(req.headers)
        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("app details - ", JSON.stringify(dbResult));
            sendResp.sendCustomJSON(null, req, res, true, dbResult, "App List")
        })
    },

    appContests: function (req, res) {

        var playerId = req.body.playerId;
        var contestId = req.body.contestId;
        var appId = req.body.appId;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        var isPlaystoreApp = req.body.isPlaystoreApp;
        var isPlaystore = req.body.isPlaystore;
        var platform = req.body.platform;
        var channel = req.body.channel;
        var hideapk = req.body.hideapk;
        // console.log(config.web_url + "/app/v1/download?")
        if (appId == null || appId == undefined) {
            appId = '';
        }
        if (isPlaystoreApp == null || isPlaystoreApp == undefined) {
            isPlaystoreApp = false;
        }
        if (platform == null || platform == undefined) {
            platform = '';
        }
        if (contestId == null || contestId == undefined) {
            contestId = '';
        }
        var now = new Date();
        var md5checksum = md5(contestId) + "|" +
            md5(appSecretKey + "$" + appId);

        var sha512Checksum = sha512(md5checksum);
        logger.info('-----CheckSUM | App Contest-----\n' +
            'appSecretKey - ' + appSecretKey + '\n' +
            'authorization - ' + userToken + '\n' +
            'body - ' + JSON.stringify(req.body) + '\n' +
            'contestId - ' + contestId + '\n' +
            'appId - ' + appId + '\n' +
            'playerId - ' + playerId + '\n' +
            'md5checksum - ' + md5checksum + '\n' +
            'sha512Checksum - ' + sha512Checksum + '\n' +
            'checkSum - ' + checkSum);

        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            userModel.getUserDetails(userToken, function (err, userDetails) {
                if (err) {
                    playerId = "";
                } else {
                    playerId = userDetails.playerId;
                }

                let contestRankquery = " select * from vw_Upcoming_rankDetails where 1=1 ";
                var contestquery = "select * from vw_apps_upcoming_contests_new where 1=1";
                //  let playerquery = `select player_id, tbl_contest.contest_id ,case
                //                 when ((now()::timestamptz + (330::int * '1m'::interval))::time between from_time and to_time) then 'PLAY'
                //                 when from_time >= ((now()::timestamptz + (330::int * '1m'::interval))::time) then 'JOINED'
                //                 when count(distinct player_id) >= max_players then 'FULL'
                //                 else 'PAY' end as player_status
                //                 from rmg_db.public.tbl_contest_players inner join rmg_db.public.tbl_contest on
                //                 tbl_contest.contest_id = tbl_contest_players.contest_id
                //                 where tbl_contest_players.player_id = ${playerId} and 
                //                 tbl_contest.start_date >=( now() - (330::int * '1m'::interval) )
                //                 group by  player_id, tbl_contest.contest_id,  tbl_contest.status,
                //                 from_time,to_time,max_players;`
                let playerquery = ` select * from vw_playerjoined where player_id = ${playerId} `

                if (process.env.NODE_ENV == "preprod") {
                    contestquery = "select * from  vw_apps_upcoming_contests_preprod where 1=1";
                }

                if (contestId != null && contestId != "" && contestId != undefined && contestId != "undefined") {
                    contestId = contestId.toString();
                    contestquery = contestquery + " and contest_id = " + contestId;
                    contestRankquery = contestRankquery + " and contest_id = " + contestId;
                }
                if (isPlaystore != null && isPlaystore != "" && isPlaystore != undefined && isPlaystore != "undefined") {
                    contestquery = contestquery + " and debit_type = 'COIN' ";
                }
                if (appId != null && appId != "" && appId != undefined && appId != "undefined") {
                    contestquery = contestquery + " and app_id = " + appId;
                }
                if (playerId != null && playerId != "" && playerId != undefined && playerId != "undefined") {
                    // playerquery = playerquery + " and player_id = " + playerId;
                } else {
                    playerquery = "select now()";
                }

                //console.log(playerquery)
                //contestquery = contestquery + " order by  app_priority,contest_priority";
                //console.log(contestquery)
                async.parallel({
                    contestquery: function (callback) {
                        dbConnection.executeQuery(contestquery, "rmg_db", function (err, dbResult) {
                            callback(err, dbResult);
                        }, true, 40);
                    },
                    playerquery: function (callback) {
                        dbConnection.executeQuery(playerquery, "rmg_db", function (err, dbResult) {
                            callback(err, dbResult);
                        });
                    }
                },
                    function (err_async, result_async) {
                        var ContestOut = result_async.contestquery;
                        //console.log(result_async.playerquery)
                        var PlayerContests = [];
                        if (playerId != null && playerId != "" && playerId != undefined && playerId != "undefined") {
                            PlayerContests = result_async.playerquery;
                        }
                        var distinctApps = [];
                        if (ContestOut != undefined) {
                            ContestOut.forEach(element => {
                                let isnew = true;
                                distinctApps.forEach(distinctElement => {
                                    if (distinctElement.app_id == element.app_id) {
                                        isnew = false;
                                    }
                                });
                                if (isnew) {
                                    let app = {};
                                    app.app_id = element.app_id;
                                    app.app_name = element.app_name;
                                    app.app_type = element.app_type;
                                    app.app_code = element.app_code;
                                    app.app_icon = element.app_icon;
                                    app.top_text = element.top_text;
                                    if (element.app_icon_url != undefined && element.app_icon_url != null) {
                                        app.app_icon_url = element.app_icon_url;
                                    } else {
                                        app.app_icon_url = "";
                                    }
                                    app.app_secret = element.app_secret;
                                    app.app_status = element.app_status;
                                    app.package_name = element.package_name;
                                    app.download_path = config.api_url + "app/v1/filedownload?appid=" + element.app_id;
                                    app.download_file = config.api_url + element.filename;

                                    app.contests = [];

                                    //console.log("app.download_path", app.download_path);

                                    ContestOut.forEach(contests => {
                                        if (contests.app_id == element.app_id) {
                                            let contest = {}
                                            contest.contest_id = contests.contest_id;
                                            contest.contest_name = contests.contest_name;
                                            contest.contest_desc = contests.contest_desc;
                                            contest.start_date_actual = contests.start_date_actual;
                                            contest.end_date_actual = contests.end_date_actual;
                                            contest.start_date = contests.start_date;
                                            contest.end_date = contests.end_date;
                                            contest.from_time = contests.from_time;
                                            contest.to_time = contests.to_time;
                                            contest.package_name = contests.package_name;
                                            contest.max_players = contests.max_players;
                                            contest.winners = contests.winners;
                                            contest.currency = contests.currency;
                                            contest.debit_type = contests.debit_type;
                                            contest.credit_type = contests.credit_type;
                                            contest.entry_fee = contests.entry_fee;
                                            contest.profit_margin = contests.profit_margin;
                                            contest.cash_margin = 0;//contests.cash_margin;
                                            contest.total_amount = contests.total_amount;
                                            contest.win_amount = contests.win_amount;
                                            contest.css_class = contests.css_class;
                                            contest.win_amount = contests.win_amount;
                                            contest.contest_status = contests.contest_status;
                                            contest.currenttime = contests.currenttime;
                                            contest.min_players = contests.min_player;
                                            contest.max_lives = contests.max_lives;
                                            contest.rank_desc = contests.rank_desc;
                                            contest.contest_minutes = contests.contest_minutes;
                                            contest.infinite_users = contests.infinite_users;
                                            contest.matrix_code = contests.matrix_code;
                                            contest.matrix_desc ="";
                                            if (contest.matrix_code != "") {
                                                gdebitMatrix.forEach(matrix => {
                                                    if (matrix.matrix_code == contest.matrix_code) {
                                                        if (matrix.description != null) {
                                                            contest.matrix_desc = matrix.description;
                                                        }
                                                    }
                                                });
                                            }
                                            if (contests.contest_icon != undefined && contests.contest_icon != null) {
                                                contest.contest_icon = contests.contest_icon;
                                            } else {
                                                contest.contest_icon = "";
                                            }
                                            let publish_type = contests.publish_type;
                                            let contest_channel = contests.channel;

                                            var currenttime = new Date(contest.currenttime);
                                            var conteststarttime = new Date(contest.start_date_actual);
                                            var contestendtime = new Date(contest.end_date_actual);

                                            var remainingstartseconds = (conteststarttime.getTime() - currenttime.getTime()) / 1000;
                                            var remainingendseconds = (contestendtime.getTime() - currenttime.getTime()) / 1000;

                                            contest.remainingstartseconds = remainingstartseconds;
                                            contest.remainingendseconds = remainingendseconds;

                                            contest.contest_rank = [];
                                            g15daysRankDetails.forEach(contestRank => {
                                                if (contestRank.contest_id == contest.contest_id) {
                                                    let rank = {}
                                                    rank.contest_rank_id = contestRank.contest_rank_id;
                                                    rank.rank_name = contestRank.rank_name;
                                                    rank.rank_desc = contestRank.rank_desc;
                                                    rank.lower_rank = contestRank.lower_rank;
                                                    rank.upper_rank = contestRank.upper_rank;
                                                    rank.credit_type = contestRank.credit_type;
                                                    rank.prize_amount = contestRank.prize_amount;
                                                    contest.contest_rank.push(rank);
                                                }
                                            });

                                            contest.player_joined = contests.player_joined;
                                            contest.live_status = contests.live_status;
                                            contest.play_status = 'JOIN';
                                            contest.used_lives = 0;
                                            //console.log(contest.player_joined +"|"+ contest.max_players)
                                            if (parseInt(contest.player_joined) >= parseInt(contest.max_players)) {
                                                contest.play_status = 'FULL';
                                                contest.player_joined = contest.max_players;
                                                //console.log('ISFULL')
                                            }

                                            if (remainingendseconds < 300 && contest.play_status != 'FULL' && contest.play_status != 'JOINED') {
                                                contest.play_status = 'ENTRY-CLOSED';
                                            }

                                            if (playerId != undefined && playerId != null && playerId != '') {
                                                PlayerContests.forEach(contestplayer => {
                                                    if (contestplayer.contest_id == contest.contest_id) {
                                                        contest.play_status = contestplayer.player_status;
                                                        contest.used_lives = contestplayer.used_lives;
                                                    }
                                                });
                                            }

                                            // if (isPlaystoreApp) {
                                            //     if (contest.debit_type.toUpperCase() != "CASH") {
                                            //         app.contests.push(contest);
                                            //     }

                                            // } else {
                                            //     //console.log(contest.debit_type);
                                            //     //console.log(contest.credit_type)
                                            //     if (contest.debit_type.toUpperCase() == "COIN" &&
                                            //         contest.credit_type.toUpperCase() == "COIN") {

                                            //     } else {
                                            //         app.contests.push(contest);
                                            //     }
                                            // }
                                            //console.log('contest.contest_minutes' + contest.contest_minutes + "|" + contest.play_status)
                                            if (contest_channel != "" && contest_channel != null && contest_channel != undefined) {
                                                if (channel.toUpperCase() == "PLAYSTORE" && contest_channel.toUpperCase() == "PLAYSTORE") {
                                                    if (contest.contest_minutes > 0 && contest.play_status == 'FULL') {
                                                    } else {
                                                        app.contests.push(contest);
                                                    }
                                                }
                                                else if (channel.toUpperCase() == "NON-PLAYSTORE" && contest_channel.toUpperCase() == "NON-PLAYSTORE") {
                                                    if (contest.contest_minutes > 0 && contest.play_status == 'FULL') {
                                                    } else {
                                                        app.contests.push(contest);
                                                    }
                                                }
                                            } else {
                                                if (contest.contest_minutes > 0 && contest.play_status == 'FULL') {
                                                } else {
                                                    app.contests.push(contest);
                                                }
                                            }
                                        }
                                    });
                                    if (isPlaystoreApp || hideapk == true) {
                                        if (app.app_type.toLowerCase() != 'android') {
                                            distinctApps.push(app);
                                        }
                                    } else {
                                        if (platform.toLowerCase() != 'ios') {
                                            distinctApps.push(app);
                                        } else {
                                            if (app.app_type.toLowerCase() != 'android') {
                                                distinctApps.push(app);
                                            }
                                        }
                                    }
                                }
                            });
                        }
                        sendResp.sendCustomJSON(null, req, res, true, distinctApps, "App List")
                    });
            })
        }
    },

    aapContestsRank: function (req, res) {
        var playerid = req.query.playerid.toString();
        let contestquery = "select * from vw_apps_contests";
        let playerquery = "select * from vw_player_contest where player_id = " + playerid;
        let contestRankquery = "select * from vw_Upcoming_rankDetails ";

        var contestid = req.query.contestid;
        if (contestid != null && contestid != "" && contestid != undefined && contestid != "undefined") {
            contestid = contestid.toString();
            contestquery = contestquery + " where contest_id = " + contestid;
            playerquery = playerquery + " and contest_id = " + contestid;
            contestRankquery = contestRankquery + " and contest_id = " + contestid;
        }


        async.parallel({
            contestquery: function (callback) {
                dbConnection.executeQuery(contestquery, "rmg_db", function (err, dbResult) {
                    callback(err, dbResult);
                });
            },
            playerquery: function (callback) {
                dbConnection.executeQuery(playerquery, "rmg_db", function (err, dbResult) {
                    callback(err, dbResult);
                });
            },
            contestRankquery: function (callback) {
                dbConnection.executeQuery(contestRankquery, "rmg_db", function (err, dbResult) {
                    callback(err, dbResult);
                });
            }

        },
            function (err_async, result_async) {
                var ContestOut = result_async.contestquery;
                var PlayerContests = result_async.playerquery;
                var contestRanks = result_async.contestRankquery;
                var distinctApps = [];
                ContestOut.forEach(element => {
                    let isnew = true;
                    distinctApps.forEach(distinctElement => {
                        if (distinctElement.app_id == element.app_id) {
                            isnew = false;
                        }
                    });
                    if (isnew) {
                        let app = {};
                        app.app_id = element.app_id;
                        app.app_name = element.app_name;
                        app.app_code = element.app_code;
                        app.app_icon = element.app_icon
                        app.app_secret = element.app_secret;
                        app.app_status = element.app_status;
                        app.contests = []
                        ContestOut.forEach(contests => {
                            if (contests.app_id == element.app_id) {
                                let contest = {}
                                contest.contest_id = contests.contest_id;
                                contest.contest_name = contests.contest_name;
                                contest.contest_desc = contests.contest_desc;
                                contest.start_date = contests.start_date;
                                contest.end_date = contests.end_date;
                                contest.from_time = contests.from_time;
                                contest.to_time = contests.to_time;
                                contest.max_players = contests.max_players;
                                contest.winners = contests.winners;
                                contest.currency = contests.currency;
                                contest.entry_fee = contests.entry_fee;
                                contest.profit_margin = contests.profit_margin;
                                contest.cash_margin = 0;//contests.cash_margin;
                                contest.total_amount = contests.total_amount;
                                contest.win_amount = contests.win_amount;
                                contest.debit_type = contests.debit_type;
                                contest.contest_status = contests.contest_status;
                                contest.live_status = contests.live_status;
                                contest.player_joined = contests.player_joined;
                                contest.contest_rank = [];
                                contestRanks.forEach(contestRank => {
                                    if (contestRank.contest_id == contest.contest_id) {
                                        let rank = {}
                                        rank.contest_rank_id = contestRank.contest_rank_id;
                                        rank.rank_name = contestRank.rank_name;
                                        rank.rank_desc = contestRank.rank_desc;
                                        rank.lower_rank = contestRank.lower_rank;
                                        rank.upper_rank = contestRank.upper_rank;
                                        rank.credit_type = contestRank.credit_type;
                                        rank.prize_amount = contestRank.prize_amount;
                                        contest.contest_rank.push(rank);
                                    }
                                });
                                app.contests.push(contest);
                            }
                        });
                        distinctApps.push(app);
                    }
                });
                sendResp.sendCustomJSON(null, req, res, true, distinctApps, "App List")
            });
    },

    playerContest: function (req, res) {
        var contestId = req.body.contestId;
        var appId = req.body.appId;
        var isPlaystoreApp = req.body.isPlaystoreApp;
        var platform = req.body.platform;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        var now = new Date();
        var channel = req.body.channel;
        if (contestId == undefined) {
            contestId = '';
        }
        if (appId == undefined) {
            appId = '';
        }
        if (isPlaystoreApp == null || isPlaystoreApp == undefined) {
            isPlaystoreApp = false;
        }
        if (platform == null || platform == undefined) {
            platform = '';
        }
        // var md5checksum = md5(config.app.client_key + "$"
        //     + appId + "$" +
        //     + contestId) + '|' +
        //     md5(dateformat(now, 'yyyy-mm-dd'));
        var md5checksum = md5(contestId) + "|" +
            md5(appSecretKey + "$" + appId);
        var sha512Checksum = sha512(md5checksum);

        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            userModel.getUserDetails(userToken, function (err, deails) {
                if (err) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                } else {
                    playerId = deails.playerId;
                    console.log('playerId|' + playerId + "|")
                    if (playerId == "") {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);

                    } else {


                        mobileNumber = deails.phone_number;
                        airpayToken = deails.airpay_token;
                        if (playerId == "") {
                            sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                        } else {
                            let applistquery = "select * from vw_live_app_list where 1=1  ";
                            if (process.env.NODE_ENV == "preprod") {
                                applistquery = "select * from vw_live_app_list where 1=1  ";
                            }
                            let contestquery = "select * from vw_player_contest_withrank where player_id = " + playerId;
                            // let liveContestRankQuery = ` select contest_id ,player_id,player_rank from (  select  contest_id,player_id,  
                            //     app_id,total_score,'ACTIVE',contest_date, RANK()  
                            //      OVER (partition by contest_id  ORDER BY total_score desc ,created_at asc)  
                            //      as player_rank from  tbl_contest_leader_board  
                            //      where total_score > 0 and contest_date >=  
                            //      (now() +  330 * '1 minute'::interval)::date)t 
                            //      where  player_id = ${playerId} `
                            let liveContestRankQuery = ` select contest_id ,player_id,player_rank from (  select  contest_id,player_id,  
                                    app_id,total_score,'ACTIVE',contest_date, RANK()  
                                    OVER (partition by contest_id  ORDER BY total_score desc ,created_at asc)  
                                    as player_rank from  tbl_contest_leader_board  
                                    where total_score > 0 and contest_date >=  
                                    (now() -  (2::int * '1 day'::interval))::date)t 
                                    where  player_id =  ${playerId} `;
                            if (appId != '') {
                                contestquery = contestquery + " and app_id = " + appId;
                                applistquery = applistquery + " and tbl_app.app_id = " + appId;
                            }
                            contestquery = contestquery + " order by contest_date desc, from_time desc";
                            applistquery = applistquery + " order by app_priority";

                            //console.log(contestquery);

                            // console.log(contestquery)
                            // console.log(applistquery)
                            // console.log(liveContestRankQuery)
                            async.parallel({
                                contestquery: function (callback) {
                                    dbConnection.executeQuery(contestquery, "rmg_db", function (err, dbResult) {
                                        callback(err, dbResult);
                                    });
                                },
                                applistquery: function (callback) {
                                    dbConnection.executeQuery(applistquery, "rmg_db", function (err, dbResult) {
                                        callback(err, dbResult);
                                    }, true, 100);
                                },
                                liveContestRankQuery: function (callback) {
                                    dbConnection.executeQuery(liveContestRankQuery, "rmg_db", function (err, dbResult) {
                                        callback(err, dbResult);
                                    });
                                }
                            },
                                function (err_async, result_async) {

                                    var ContestOut = result_async.contestquery;
                                    var AppListing = result_async.applistquery;
                                    var liveContestRank = result_async.liveContestRankQuery;
                                    var distinctApps = [];
                                    // console.log(AppListing)
                                    if (AppListing != null && AppListing != undefined) {
                                        AppListing.forEach(element => {
                                            let app = {}
                                            app.app_id = element.app_id;
                                            app.app_name = element.app_name;
                                            app.app_code = element.app_code;
                                            app.app_icon = element.app_icon;
                                            app.app_icon_url = element.app_icon_url;
                                            app.app_secret = element.app_secret;
                                            app.app_status = element.app_status;
                                            app.app_type = element.app_type;
                                            app.contests = {}
                                            app.contests.LIVE = []
                                            app.contests.UPCOMING = [];
                                            app.contests.COMPLETED = [];
                                            app.contests.OTHER = [];

                                            if (ContestOut != null && ContestOut != undefined) {
                                                ContestOut.forEach(contests => {
                                                    //console.log(contests)
                                                    if (contests.app_id == element.app_id) {
                                                        let contest = {}
                                                        contest.contest_id = contests.contest_id;
                                                        contest.contest_name = contests.contest_name;
                                                        contest.contest_desc = contests.contest_desc;
                                                        contest.start_date = contests.start_date;
                                                        contest.end_date = contests.end_date;
                                                        contest.from_time = contests.from_time;
                                                        contest.to_time = contests.to_time;
                                                        contest.max_players = contests.max_players;
                                                        contest.winners = contests.winners;
                                                        contest.currency = contests.currency;
                                                        contest.entry_fee = contests.entry_fee;
                                                        contest.profit_margin = contests.profit_margin;
                                                        contest.cash_margin = 0;
                                                        contest.total_amount = contests.total_amount;
                                                        contest.win_amount = contests.win_amount;
                                                        contest.debit_type = contests.debit_type;
                                                        contest.credit_type = contests.credit_type;
                                                        contest.css_class = contests.css_class;
                                                        contest.contest_status = contests.contest_status;
                                                        contest.player_joined = contests.player_joined;
                                                        contest.live_status = contests.live_status;
                                                        contest.player_win_amount = contests.player_win_amount;
                                                        contest.player_rank = contests.player_rank;
                                                        contest.winning_credit_type = contests.winning_credit_type;
                                                        contest.min_players = contests.min_player;
                                                        contest.max_lives = contests.max_lives;
                                                        contest.used_lives = contests.used_lives;
                                                        contest.matrix_code = contests.matrix_code;
                                                        contest.infinite_users = contests.infinite_users;
                                                        //contest.transaction_date = contests.transaction_date;
                                                        let contest_channel = contests.channel;
                                                        contest.contest_date = contests.contest_date;

                                                        // contest.play_status = 'PAY';
                                                        // if (contest.player_joined >= contest.max_players) {
                                                        //     contest.play_status = 'FULL';
                                                        // }
                                                        // PlayerContests.forEach(contestplayer => {
                                                        //     if (contestplayer.contest_id == contest.contest_id) {
                                                        //         contest.play_status = contestplayer.player_status;
                                                        //     }
                                                        // });
                                                        contest.currenttime = contests.currenttime;

                                                        var currenttime = new Date(contest.currenttime);
                                                        var conteststarttime = new Date(contest.start_date);
                                                        var contestendtime = new Date(contest.end_date);

                                                        var remainingstartseconds = (conteststarttime.getTime() - currenttime.getTime()) / 1000;
                                                        var remainingendseconds = (contestendtime.getTime() - currenttime.getTime()) / 1000;

                                                        contest.remainingstartseconds = remainingstartseconds;
                                                        contest.remainingendseconds = remainingendseconds;
                                                        contest.start_date = (contest.start_date).toString().substring(0, 16).replace('T', ' ');
                                                        contest.end_date = (contest.end_date).toString().substring(0, 16).replace('T', ' ');

                                                        if (contest.contest_status == "LIVE") {

                                                            let livecontest = contest;
                                                            livecontest.player_win_amount = 0;
                                                            livecontest.rank = 0;
                                                            livecontest.play_status = 'PLAY';

                                                            if (contest.max_lives != 0 && parseInt(contest.max_lives) <= parseInt(contest.used_lives)) {
                                                                livecontest.play_status = 'GAMEOVER';
                                                            }


                                                            // livecontest.player_win_amount =contest.player_win_amount;// 0;
                                                            // livecontest.rank =contest.player_win_amount;// 0;
                                                            if (g15daysRankDetails != null && g15daysRankDetails != undefined && liveContestRank != null && liveContestRank != undefined) {
                                                                liveContestRank.forEach(liveContestRankId => {
                                                                    if (liveContestRankId.contest_id == livecontest.contest_id) {
                                                                        livecontest.rank = liveContestRankId.player_rank;
                                                                        g15daysRankDetails.forEach(ranks => {
                                                                            if (livecontest.contest_id == ranks.contest_id &&
                                                                                parseInt(liveContestRankId.player_rank) >= parseInt(ranks.lower_rank) &&
                                                                                parseInt(liveContestRankId.player_rank) <= parseInt(ranks.upper_rank)) {
                                                                                livecontest.player_win_amount = ranks.prize_amount;
                                                                                livecontest.credit_type = ranks.credit_type;
                                                                                //livecontest.rank = ranks.lower_rank;
                                                                            }
                                                                        });
                                                                    }
                                                                })
                                                            }

                                                            // if (isPlaystoreApp) {
                                                            //     if (contest.debit_type.toUpperCase() != "CASH") {
                                                            //         app.contests.LIVE.push(livecontest);
                                                            //     }
                                                            // } else {
                                                            //     app.contests.LIVE.push(livecontest);
                                                            // }

                                                            if (contest_channel != "" && contest_channel != null) {
                                                                if (channel.toUpperCase() == "PLAYSTORE" && contest_channel.toUpperCase() == "PLAYSTORE") {
                                                                    app.contests.LIVE.push(livecontest);
                                                                }
                                                                else if (channel.toUpperCase() == "NON-PLAYSTORE" && contest_channel.toUpperCase() == "NON-PLAYSTORE") {
                                                                    app.contests.LIVE.push(livecontest);
                                                                }
                                                            } else {
                                                                app.contests.LIVE.push(livecontest);
                                                            }

                                                        } else if (contest.contest_status == "UPCOMING") {
                                                            // if (isPlaystoreApp) {
                                                            //     if (contest.debit_type.toUpperCase() != "CASH") {
                                                            //         app.contests.UPCOMING.push(contest);
                                                            //     }
                                                            // } else {
                                                            //     app.contests.UPCOMING.push(contest);
                                                            // }
                                                            if (contest_channel != "" && contest_channel != null) {
                                                                if (channel.toUpperCase() == "PLAYSTORE" && contest_channel.toUpperCase() == "PLAYSTORE") {
                                                                    app.contests.UPCOMING.push(contest);
                                                                }
                                                                else if (channel.toUpperCase() == "NON-PLAYSTORE" && contest_channel.toUpperCase() == "NON-PLAYSTORE") {
                                                                    app.contests.UPCOMING.push(contest);
                                                                }
                                                            } else {
                                                                app.contests.UPCOMING.push(contest);
                                                            }
                                                        } else if (contest.contest_status == "COMPLETED") {
                                                            let completedcontest = contest;
                                                            completedcontest.cancel = false;
                                                            completedcontest.player_win_amount = contest.player_win_amount;// 0;
                                                            completedcontest.rank = contest.player_rank;// 0;
                                                            completedcontest.credit_type = contest.winning_credit_type;
                                                            if (contest.min_players != 0 && parseInt(contest.min_players) > parseInt(contest.player_joined)) {
                                                                completedcontest.cancel = true;
                                                            } else {
                                                                completedcontest.cancel = false;
                                                            }

                                                            //console.log(liveContestRank)
                                                            // if (g15daysRankDetails != null && g15daysRankDetails != undefined &&
                                                            //     liveContestRank != null && liveContestRank != undefined) {
                                                            //     liveContestRank.forEach(liveContestRankId => {
                                                            //         if (liveContestRankId.contest_id == completedcontest.contest_id) {
                                                            //             //completedcontest.rank = liveContestRankId.player_rank;
                                                            //             g15daysRankDetails.forEach(ranks => {
                                                            //                 if (completedcontest.contest_id == ranks.contest_id &&
                                                            //                     parseInt(liveContestRankId.player_rank) >= parseInt(ranks.lower_rank) &&
                                                            //                     parseInt(liveContestRankId.player_rank) <= parseInt(ranks.upper_rank)
                                                            //                 ) {
                                                            //                     // completedcontest.player_win_amount = ranks.prize_amount;
                                                            //                     // completedcontest.credit_type = ranks.credit_type;
                                                            //                     //completedcontest.rank = ranks.lower_rank;
                                                            //                 }
                                                            //             });
                                                            //         }
                                                            //     })
                                                            // }

                                                            // if (contestRanks != null && contestRanks != undefined) {
                                                            //     contestRanks.forEach(ranks => {
                                                            //         if (completedcontest.contest_id == ranks.contest_id && ranks.lower_rank == completedcontest.player_rank) {
                                                            //             completedcontest.player_win_amount = ranks.prize_amount;
                                                            //             completedcontest.rank = ranks.lower_rank;
                                                            //         } 
                                                            //     });
                                                            // }

                                                            // if (isPlaystoreApp) {
                                                            //     if (contest.debit_type.toUpperCase() != "CASH") {
                                                            //         app.contests.COMPLETED.push(completedcontest);
                                                            //     }
                                                            // } else {
                                                            //     app.contests.COMPLETED.push(completedcontest);
                                                            // }
                                                            //console.log(completedcontest)
                                                            if (contest_channel != "" && contest_channel != null) {
                                                                if (channel.toUpperCase() == "PLAYSTORE" && contest_channel.toUpperCase() == "PLAYSTORE") {
                                                                    app.contests.COMPLETED.push(completedcontest);
                                                                }
                                                                else if (channel.toUpperCase() == "NON-PLAYSTORE" && contest_channel.toUpperCase() == "NON-PLAYSTORE") {
                                                                    app.contests.COMPLETED.push(completedcontest);
                                                                }
                                                            } else {
                                                                app.contests.COMPLETED.push(completedcontest);
                                                            }
                                                            //  console.log(completedcontest)
                                                        }
                                                        else {

                                                            if (isPlaystoreApp) {
                                                                if (contest.debit_type.toUpperCase() != "CASH") {
                                                                    app.contests.OTHER.push(contest)
                                                                }
                                                            } else {
                                                                app.contests.OTHER.push(contest)
                                                            }

                                                        }

                                                    }
                                                });
                                            }

                                            if (isPlaystoreApp) {
                                                if (app.app_type.toLowerCase() != 'android') {
                                                    distinctApps.push(app);
                                                }
                                            } else {
                                                if (platform.toLowerCase() != 'ios') {
                                                    distinctApps.push(app);
                                                } else {
                                                    if (app.app_type.toLowerCase() != 'android') {
                                                        distinctApps.push(app);
                                                    }
                                                }
                                            }
                                        });
                                    }
                                    //console.log('PlayerContestResponse '+playerId + "\n" + JSON.stringify(distinctApps) )
                                    sendResp.sendCustomJSON(null, req, res, true, distinctApps, "App List")
                                });

                        }
                    }
                }
            });

        }
    },

    contestResult: function (req, res) {
        let contestId = req.body.contestId;
        let appId = req.body.appId;
        let playerId = null;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        var now = new Date(); 
        var md5checksum = md5(contestId) + "|" +
            md5(appSecretKey + "$" + appId);
        var sha512Checksum = sha512(md5checksum);
        console.log(sha512Checksum)
        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            userModel.getUserDetails(userToken, function (err, deails) {
                if (err) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                } else {
                    playerId = deails.playerId;
                    if (playerId == "") {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                    } else {
                        console.log(deails);
                        mobileNumber = deails.phone_number;
                        airpayToken = deails.airpay_token;
                        let livesCheckQuery = `select COALESCE( used_lives ,0) as  used_lives from 
                                        tbl_contest_players where contest_id =  ${contestId} and player_id = ${playerId}  `;
                        let contestDetails = ` select * from vw_apps_contests where contest_id = ${contestId} `;
                        let winnerDetails = ` select * from vw_last7days_winner  where  contest_id = ${contestId} ; `;
                        let contestRankquery = ` select * from tbl_contest_rank  where contest_id = ${contestId} order by upper_rank asc; `;
                        console.log(contestDetails)
                        async.parallel({
                            contestDetails: function (callback) {
                                dbConnection.executeQuery(contestDetails, "rmg_db", function (err, dbResult) {
                                    callback(err, dbResult);
                                });
                            },
                            winnerDetails: function (callback) {
                                dbConnection.executeQuery(winnerDetails, "rmg_db", function (err, dbResult) {
                                    callback(err, dbResult);
                                });
                            },
                            contestRankquery: function (callback) {
                                dbConnection.executeQuery(contestRankquery, "rmg_db", function (err, dbResult) {
                                    callback(err, dbResult);
                                });
                            },
                            livesCheck: function (callback) {
                                dbConnection.executeQuery(livesCheckQuery, "rmg_db", function (err, dbResult) {
                                    callback(err, dbResult);
                                });
                            }
                        },
                            function (err_async, result_async) {
                                //console.log(err_async)
                                if (err_async) {
                                    sendResp.sendCustomJSON(err_async, req, res, false, [], "Something got wrong")
                                } else {
                                    var contestdetails = result_async.contestDetails;
                                    var winnerDetails = result_async.winnerDetails;
                                    var rankDetails = result_async.contestRankquery;
                                    let livesCheck = result_async.livesCheck;
                                    var outJson = {};


                                    var currenttime = new Date(contestdetails[0].currenttime);
                                    var conteststarttime = new Date(contestdetails[0].start_date);
                                    var contestendtime = new Date(contestdetails[0].end_date);

                                    var remainingstartseconds = (conteststarttime.getTime() - currenttime.getTime()) / 1000;
                                    var remainingendseconds = (contestendtime.getTime() - currenttime.getTime()) / 1000;

                                    let max_lives = contestdetails[0].max_lives;



                                    contestdetails[0].remainingstartseconds = remainingstartseconds;
                                    contestdetails[0].remainingendseconds = remainingendseconds;

                                    contestdetails[0].contest_rank = [];
                                    rankDetails.forEach(contestRank => {
                                        if (contestRank.contest_id == contestdetails[0].contest_id) {
                                            let rank = {}
                                            rank.contest_rank_id = contestRank.contest_rank_id;
                                            rank.rank_name = contestRank.rank_name;
                                            rank.rank_desc = contestRank.rank_desc;
                                            rank.lower_rank = contestRank.lower_rank;
                                            rank.upper_rank = contestRank.upper_rank;
                                            rank.prize_amount = contestRank.prize_amount;
                                            rank.credit_type = contestRank.credit_type;
                                            contestdetails[0].contest_rank.push(rank);
                                        }
                                    });
                                    contestdetails[0].used_lives = livesCheck[0].used_lives;
                                    if (contestdetails[0].live_status == true) {
                                        if (max_lives != 0 && livesCheck[0].used_lives >= max_lives) {
                                            contestdetails[0].live_status == false;
                                            contestdetails[0].play_status = "GAMEOVER";
                                        } else {
                                            contestdetails[0].play_status = "PLAY";
                                        }
                                    } else {
                                        contestdetails[0].play_status = "CONTESTEND";
                                    }

                                    outJson.ContestDetails = contestdetails[0];
                                    outJson.PlayerRank = {};
                                    outJson.PreviousRank = {};
                                    outJson.NextRank = {};
                                    outJson.Winners = [];
                                    var playerRankNo = 0;

                                    winnerDetails.forEach(players => {
                                        if (players.player_id == playerId) {
                                            outJson.PlayerRank = players;
                                            outJson.PlayerRank.winPrize = 0;
                                            playerRankNo = parseInt(players.player_rank);
                                        }
                                        rankDetails.forEach(contestRank => {
                                            if (contestRank.contest_id == contestdetails[0].contest_id &&
                                                parseInt(players.player_rank) >= parseInt(contestRank.lower_rank) &&
                                                parseInt(players.player_rank) <= parseInt(contestRank.upper_rank)) {
                                                if (players.player_id == playerId) {
                                                    outJson.PlayerRank.winPrize = contestRank.prize_amount;
                                                    outJson.PlayerRank.credit_type = contestRank.credit_type;
                                                    //players.winPrize = contestRank.prize_amount;
                                                    if (parseFloat(players.total_score) > 0) {
                                                        players.winPrize = contestRank.prize_amount;
                                                    } else {
                                                        players.winPrize = 0;
                                                    }
                                                    players.credit_type = contestRank.credit_type;
                                                } else {
                                                    players.winPrize = contestRank.prize_amount;
                                                    players.credit_type = contestRank.credit_type;
                                                }
                                            }
                                        });
                                        if (parseFloat(players.total_score) > 0) {
                                            outJson.Winners.push(players);
                                        }
                                    });
                                    var NextRank = playerRankNo + 1;
                                    var PrevRank = playerRankNo - 1;
                                    winnerDetails.forEach(element => {
                                        //console.log(element.player_id + "|" + playerId)
                                        if (element.player_id != playerId) {
                                            if (NextRank == element.player_rank &&
                                                parseFloat(element.total_score) > 0) {
                                                outJson.NextRank = element;
                                                outJson.NextRank.winPrize = 0;
                                                rankDetails.forEach(contestRank => {
                                                    if (contestRank.contest_id == contestdetails[0].contest_id &&
                                                        parseInt(NextRank) >= parseInt(contestRank.lower_rank) &&
                                                        parseInt(NextRank) <= parseInt(contestRank.upper_rank)) {
                                                        outJson.NextRank.winPrize = contestRank.prize_amount;
                                                        outJson.NextRank.credit_type = contestRank.credit_type;
                                                    }
                                                });
                                            } else if (PrevRank == element.player_rank && parseFloat(element.total_score) > 0) {
                                                outJson.PreviousRank = element;
                                                outJson.PreviousRank.winPrize = 0;
                                                rankDetails.forEach(contestRank => {
                                                    if (contestRank.contest_id == contestdetails[0].contest_id &&
                                                        parseInt(PrevRank) >= parseInt(contestRank.lower_rank) &&
                                                        parseInt(PrevRank) <= parseInt(contestRank.upper_rank)) {
                                                        outJson.PreviousRank.winPrize = contestRank.prize_amount;
                                                        outJson.PreviousRank.credit_type = contestRank.credit_type;
                                                    }
                                                });
                                            }
                                        }
                                    });
                                    sendResp.sendCustomJSON(null, req, res, true, outJson, "Contest Details")
                                }

                            });

                    }
                }
            })
        }
    },

    playerTransaction: function (req, res) {
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];

        userModel.getUserDetails(userToken, function (err, deails) {
            if (err) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
            } else {
                playerId = deails.playerId;
                if (playerId == "") {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                } else {


                    mobileNumber = deails.phone_number;
                    airpayToken = deails.airpay_token;

                    let query = 'select * from vw_player_transactions where player_id =' + playerId;

                    //console.log('vw_player_transactions | query - ' + query);

                    dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                        var prevdate = ""
                        var DatewiseTrans = {};
                        var OutJson = [];

                        if (dbResult != null) {
                            dbResult.forEach(trans => {
                                //console.log(trans.group_date+ "|"+ prevdate)
                                if (trans.group_date == prevdate) {
                                    DatewiseTrans.Transactions.push(trans)
                                } else {
                                    if (prevdate != "") {
                                        OutJson.push(DatewiseTrans);
                                    }
                                    prevdate = trans.group_date;

                                    DatewiseTrans = {};
                                    DatewiseTrans.Date = prevdate;
                                    DatewiseTrans.Transactions = [];
                                    DatewiseTrans.Transactions.push(trans);
                                }
                            });

                            OutJson.push(DatewiseTrans);
                            sendResp.sendCustomJSON(err, req, res, true, OutJson, "Player Transaction List")
                        }
                        else {
                            sendResp.sendCustomJSON(err, req, res, false, OutJson, "Player Transaction List")
                        }

                    });
                }
            }
        });
    },

    getWinningAmount: function (req, res) {

        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];

        userModel.getUserDetails(userToken, function (err, userDetails) {
            if (err) {
                response.Success = false;
                response.Data = "Data Not Found"
                // console.log(response)
                res.send(response)
            } else {
                var playerId = userDetails.playerId;
                if (playerId == "") {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                } else {


                    let query = "select IFNULL( sum(transaction_amount),0) as winning_amount from vw_player_transaction where player_id ='" + playerId + "' and  trans_type = 'Credit' ";

                    var response = {};
                    response.IsValidToken = true;
                    response.Success = true;
                    response.Message = "Winning Amount";
                    response.Data = ""
                    dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                        if (err) {
                            response.Success = false;
                            response.Data = "Data Not Found"
                            //console.log(response)
                            res.send(response);
                        } else {
                            var amount = dbResult[0].winning_amount
                            response.Data = [];
                            response.Data.push({ winning_amount: amount })
                            //console.log(response)
                            res.send(response);
                        }
                    });
                }
            }
        });
    },

    postContestScore: function (req, res) {
        var contestId = req.body.contestId;
        var appId = req.body.appId;
        let score = req.body.score;
        let deviceId = req.body.deviceId;
        let playerId = req.body.playerId;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];

        if (appId == null || appId == undefined) {
            appId = '';
        }
        if (contestId == null || contestId == undefined) {
            contestId = '';
        }
        if (playerId == null || playerId == undefined) {
            playerId = '';
        }
        var now = new Date();
        console.log('-------Req Body Score Post');
        console.log(req.body);
        console.log(playerId)
        console.log('--------------------------');
        // var md5checksum = md5(appSecretKey + "$"
        //     + appId + "$" +
        //     + contestId + "$" +
        //     + score + "$" +
        //     + deviceId) + '|' +
        //     md5(dateformat(now, 'yyyy-mm-dd'));
        var md5checksum = md5(contestId + "$" +
            appId + "$" +
            playerId + "$" +
            score + "$" +
            deviceId) + '|' +
            md5(appSecretKey + "$" + appId);
        // var param1 =  contestId + "$" +  appId + "$" + playerId + "$" +  score + "$" + deviceId 
        var sha512Checksum = sha512(md5checksum);

        logger.info('-----CheckSUM | postScore-----\n' +
            'param1 -' + contestId + "$" + appId + "$" +
            playerId + "$" +
            score + "$" +
            deviceId + '\n' +
            'param2 - ' + appSecretKey + "$" + appId + '\n' +
            'param3 - ' + dateformat(now, 'yyyy-mm-dd') + '\n' +
            'appSecretKey - ' + appSecretKey + '\n' +
            'authorization - ' + userToken + '\n' +
            'contestId - ' + contestId + '\n' +
            'appId - ' + appId + '\n' +
            'score - ' + score + '\n' +
            'playerId - ' + playerId + '\n' +
            'md5checksum - ' + md5checksum + '\n' +
            'sha512Checksum - ' + sha512Checksum + '\n' +
            'checkSum - ' + checkSum);
        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            userModel.getUserDetails(userToken, function (err, userDetails) {
                if (err) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token!")
                } else {

                    if (userDetails.playerId != "") {
                        playerId = userDetails.playerId;
                    }

                    var checkStatus = " select count(1) from vw_player_contest where contest_id = " + contestId + " and player_id = " + playerId + " and player_status = 'PLAY' "
                    var query = "  INSERT INTO public.tbl_app_score (contest_id, player_id, app_id, score, status, created_at) " +
                        "VALUES(" + contestId + ", " + playerId + ", " + appId + ", " + score + ", 'ACTIVE', now()) " +
                        "RETURNING app_score_id ";
                    console.log(checkStatus)
                    dbConnection.executeQuery(checkStatus, "rmg_db", function (err, dbResult) {
                        if (dbResult[0].count > 0) {
                            dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                                if (err) {
                                    sendResp.sendCustomJSON(null, req, res, false, [], err.toString());
                                } else {
                                    if (dbResult == null || dbResult == undefined) {
                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                    } else if (dbResult.length == 0) {
                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                    } else if (dbResult[0].app_score_id) {

                                        // var query_leader_board = "INSERT INTO public.tbl_contest_leader_board " +
                                        //     "(contest_leader_board_id, contest_id, player_id, app_id, total_score, status, contest_date, created_at) " +
                                        //     "VALUES(unique_rowid(), " + contestId + ", " + playerId + ", " + appId + ", " + score + ", 'ACTIVE', " +
                                        //     "now()::date, now()) " +
                                        //     "ON CONFLICT (contest_id, player_id, app_id, contest_date) " +
                                        //     "DO UPDATE SET total_score = (select total_score from tbl_contest_leader_board  " +
                                        //     "where contest_id =  " + contestId + " and app_id = " + appId + " and player_id = " + playerId + "  " +
                                        //     "and contest_date = now()::date limit 1) +  " +
                                        //     "excluded.total_score returning tbl_contest_leader_board.*";

                                        var query_leader_board = " update tbl_contest_leader_board set total_score = " + score
                                            + ", created_at=now()   " +
                                            " where contest_id = " + contestId + " and player_id = " + playerId + " " +
                                            "  and app_id = " + appId + " and total_score <  " + score + "  ";
                                        console.log(query_leader_board)
                                        dbConnection.executeQuery(query_leader_board, "rmg_db", function (err, dbResult) {
                                            if (dbResult == null || dbResult == undefined) {
                                                sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                            }
                                            else {
                                                sendResp.sendCustomJSON(null, req, res, true, [], "Score posted successfully!", true);
                                            }
                                        });
                                    } else {
                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                    }
                                }
                            })
                        } else {
                            sendResp.sendCustomJSON(err, req, res, false, [], "Contest Is not Valid to post score");
                        }
                    });
                }
            })
        }
    },

    joinContest: function (req, res) {

        let contestId = req.body.contestId;
        let appId = req.body.appId;
        let playerId = null;
        let airpayToken = null;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        var sessionToken = tokgen2.generate();
        let channel = req.body.channel ? req.body.channel : '';
        let getUserDetails = " select * from vw_userdetail where token = " + appSecretKey;
        let randomNumber = (Math.floor(Math.random() * 90000) + 1);
        var now = new Date();

        console.log('CHANNEL ----------------' + channel)
        // var md5checksum = md5(config.app.client_key + "$"
        //     + appId + "$" +
        //     + contestId) + '|' +
        //     md5(dateformat(now, 'yyyy-mm-dd'));
        var md5checksum = md5(contestId) + "|" +
            md5(appSecretKey + "$" + appId);

        var sha512Checksum = sha512(md5checksum);

        // logger.info('-----CheckSUM | postScore-----\n' +
        //     'appSecretKey - ' + appSecretKey + '\n' +
        //     'contestId - ' + contestId + '\n' +
        //     'appId - ' + appId + '\n' +
        //     'playerId - ' + playerId + '\n' +
        //     'md5checksum - ' + md5checksum + '\n' +
        //     'sha512Checksum - ' + sha512Checksum + '\n' +
        //     'checkSum - ' + checkSum);

        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            userModel.getUserDetails(userToken, function (err, deails) {
                if (err) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                } else {
                    playerId = deails.playerId;
                    if (playerId == "") {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                    } else {
                        mobileNumber = deails.phone_number;
                        airpayToken = deails.airpay_token;
                        let player_name = deails.player_name;
                        let imgurl = deails.imgurl;
                        contestModel.getLiveContestDetails(contestId, appId, playerId, function (err, contestInfo) {

                            if (err) {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                            }
                            else {

                                if (contestInfo == null || contestInfo == undefined)
                                    contestInfo = null;
                                else if (contestInfo.length == 0)
                                    contestInfo = null;
                                else
                                    contestInfo = contestInfo[0];



                                if (contestInfo == null || contestInfo == undefined) {
                                    sendResp.sendCustomJSON(null, req, res, false, [], "Contest details not available!");
                                } else {

                                    if (contestInfo.app_type == null || contestInfo.app_type == undefined)
                                        contestInfo.app_type = "";
                                    let isLive = contestInfo.live_status;
                                    let matrix_code = contestInfo.matrix_code;
                                    let debit_type = contestInfo.debit_type;
                                    let max_lives = contestInfo.max_lives;
                                    let passData = "contestId=" + contestId.toString();
                                    let isSendParams = contestInfo.send_params;
                                    let package_name = contestInfo.package_name;
                                    let app_type = contestInfo.app_type;
                                    let gc = contestInfo.game_conf ? contestInfo.game_conf : '';
                                    if (contestInfo.app_type.toLowerCase() == "android") {
                                        passData = "contestId=" + contestId.toString()
                                            + "&playToken=" + sessionToken
                                            + "&userToken=" + userToken;
                                    }
                                    else {
                                        if (isSendParams) {
                                            passData = "appId=" + appId.toString() +
                                                "&contestId=" + contestId.toString() +
                                                "&playerId=" + playerId.toString() +
                                                "&userToken=" + userToken + "&playToken="
                                                + sessionToken + "&rn="
                                                + randomNumber + "&gc=" + gc;
                                        } else {
                                            passData = "playToken=" + sessionToken;
                                        }
                                    }
                                    var redirect_link = "";
                                    console.log('isSendParams:' + isSendParams)
                                    if (isSendParams) {
                                        console.log('DATA: ' + passData);
                                        var dt = moment.tz((new Date()), "UTC").format('YYYYMMDD');
                                        var enPass = "auth.bigpesa.com" + dt
                                        var iv = dt + "zJq6BMXu"
                                        const cipher = crypto.createCipheriv('aes192', enPass, iv);
                                        let encrypted = cipher.update(passData, 'utf8', 'hex');
                                        encrypted += cipher.final('hex');
                                        redirect_link = contestInfo.deep_link.replace(/{dldata}/gi, encrypted);
                                        redirect_link = redirect_link.replace(/{appid}/gi, appId);
                                    } else {
                                        if (contestInfo.deep_link.indexOf('?') > 0) {

                                        } else {
                                            redirect_link = contestInfo.deep_link + "?";
                                        }
                                        if (contestInfo.deep_link.indexOf('&') > 0) {
                                            redirect_link = contestInfo.deep_link + "&playToken=" + sessionToken + "gc=" + gc + "&rn=" + randomNumber + "&playerName=" + player_name + "&imgUrl=" + imgurl;
                                        } else {
                                            redirect_link = contestInfo.deep_link + "playToken=" + sessionToken + "&gc=" + gc + "&rn=" + randomNumber + "&playerName=" + player_name + "&imgUrl=" + imgurl;
                                        }
                                    }

                                    console.log('redirect_link - ', redirect_link);

                                    //console.log('contestInfo.play_status - ' + contestInfo.play_status);
                                    if (contestInfo.play_status == "PLAY") {
                                        if (max_lives != 0) {
                                            let validateLives = ` select * from vw_playerjoined where player_id =${playerId} and contest_id = ${contestId} `;
                                            console.log(validateLives)
                                            dbConnection.executeQuery(validateLives, "rmg_db", function (err, checkLives) {
                                                if (checkLives && checkLives.length > 0 &&checkLives[0].player_status == "PLAY") {
                                                    let isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                                    if (isTokenSave) {
                                                        if (isLive) {
                                                            increaseLives(playerId, contestId);
                                                            sendResp.sendCustomJSON(null, req, res, true,
                                                                {
                                                                    play_status: "PLAY",
                                                                    deep_link: redirect_link,
                                                                    session_token: sessionToken,
                                                                    package_name: package_name,
                                                                    app_type: app_type
                                                                }, "Succesfully Joined", true);
                                                        } else {
                                                            sendResp.sendCustomJSON(null, req, res, true,
                                                                {
                                                                    play_status: "JOINED",
                                                                    deep_link: redirect_link,
                                                                    session_token: sessionToken,
                                                                    package_name: package_name,
                                                                    app_type: app_type
                                                                }, "Succesfully Joined", true);
                                                        }
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                    }
                                                }
                                                else if (checkLives && checkLives.length > 0 && checkLives[0].player_status == "GAMEOVER") {
                                                    getNewLives(contestInfo, playerId, userToken, airpayToken, function (err, debitResponse) {
                                                        console.log('NEW LIVES RS---------')
                                                        console.log(err)
                                                        console.log(debitResponse)
                                                        if (err) {
                                                            sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, You have used all your lives! Try to play other contest.");
                                                        } else {
                                                            if (debitResponse.statusCode == "200") {
                                                                let isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                                                if (isTokenSave) {
                                                                    if (isLive) {
                                                                        increaseLives(playerId, contestId);
                                                                        sendResp.sendCustomJSON(null, req, res, true,
                                                                            {
                                                                                play_status: "PLAY",
                                                                                deep_link: redirect_link,
                                                                                session_token: sessionToken,
                                                                                package_name: package_name,
                                                                                app_type: app_type
                                                                            }, "Succesfully Joined", true);
                                                                    } else {
                                                                        sendResp.sendCustomJSON(null, req, res, true,
                                                                            {
                                                                                play_status: "JOINED",
                                                                                deep_link: redirect_link,
                                                                                session_token: sessionToken,
                                                                                package_name: package_name,
                                                                                app_type: app_type
                                                                            }, "Succesfully Joined", true);
                                                                    }
                                                                } else {
                                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                }
                                                            } else {
                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, You have used all your lives! Try to play other contest.");
                                                            }
                                                        }
                                                        //
                                                    });
                                                }
                                                else {
                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                }
                                            });
                                        } else {
                                            let isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                            if (isTokenSave) {
                                                if (isLive) {
                                                    increaseLives(playerId, contestId);
                                                    sendResp.sendCustomJSON(null, req, res, true,
                                                        {
                                                            play_status: "PLAY",
                                                            deep_link: redirect_link,
                                                            session_token: sessionToken,
                                                            package_name: package_name,
                                                            app_type: app_type
                                                        }, "Succesfully Joined", true);
                                                } else {
                                                    sendResp.sendCustomJSON(null, req, res, true,
                                                        {
                                                            play_status: "JOINED",
                                                            deep_link: redirect_link,
                                                            session_token: sessionToken,
                                                            package_name: package_name,
                                                            app_type: app_type
                                                        }, "Succesfully Joined", true);
                                                }
                                            } else {
                                                sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                            }
                                        }
                                    } else if (contestInfo.play_status == "JOINED") {
                                        var isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                        if (isTokenSave) {
                                            sendResp.sendCustomJSON(null, req, res, true, {
                                                play_status: "JOINED",
                                                deep_link: redirect_link,
                                                session_token: sessionToken,
                                                package_name: package_name,
                                                app_type: app_type
                                            }, "You have joined the contest!", true);
                                        } else {
                                            sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                        }

                                    } else if (contestInfo.play_status == "PAY") {

                                        if (contestInfo.players_joined >= contestInfo.max_players) {
                                            sendResp.sendCustomJSON(null, req, res, false, [], "Sorry all seats just got filled.");
                                        } else {
                                            // let query_isContestFull =" select case when  count(1) >= contest.max_players " +
                                            // " then 'full' else 'pay' end as state from tbl_contest contest " +
                                            // " inner join tbl_contest_players contest_player on contest_player.contest_id = contest.contest_id " +
                                            // " where contest.contest_id = "+ contestId +" " +
                                            // " group by contest.max_players ";
                                            let checkIfAlreadyJoined = " select  coalesce(count(1),0) as ct from tbl_contest_players where " +
                                                " player_id = " + playerId + " and contest_id =" + contestId + " ";

                                            dbConnection.executeQuery(checkIfAlreadyJoined, "rmg_db", function (err, isAlreadyJoin) {
                                                if (err) {
                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Contest details not available!");
                                                } else {
                                                    if (isAlreadyJoin != undefined &&
                                                        isAlreadyJoin != null &&
                                                        isAlreadyJoin.length > 0) {
                                                        console.log(isAlreadyJoin);
                                                        if (isAlreadyJoin[0].ct > 0) {
                                                            if (isLive) {
                                                                increaseLives(playerId, contestId);
                                                                sendResp.sendCustomJSON(null, req, res, true, {
                                                                    play_status: "DEBITED",
                                                                    deep_link: redirect_link,
                                                                    session_token: sessionToken,
                                                                    package_name: package_name,
                                                                    app_type: app_type
                                                                }, "Already Joined", true);
                                                            } else {
                                                                sendResp.sendCustomJSON(null, req, res, true, {
                                                                    play_status: "JOINED",
                                                                    deep_link: redirect_link,
                                                                    session_token: sessionToken,
                                                                    package_name: package_name,
                                                                    app_type: app_type
                                                                }, "Joined Successfully", true);
                                                            }
                                                        } else {
                                                            let query_isContestFull = " select case when  count( distinct contest_player.player_id ) >= contest.max_players " +
                                                                " then 'full' else 'pay' end as state  from tbl_contest contest  " +
                                                                " left join tbl_contest_players contest_player on " +
                                                                " contest_player.contest_id = contest.contest_id   " +
                                                                " where contest.contest_id = " + contestId + "  " +
                                                                " group by contest.max_players ";
                                                            dbConnection.executeQuery(query_isContestFull, "rmg_db", function (err, resultIsFull) {
                                                                if (err) {
                                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Contest details not available!");
                                                                } else {
                                                                    console.log('----XXXX------------------------');
                                                                    console.log(query_isContestFull);
                                                                    console.log(err);
                                                                    console.log(resultIsFull);
                                                                    console.log('----XXXX------------------------');
                                                                    if (resultIsFull != undefined &&
                                                                        resultIsFull != null &&
                                                                        resultIsFull.length > 0 &&
                                                                        resultIsFull[0].state.toLowerCase() == 'pay') {
                                                                        // console.log('YOU CAN JOIN :' + resultIsFull[0].state);
                                                                        if (contestInfo.debit_type == "FREE") {

                                                                            contestModel.joinContestPlayer(contestId, appId, playerId, 0,
                                                                                "FREE-CONTEST", "FRC-" + Date.now().toString(), "ACTIVE", channel, debit_type, max_lives, function (isJoined) {

                                                                                    var score = 0;//Initial score set to 0
                                                                                    contestModel.insertContestScore(contestId, appId, playerId, score, function (response) {
                                                                                    });

                                                                                    let checkContestIslive = " select count(1) from tbl_contest where (now() + (5 * interval '1 hour') + " +
                                                                                        " (30 * interval '1 minute'))::TIME between from_time and to_time and contest_id = " + contestId + " "

                                                                                    dbConnection.executeQuery(checkContestIslive, "rmg_db", function (err, dbResult) {
                                                                                        if (dbResult[0].count > 0) {
                                                                                            var isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                                                                            if (isTokenSave) {
                                                                                                if (isLive) {
                                                                                                    increaseLives(playerId, contestId);
                                                                                                    sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                        play_status: "DEBITED",
                                                                                                        deep_link: redirect_link,
                                                                                                        session_token: sessionToken,
                                                                                                        package_name: package_name,
                                                                                                        app_type: app_type
                                                                                                    }, "Balance Debited Successfully", true);
                                                                                                } else {
                                                                                                    sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                        play_status: "JOINED",
                                                                                                        deep_link: redirect_link,
                                                                                                        session_token: sessionToken,
                                                                                                        package_name: package_name,
                                                                                                        app_type: app_type
                                                                                                    }, "Balance Debited Successfully", true);
                                                                                                }
                                                                                            } else {
                                                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                            }
                                                                                        } else {
                                                                                            var isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                                                                            if (isTokenSave) {
                                                                                                if (isLive) {
                                                                                                    increaseLives(playerId, contestId);
                                                                                                    sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                        play_status: "DEBITED",
                                                                                                        deep_link: redirect_link,
                                                                                                        session_token: sessionToken,
                                                                                                        package_name: package_name,
                                                                                                        app_type: app_type
                                                                                                    }, "Balance Debited Successfully", true);
                                                                                                } else {
                                                                                                    sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                        play_status: "JOINED",
                                                                                                        deep_link: redirect_link,
                                                                                                        session_token: sessionToken,
                                                                                                        package_name: package_name,
                                                                                                        app_type: app_type
                                                                                                    }, "Balance Debited Successfully", true);
                                                                                                }
                                                                                            } else {
                                                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                            }
                                                                                        }
                                                                                    });
                                                                                })
                                                                        }
                                                                        else {
                                                                            //userModel.playerWalletBalance(mobileNumber, airpayToken, function (walletBalance) {
                                                                            userModel.playerWalletBalance(appId, appSecretKey, userToken, airpayToken, function (walletBalance, nzBonus) {

                                                                                // console.log('walletBalance - ' + walletBalance)
                                                                                // console.log('nzBonus - ' + nzBonus)

                                                                                var amount = contestInfo.entry_fee;

                                                                                if (contestInfo.debit_type == "CASH") {
                                                                                    console.log('CHECK CASH--------------' + walletBalance + "|" + amount)
                                                                                    if (walletBalance >= amount) {
                                                                                        let token = Date.now();
                                                                                        let orderId = Date.now();

                                                                                        console.log('IN CASH--------------' + walletBalance + "|" + amount)
                                                                                        var event = 'JOIN CONTEST';
                                                                                        var event_id = contestInfo.contest_id;
                                                                                        var event_name = contestInfo.app_name + "(" + contestInfo.contest_name + ")";
                                                                                        debitcredit.debitAmountAirpayContestJoin(userToken, airpayToken, orderId, 'DEBIT', amount,
                                                                                            event, event_id, event_name, matrix_code, function (err, debitResponse) {

                                                                                                if (err) {
                                                                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");

                                                                                                } else {

                                                                                                    if (!debitResponse) {
                                                                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                                    } else {
                                                                                                        //debitResponse = debitResponse.data;
                                                                                                        contestModel.joinContest(contestId, appId, playerId, amount,
                                                                                                            debitResponse, deails, contestInfo, channel, debit_type, max_lives,
                                                                                                            function (isJoined) {
                                                                                                                console.log('isJoined' + isJoined)
                                                                                                                //Success
                                                                                                                if (isJoined == true) {

                                                                                                                    if (debitResponse.statusCode == "200") {

                                                                                                                        var score = 0;//Initial score set to 0
                                                                                                                        contestModel.insertContestScore(contestId, appId, playerId, score, function (response) {
                                                                                                                        });

                                                                                                                        let checkContestIslive = " select count(1) from tbl_contest where (now() + (5 * interval '1 hour') + " +
                                                                                                                            " (30 * interval '1 minute'))::TIME between from_time and to_time and contest_id = " + contestId + " "

                                                                                                                        dbConnection.executeQuery(checkContestIslive, "rmg_db", function (err, dbResult) {
                                                                                                                            //request('http://localhost:3001/amounts?playerid=' + playerId);
                                                                                                                            if (dbResult[0].count > 0) {
                                                                                                                                var isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                                                                                                                if (isTokenSave) {
                                                                                                                                    console.log('CHECKING IS LIVE 1' + isLive)
                                                                                                                                    if (isLive) {
                                                                                                                                        increaseLives(playerId, contestId);
                                                                                                                                        sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                                                            play_status: "DEBITED",
                                                                                                                                            deep_link: redirect_link,
                                                                                                                                            session_token: sessionToken,
                                                                                                                                            package_name: package_name,
                                                                                                                                            app_type: app_type
                                                                                                                                        }, "Balance Debited Successfully", true);
                                                                                                                                    } else {
                                                                                                                                        sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                                                            play_status: "JOINED",
                                                                                                                                            deep_link: redirect_link,
                                                                                                                                            session_token: sessionToken,
                                                                                                                                            package_name: package_name,
                                                                                                                                            app_type: app_type
                                                                                                                                        }, "Balance Debited Successfully", true);
                                                                                                                                    }
                                                                                                                                } else {
                                                                                                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                                                                }

                                                                                                                            } else {
                                                                                                                                var isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                                                                                                                if (isTokenSave) {
                                                                                                                                    if (isLive) {
                                                                                                                                        increaseLives(playerId, contestId);
                                                                                                                                        sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                                                            play_status: "DEBITED",
                                                                                                                                            deep_link: redirect_link,
                                                                                                                                            session_token: sessionToken,
                                                                                                                                            package_name: package_name,
                                                                                                                                            app_type: app_type
                                                                                                                                        }, "Balance Debited Successfully", true);
                                                                                                                                    } else {
                                                                                                                                        sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                                                            play_status: "JOINED",
                                                                                                                                            deep_link: redirect_link,
                                                                                                                                            session_token: sessionToken,
                                                                                                                                            package_name: package_name,
                                                                                                                                            app_type: app_type
                                                                                                                                        }, "Balance Debited Successfully", true);
                                                                                                                                    }
                                                                                                                                } else {
                                                                                                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                                                                }

                                                                                                                            }
                                                                                                                        });
                                                                                                                    }
                                                                                                                    else if (debitResponse.statusCode == "202") {
                                                                                                                        sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                                            play_status: "DEPOSIT-CASH",
                                                                                                                            entry_fee: amount,
                                                                                                                            wallet_balance: walletBalance
                                                                                                                        }, "Low Balance", true);
                                                                                                                    }
                                                                                                                    else {
                                                                                                                        sendResp.sendCustomJSON(null, req, res, false, [], debitResponse.TRANSACTION.MESSAGE);
                                                                                                                    }
                                                                                                                }
                                                                                                                else {
                                                                                                                    sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                                                }
                                                                                                            })
                                                                                                    }
                                                                                                }
                                                                                            })
                                                                                    }
                                                                                    else {
                                                                                        sendResp.sendCustomJSON(null, req, res, true, {
                                                                                            play_status: "DEPOSIT-CASH",
                                                                                            entry_fee: amount,
                                                                                            wallet_balance: walletBalance,
                                                                                            nzBonus: nzBonus,
                                                                                        }, "Low Balance", true);
                                                                                    }
                                                                                }
                                                                                else if (contestInfo.debit_type == "COIN") {

                                                                                    if (nzBonus >= amount) {

                                                                                        userModel.creditDebitBonus(contestId, "CONTEST-JOIN", contestId, "DEBIT", amount,
                                                                                            "Contest Join Debit - " + contestId, null,
                                                                                            appSecretKey, userToken, function (isDebited, debitResponse) {
                                                                                                if (isDebited == false) {
                                                                                                    sendResp.sendCustomJSON(null, req, res, false, [], debitResponse);
                                                                                                } else {
                                                                                                    contestModel.joinContestPlayer(contestId, appId, playerId, amount,
                                                                                                        "COIN-CONTEST", "COIN-" + Date.now().toString(), "ACTIVE", channel, debit_type, max_lives, function (isJoined) {
                                                                                                            if (isJoined) {
                                                                                                                var score = 0;//Initial score set to 0
                                                                                                                contestModel.insertContestScore(contestId, appId, playerId, score, function (response) {
                                                                                                                });

                                                                                                                let checkContestIslive = " select count(1) from tbl_contest where (now() + (5 * interval '1 hour') + " +
                                                                                                                    " (30 * interval '1 minute'))::TIME between from_time and to_time and contest_id = " + contestId + " "

                                                                                                                dbConnection.executeQuery(checkContestIslive, "rmg_db", function (err, dbResult) {
                                                                                                                    // request('http://localhost:3001/amounts?playerid=' + playerId);
                                                                                                                    var isTokenSave = insertIntoScore(contestId, playerId, appId, 0, sessionToken, randomNumber);
                                                                                                                    if (isTokenSave) {
                                                                                                                        if (isLive) {
                                                                                                                            increaseLives(playerId, contestId);
                                                                                                                            sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                                                play_status: "DEBITED",
                                                                                                                                deep_link: redirect_link,
                                                                                                                                session_token: sessionToken,
                                                                                                                                package_name: package_name,
                                                                                                                                app_type: app_type
                                                                                                                            }, "Bonus Debited Successfully", true);
                                                                                                                        } else {
                                                                                                                            sendResp.sendCustomJSON(null, req, res, true, {
                                                                                                                                play_status: "JOINED",
                                                                                                                                deep_link: redirect_link,
                                                                                                                                session_token: sessionToken,
                                                                                                                                package_name: package_name,
                                                                                                                                app_type: app_type
                                                                                                                            }, "Bonus Debited Successfully", true);
                                                                                                                        }

                                                                                                                    } else {
                                                                                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                                                    }
                                                                                                                });
                                                                                                            }
                                                                                                            else {
                                                                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Sorry, please refresh the screen and try again");
                                                                                                            }
                                                                                                        });
                                                                                                }
                                                                                            })
                                                                                    }
                                                                                    else {
                                                                                        sendResp.sendCustomJSON(null, req, res, true, {
                                                                                            play_status: "DEPOSIT-COIN",
                                                                                            entry_fee: amount,
                                                                                            wallet_balance: walletBalance,
                                                                                            nzBonus: nzBonus,
                                                                                        }, "Insufficient Coins to join the contest!", true);
                                                                                    }
                                                                                }
                                                                                else {
                                                                                    sendResp.sendCustomJSON(null, req, res, true, {
                                                                                        play_status: "FAILED",
                                                                                        entry_fee: amount,
                                                                                        wallet_balance: walletBalance,
                                                                                        nzBonus: nzBonus,
                                                                                    }, "Debit Type is not defined ", true);
                                                                                }
                                                                            });
                                                                        }
                                                                    } else {
                                                                        console.log('----XXXX-CONTEST FULL--------------------');
                                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Sorry all seats just got filled.");
                                                                    }
                                                                }
                                                            });
                                                        }
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Contest details not available!");
                                                    }
                                                }
                                            })

                                        }
                                    }
                                    else if (contestInfo.play_status == "FULL") {
                                        sendResp.sendCustomJSON(null, req, res, false, [], "Contest Is Full!");
                                    }
                                    else if (contestInfo.play_status == "ENTRY-CLOSED") {
                                        sendResp.sendCustomJSON(null, req, res, false, [], "Entry Closed!");
                                    }
                                    else {
                                        sendResp.sendCustomJSON(null, req, res, false, [], "Contest not started yet to play!");
                                    }
                                }
                            }
                        })
                    }
                }
            });
        }
    },

    updateAppStatus: function (req, res) {
        var appId = req.body.appId;
        var isDwonloaded = req.body.isDwonloaded;
        var isInstalled = req.body.isInstalled;
        var playerId = null;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        console.log('-----------------------------APP STATUS')
        console.log(req.body)
        console.log('-----------------------------APP STATUS')
        if (appId == null || appId == undefined) {
            appId = '';
        }

        var now = new Date();

        var md5checksum = md5(isDwonloaded + "$" + isInstalled) + "|" +
            md5(appSecretKey + "$" + appId);
        var sha512Checksum = sha512(md5checksum);

        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            userModel.getUserDetails(userToken, function (err, userDetails) {
                if (err) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token");
                } else {
                    playerId = userDetails.playerId;
                    let checkIfAvailable = "select count(1) from tbl_app_player_info where app_id = " + appid
                        + " and player_id = " + playerid;

                    dbConnection.executeQuery(checkIfAvailable, "rmg_db", function (err, dbResult) {
                        if (err) {
                            sendResp.sendCustomJSON(null, req, res, false, [], "Something Got wrong");
                        } else {
                            if (dbResult == null) {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Something Got wrong");
                            } else {
                                if (dbResult[0].count == 0) {
                                    var insertAppinfo = "insert into tbl_app_player_info ( app_id, player_id , is_downloaded , is_installed , download_date , install_date , created_at ) values ( " + appid
                                        + ", " + playerid + ",'" + isDwonloaded + "','" + isInstalled + "',now(),now(),now() ) ";
                                    // console.log(insertAppinfo)
                                    dbConnection.executeQuery(insertAppinfo, "rmg_db", function (err, dbResult) {
                                        sendResp.sendCustomJSON(null, req, res, true, [], "Inserted Successfully", true);
                                    });
                                }
                                else {
                                    var updateAppinfo = "update tbl_app_player_info set is_downloaded = '" + isDwonloaded
                                        + "' , is_installed ='" + isInstalled + "' where app_id = " + appid + " and player_id = " + playerid;
                                    dbConnection.executeQuery(updateAppinfo, "rmg_db", function (err, dbResult) {
                                        sendResp.sendCustomJSON(null, req, res, true, [], "Updated Successfully", true);
                                    });
                                }
                            }
                        }
                    })
                }
            })
        }
    },

    checkAppStatus: function (req, res) {
        var playerId = null;
        var appId = req.body.appId;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        if (appId == null || appId == undefined) {
            appId = '';
        }

        var now = new Date();
        // var md5checksum = md5(config.app.client_key + "$"
        //     + appId) + '|' +
        //     md5(dateformat(now, 'yyyy-mm-dd'));

        var md5checksum = md5(appSecretKey + "$" + appId);

        var sha512Checksum = sha512(md5checksum);
        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            userModel.getUserDetails(userToken, function (err, userDetails) {
                if (err) {
                    //sendResp.sendCustomJSON(null, req, res, false, { is_installed: false, is_downloaded: false }, "App Not Installed");
                    sendResp.sendCustomJSON(null, req, res, true, { is_installed: true, is_downloaded: true }, "App Not Installed", true);
                } else {
                    playerId = userDetails.playerId;
                    if (playerId == undefined || playerId == null || playerId == "") {
                        sendResp.sendCustomJSON(null, req, res, true, { is_installed: true, is_downloaded: true }, "App Not Installed", true);
                    } else {
                        let checkappquery = "select * from tbl_app_player_info where app_id = " + appId
                            + " and player_id = " + playerId + "";
                        //console.log(checkappquery)
                        dbConnection.executeQuery(checkappquery, "rmg_db", function (err, dbResult) {
                            //console.log(dbResult)
                            if (dbResult.length > 0) {
                                sendResp.sendCustomJSON(null, req, res, true, { is_installed: true, is_downloaded: true }, "App Not Installed", true);
                            } else {
                                sendResp.sendCustomJSON(null, req, res, true, { is_installed: true, is_downloaded: true }, "App Not Installed", true);
                            }
                        });
                    }
                }
            });
        }
    },

    leaderBoard: function (req, res) {

        var TopPlayed = gTopGamePlays;//result_async.getTopPlayed;
        var TopWinner = gTopPrizeWin;
        var TopReferrer = gTopReferer;// result_async.getTopReferrer;
        var RankDetails = gTopEvents;
        var outJson = {}
        outJson.Today = {}
        outJson.Today.TopPlayed = [];
        outJson.Today.TopWinner = [];
        outJson.Today.TopReferer = [];
        outJson.Yesterday = {}
        outJson.Yesterday.TopPlayed = [];
        outJson.Yesterday.TopWinner = [];
        outJson.Yesterday.TopReferer = [];
        if (TopPlayed != null && TopPlayed != undefined && TopPlayed.length > 0) {
            TopPlayed.forEach(element => {
                element.credit_type = "";
                element.amount = 0;
                RankDetails.forEach(rank => {
                    if (rank.event_name == 'TOP_GAMEPLAY' && rank.rank == element.rank) {
                        element.credit_type = rank.credit_type;
                        element.amount = rank.amount;
                    }
                });
                if (element.days == 'Today') {
                    if (outJson.Today.TopPlayed.length <= 500) {
                        outJson.Today.TopPlayed.push(element);
                    }
                } else if (element.days == 'Yesterday') {
                    if (outJson.Yesterday.TopPlayed.length <= 500) {
                        outJson.Yesterday.TopPlayed.push(element);
                    }
                }
            });
        }
        if (TopWinner != null && TopWinner != undefined && TopWinner.length > 0) {
            let WinAmountSumToday = 0;
            let WinAmountSumYesterday = 0;
            TopWinner.forEach(element => {
                if (element.days == 'Today') {
                    WinAmountSumToday = WinAmountSumToday + parseFloat(element.winprize);
                    //if (outJson.Today.TopWinner.length <= 500) {
                    outJson.Today.TopWinner.push(element);
                    //}
                } else if (element.days == 'Yesterday') {
                    WinAmountSumYesterday = WinAmountSumYesterday + parseFloat(element.winprize);
                    //if (outJson.Yesterday.TopWinner.length <= 500) {
                    outJson.Yesterday.TopWinner.push(element);
                    //}
                }
            });
            outJson.Today.TopWinnerPrizeTotal = WinAmountSumToday;
            outJson.Yesterday.TopWinnerPrizeTotal = WinAmountSumYesterday;
        }
        if (TopReferrer != null && TopReferrer != undefined && TopReferrer.length > 0) {
            let TotalRefererCountYesterday = 0;
            let TotalRefererCountToday = 0;
            TopReferrer.forEach(element => {
                element.credit_type = "";
                element.amount = 0;

                RankDetails.forEach(rank => {
                    if (rank.event_name == 'TOP_REFERER' && rank.rank == element.rank) {
                        element.credit_type = rank.credit_type;
                        element.amount = rank.amount;
                    }
                });
                if (element.days == 'Today') {
                    TotalRefererCountToday = TotalRefererCountToday + parseFloat(element.topreferer)
                    if (outJson.Today.TopReferer.length <= 200) {
                        outJson.Today.TopReferer.push(element)
                    }
                } else if (element.days == 'Yesterday') {
                    TotalRefererCountYesterday = TotalRefererCountYesterday + parseFloat(element.topreferer)
                    if (outJson.Yesterday.TopReferer.length <= 200) {
                        outJson.Yesterday.TopReferer.push(element)
                    }
                }
            });
            outJson.Today.TopRefererTotal = TotalRefererCountToday;
            outJson.Yesterday.TopRefererTotal = TotalRefererCountYesterday;
        }
        //console.log(RankDetails)
        sendResp.sendCustomJSON(null, req, res, true, outJson, "Leaderboard Details");
        // }
        // );
    },

    updateAppStatusSdk: function (req, res) {
        var appList = req.body.appList;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        console.log('-----------------------------APP SDK STATUS')
        console.log(req.body)
        console.log('-----------------------------APP SDK STATUS')
        userModel.getUserDetails(userToken, function (err, userDetails) {
            if (err) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token");
            } else {
                sendResp.sendCustomJSON(null, req, res, true, [], "Updated Successfully", true);

                var playerId = userDetails.playerId;

                if (appList != undefined && appList != null && appList.length > 0) {
                    appList = JSON.parse(appList);
                    appList.forEach(element => {
                        let package_name = element.package_name;
                        let app_id = element.app_id;
                        let checkIfAvailable = "select count(1) from tbl_app_player_info where app_id = " + app_id
                            + " and player_id = " + playerId;

                        dbConnection.executeQuery(checkIfAvailable, "rmg_db", function (err, dbResult) {
                            if (err) {
                                console.log(err)
                            } else {
                                if (dbResult == null) {
                                    sendResp.sendCustomJSON(null, req, res, false, [], "Something Got wrong");
                                } else {
                                    if (dbResult[0].count == 0) {
                                        var insertAppinfo = "insert into tbl_app_player_info ( app_id, player_id , is_downloaded , is_installed , download_date , install_date , created_at ) values ( " + app_id
                                            + ", " + playerId + ",'" + true + "','" + true + "',now(),now(),now() ) ";
                                        //console.log(insertAppinfo)
                                        dbConnection.executeQuery(insertAppinfo, "rmg_db", function (err, dbResult) {
                                            if (err) {
                                                console.log(err)
                                            } else {
                                                console.log('inserted')
                                            }
                                        });
                                    }
                                    else {
                                        var updateAppinfo = "update tbl_app_player_info set is_downloaded = '" + true
                                            + "' , is_installed ='" + true + "' where app_id = " + app_id + " and player_id = " + playerId;
                                        dbConnection.executeQuery(updateAppinfo, "rmg_db", function (err, dbResult) {
                                            if (err) {
                                                console.log(err)
                                            } else {
                                                console.log('update Successfully')
                                            }
                                        });
                                    }
                                }
                            }
                        })
                    });
                }

            }
        })
    },

    updatePoints: async function (req, res) {

        console.log('UPDATE DEPOSITE')
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var amount = req.body.amount;
        var txnId = req.body.txnId;
        var userDetails = await userModel.getUserDetailPromise(userToken);
        var playerId = userDetails.playerId;
        if (playerId == "") {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token", false, false);
        } else {
            let query = " select created_at,now(),amount  ,player_id  " +
                " from  tbl_wallet_transaction  where order_id ='" + txnId + "' " +
                " and player_id = " + playerId + " " +
                " and order_id::text not in (select comment  from tbl_bonus_transaction )  ";
            let depositeCount = " select count(1) from tbl_wallet_transaction " +
                " where player_id =  " + playerId + " and " +
                " nz_txn_status = 'SUCCESS' " +
                " and nz_txn_type = 'DEPOSIT'; ";
            console.log(depositeCount)
            var totalDepositCount = await dbConnection.executeQueryOnlyResolve(depositeCount, 'rmg_db');
            var transDetails = await dbConnection.executeQueryOnlyResolve(query, 'rmg_db');

            if (transDetails.err
                || totalDepositCount.err
                || transDetails.result == undefined
                || totalDepositCount.result == undefined
                || totalDepositCount.result.length == 0
                || transDetails.result.length == 0) {
                sendResp.sendCustomJSON(null, req, res, true, [], "Update Failed", true);
            } else {
                console.log('depositeCount:' + totalDepositCount.result[0].count)
                console.log('UPDATE DEPOSITE IN !!!!!!!!!!!!')
                console.log(transDetails.result)
                console.log(Math.round(transDetails.result[0].amount) + "|" + Math.round(amount))
                if (transDetails.result == undefined ||
                    transDetails.length == 0 ||
                    Math.round(transDetails.result[0].amount) != Math.round(amount)) {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Transaction");
                } else {
                    let depositeCount = totalDepositCount.result[0].count;
                    let traxid = uniqid();
                    // if (depositeCount == 1 && Math.round(amount) >= 50) {
                    //     amount = Math.round(amount); //first deposite 100%
                    //     console.log('INSERT GIVING MONEY')
                    //     debitcredit.insertIntoWalletQue(traxid, 'DepositBonus', 'DepositBonus', Math.round(amount), 'Deposit Bonus', playerId, true, function (isSuccess, data) {
                    //         if (isSuccess) {
                    //             data.amout = Math.round(amount);
                    //             sendResp.sendCustomJSON(null, req, res, true, data, "Updated Successfully", true);
                    //         } else {
                    //             sendResp.sendCustomJSON(null, req, res, false, [], "Transaction Failed");
                    //         }
                    //     });

                    // } else
                    if (depositeCount > 1 && Math.round(amount) >= 100) {
                        amount = Math.round(Math.round(amount) * (0.2));
                        console.log('INSERT GIVING MONEY')
                        debitcredit.insertIntoWalletQue(traxid, 'DepositBonus', txnId, Math.round(amount), 'Deposit Bonus', playerId, true, function (isSuccess, data) {
                            if (isSuccess) {
                                data.amout = Math.round(amount);
                                sendResp.sendCustomJSON(null, req, res, true, data, "Updated Successfully", true);
                            } else {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Transaction Failed");
                            }
                        });
                    } else if (Math.round(amount) >= 100 && depositeCount == 1) {
                        amount = Math.round(amount);
                        if (amount >= 500) {
                            amount = 500;
                        }
                        if (amount < 500) {
                            amount = Math.round(Math.round(amount) * (0.7));
                        }
                        debitcredit.insertIntoWalletQue(traxid, 'DepositBonus', txnId, Math.round(amount), 'Deposit Bonus', playerId, true, function (isSuccess, data) {
                            if (isSuccess) {
                                data.amout = Math.round(amount);
                                sendResp.sendCustomJSON(null, req, res, true, data, "Updated Successfully", true);
                            } else {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Transaction Failed");
                            }
                        });
                    }

                }
            }
        }
    },

    dowloadFile: function (req, res) {
        var app_id = req.query.appId;
        if (app_id == undefined) {
            app_id = req.query.appid;
        }

        console.log('dowloadFile app_id - ', app_id);

        dbConnection.executeQuery("select filename from tbl_app where app_id = '" + app_id + "' ", "rmg_db", function (err, dbResult) {
            if (err || dbResult == undefined || dbResult.length == 0) {
                res.send("");
            } else {
                var filename = dbResult[0].filename;
                if (filename != undefined && filename != null && filename != "") {
                    file = './public/' + filename;
                    res.download(file);
                } else {
                    res.send("Invalid AppId");
                }
            }
        });
    },

    claimToEarn: async function (req, res) {
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var que_id = req.body.que_id;
        var que_type = req.body.que_type;

        try {
            var userDetails = await userModel.getUserDetailPromise(userToken);
            var playerId = userDetails.playerId;
            if (playerId == "") {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token", false, false);
            } else {
                if (que_type.toLowerCase() == 'all') {
                    let updateAllWallet = "update tbl_wallet_credit_que set is_claim = true " +
                        " where is_claim = false and player_id = " + playerId + " ";
                    let updateAllBonus = "update tbl_bonus_credit_que set is_claim = true " +
                        " where is_claim = false and player_id = " + playerId + " ";
                    let bonusPromise = dbConnection.executeQueryAll(updateAllBonus, 'rmg_db');
                    let walletPromise = dbConnection.executeQueryAll(updateAllWallet, 'rmg_db');

                    Promise.all([bonusPromise, walletPromise]).then(function (values) {
                        // request('http://localhost:3001/notification?playerid=' + playerId);
                        sendResp.sendCustomJSON(null, req, res, true, values, "Update Successfull");
                    }).catch(function (err) {
                        sendResp.sendCustomJSON(null, req, res, false, transDetails, err);
                    });

                } else {
                    let queryUpdateToClaim = "";
                    if (que_type.toLowerCase() == "wallet") {
                        queryUpdateToClaim = " update tbl_wallet_credit_que set is_claim = true " +
                            " where que_id = " + que_id + " and is_claim = false RETURNING que_id,'cash' as credit_type,amount";
                    } else if (que_type.toLowerCase() == "bonus") {
                        queryUpdateToClaim = " update tbl_bonus_credit_que set is_claim = true " +
                            " where que_id = " + que_id + " and is_claim = false RETURNING que_id,'coin' as credit_type,amount";
                    }
                    console.log(queryUpdateToClaim)
                    var transDetails = await dbConnection.executeQueryAll(queryUpdateToClaim, 'rmg_db');
                    console.log(transDetails)
                    if (transDetails != null && transDetails.length > 0) {
                        //request('http://localhost:3001/notification?playerid=' + playerId);
                        sendResp.sendCustomJSON(null, req, res, true, transDetails, "Update Successfull");
                    } else {
                        sendResp.sendCustomJSON(null, req, res, false, transDetails, "Invalid Que ID");
                    }
                }
            }
        }
        catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
        }
    },

    pendingClaim: async function (req, res) {
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        try {
            var userDetails = await userModel.getUserDetailPromise(userToken);
            var playerId = userDetails.playerId;
            if (playerId == "") {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token", false, false);
            } else {
                let queryPendingClaims = "select * from vw_pendingClaims where player_id = " + playerId + "";
                var transDetails = await dbConnection.executeQueryAll(queryPendingClaims, 'rmg_db');
                console.log(transDetails)
                sendResp.sendCustomJSON(null, req, res, true, transDetails, "Pendig Records To Claim");
            }
        }
        catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong");
        }
    },

    postHtmlScore: function (req, res) {
        var contestId = req.body.contestId;
        var appId = req.body.appId;
        let score = req.body.score;
        let deviceId = req.body.deviceId;
        let playerId = req.body.playerId;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        var sessionToken = req.headers["x-session-token"];
        if (appId == null || appId == undefined) {
            appId = '';
        }
        if (contestId == null || contestId == undefined) {
            contestId = '';
        }
        if (playerId == null || playerId == undefined) {
            playerId = '';
        }
        if (sessionToken != null && sessionToken != undefined && sessionToken != "") {


            var now = new Date();
            console.log('-------Req Body Score Post');
            console.log(req.body);
            console.log(playerId)
            console.log('--------------------------');

            var md5checksum = md5(contestId + "$" +
                appId + "$" +
                playerId + "$" +
                score + "$" +
                deviceId) + '|' +
                md5(appSecretKey + "$" + appId);

            var sha512Checksum = sha512(md5checksum);

            logger.info('-----CheckSUM | postScore-----\n' +
                'param1 -' + contestId + "$" + appId + "$" +
                playerId + "$" +
                score + "$" +
                deviceId + '\n' +
                'param2 - ' + appSecretKey + "$" + appId + '\n' +
                'param3 - ' + dateformat(now, 'yyyy-mm-dd') + '\n' +
                'appSecretKey - ' + appSecretKey + '\n' +
                'authorization - ' + userToken + '\n' +
                'contestId - ' + contestId + '\n' +
                'appId - ' + appId + '\n' +
                'score - ' + score + '\n' +
                'playerId - ' + playerId + '\n' +
                'md5checksum - ' + md5checksum + '\n' +
                'sha512Checksum - ' + sha512Checksum + '\n' +
                'checkSum - ' + checkSum);
            if (sha512Checksum != checkSum) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
            }
            else {
                userModel.getUserDetails(userToken, function (err, userDetails) {
                    if (err) {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token!")
                    } else {
                        if (userDetails.playerId == "") {
                            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token!")
                        } else {

                            playerId = userDetails.playerId;
                            validateSessionToken(sessionToken, contestId, appId, playerId).then(isSessionTokenValid => {
                                if (isSessionTokenValid) {
                                    var checkStatus = " select count(1) from vw_player_contest where contest_id = " + contestId + " and player_id = " + playerId + " and player_status = 'PLAY' "
                                    var query = "  INSERT INTO public.tbl_app_score (contest_id, player_id, app_id, score, status, created_at) " +
                                        "VALUES(" + contestId + ", " + playerId + ", " + appId + ", " + score + ", 'ACTIVE', now()) " +
                                        "RETURNING app_score_id ";
                                    console.log(checkStatus)
                                    dbConnection.executeQuery(checkStatus, "rmg_db", function (err, dbResult) {
                                        if (dbResult[0].count > 0) {
                                            dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                                                if (err) {
                                                    sendResp.sendCustomJSON(null, req, res, false, [], err.toString());
                                                } else {
                                                    if (dbResult == null || dbResult == undefined) {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                    } else if (dbResult.length == 0) {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                    } else if (dbResult[0].app_score_id) {
                                                        var query_leader_board = " update tbl_contest_leader_board set total_score = " + score + ",created_at=now()   " +
                                                            " where contest_id = " + contestId + " and player_id = " + playerId + " " +
                                                            "  and app_id = " + appId + " and total_score <  " + score + "  ";
                                                        console.log(query_leader_board)
                                                        dbConnection.executeQuery(query_leader_board, "rmg_db", function (err, dbResult) {
                                                            if (dbResult == null || dbResult == undefined) {
                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                            }
                                                            else {
                                                                sendResp.sendCustomJSON(null, req, res, true, [], "Score posted successfully!", true);
                                                            }
                                                        });
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                    }
                                                }
                                            })
                                        } else {
                                            sendResp.sendCustomJSON(err, req, res, false, [], "Contest Is not Valid to post score");
                                        }
                                    });
                                } else {
                                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid session Token!")
                                }

                            })

                        }
                    }
                })
            }
        } else {
            sendResp.sendCustomJSON(null, req, res, false, [], "Please send session Token!")
        }
    },

    postScore: function (req, res) {
        let score = req.body.score;
        console.log('score - ', score);
        let deviceId = req.body.deviceId;
        let playerId = req.body.playerId;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var sessionToken = req.headers["x-session-token"];
        var checkSum = req.headers["checksum"];

        var now = new Date();
        var md5checksum = md5(score) + '|' +
            md5(appSecretKey + "$" + sessionToken);

        var sha512Checksum = sha512(md5checksum);

        logger.info('-----CheckSUM | postScore-----\n' +
            'param1 -' + score + '\n' +
            'param2 - ' + appSecretKey + "$" + sessionToken + '\n' +
            'param3 - ' + dateformat(now, 'yyyy-mm-dd') + '\n' +
            'appSecretKey - ' + appSecretKey + '\n' +
            'authorization - ' + userToken + '\n' +
            'score - ' + score + '\n' +
            'md5checksum - ' + md5checksum + '\n' +
            'sha512Checksum - ' + sha512Checksum + '\n' +
            'checkSum - ' + checkSum);

        if (sha512Checksum != checkSum) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid checksum!")
        }
        else {
            if (sessionToken != null && sessionToken != undefined && sessionToken != "") {
                userModel.getUserDetails(userToken, function (err, userDetails) {
                    if (err) {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token!")
                    } else {
                        if (userDetails.playerId == "") {
                            sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token!")
                        } else {

                            playerId = userDetails.playerId;
                            validateToken(sessionToken).then(isSessionTokenDetails => {
                                if (isSessionTokenDetails != null && isSessionTokenDetails != undefined && isSessionTokenDetails.length > 0) {
                                    console.log(isSessionTokenDetails)
                                    var contestId = isSessionTokenDetails[0].contest_id;
                                    var appId = isSessionTokenDetails[0].app_id;
                                    var checkStatus = " select count(1) from vw_player_contest where contest_id = " + contestId + " and player_id = " + playerId + " and player_status = 'PLAY' "
                                    var query = "  INSERT INTO public.tbl_app_score (contest_id, player_id, app_id, score, status, created_at) " +
                                        "VALUES(" + contestId + ", " + playerId + ", " + appId + ", " + score + ", 'ACTIVE', now()) " +
                                        "RETURNING app_score_id ";
                                    console.log(query)
                                    dbConnection.executeQuery(checkStatus, "rmg_db", function (err, dbResult) {
                                        if (dbResult[0].count > 0) {
                                            dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                                                if (err) {
                                                    sendResp.sendCustomJSON(null, req, res, false, [], err.toString());
                                                } else {
                                                    if (dbResult == null || dbResult == undefined) {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                    } else if (dbResult.length == 0) {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                    } else if (dbResult[0].app_score_id) {
                                                        var query_leader_board = " update tbl_contest_leader_board set total_score = " + score + ",created_at=now()  " +
                                                            " where contest_id = " + contestId + " and player_id = " + playerId + " " +
                                                            "  and app_id = " + appId + " and total_score <  " + score + "  ";
                                                        console.log(query_leader_board)
                                                        dbConnection.executeQuery(query_leader_board, "rmg_db", function (err, dbResult) {
                                                            if (dbResult == null || dbResult == undefined) {
                                                                sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                            }
                                                            else {
                                                                sendResp.sendCustomJSON(null, req, res, true, [], "Score posted successfully!", true);
                                                            }
                                                        });
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                    }
                                                }
                                            })
                                        } else {
                                            sendResp.sendCustomJSON(err, req, res, false, [], "Contest Is not Valid to post score");
                                        }
                                    });
                                } else {
                                    sendResp.sendCustomJSON(null, req, res, false, [], "Invalid session Token!")
                                }

                            })

                        }
                    }
                })

            } else {
                sendResp.sendCustomJSON(null, req, res, false, [], "Please send session Token!")
            }
        }
    },

    checkToken: async function (req, res) {
        var token = req.params.token;
        try {
            if (token != "") {
                /*  let query = " select randnumber from tbl_app_score where session_token = '" +
                     token + "' and session_token_isvalid =true "; */

                let query = "select randnumber,game_conf from tbl_app_score inner join " +
                    " tbl_contest on tbl_contest.contest_id = tbl_app_score.contest_id " +
                    " and session_token = '" + token + "' and session_token_isvalid = true limit 1"

                let result = await dbConnection.executeQueryAll(query, 'rmg_db');
                console.log(result)
                if (result != undefined && result != null && result.length > 0) {
                    output = {
                        gc: result[0].game_conf ? result[0].game_conf : '',
                        rn: result[0].randnumber ? result[0].randnumber : ''
                    }
                    res.send(200, output);
                    //sendResp.sendResult(null, output,200, res,"Session Token Found!")
                } else {
                    //sendResp.sendResult(true, null,400, res,"Session Token Invalid!")
                    res.send(400, {});
                    //sendResp.sendCustomJSON(null, req, res, false, [], "Session Token Invalid!")
                }

            } else {
                // sendResp.sendResult(true, null,400, res,"Session Token Invalid!")
                res.send(400, {});
                //sendResp.sendCustomJSON(null, req, res, false, [], "Session Token Invalid!")
            }
        } catch (error) {
            console.log(error)
            //sendResp.sendResult(true, null,400, res,"Something got wrong!")
            res.send(400, {});
            //sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong!")
        }

    },

    postScoreNew: function (req, res) {
        let score = req.params.score;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var sessionToken = req.params.token;
        let app_idHeader = req.headers.app;
        let app_max_game_minute = req.headers.max_game_minute;
        console.log('app_max_game_minute ' + app_max_game_minute)
        if (appSecretKey != null && appSecretKey != undefined && appSecretKey != "" &&
            sessionToken != null && sessionToken != undefined && sessionToken != "") {
            validateToken(sessionToken, app_max_game_minute).then(isSessionTokenDetails => {
                if (isSessionTokenDetails != null && isSessionTokenDetails != undefined 
                    && isSessionTokenDetails.length > 0) {
                    console.log(isSessionTokenDetails)
                    var contestId = isSessionTokenDetails[0].contest_id;
                    var appId = isSessionTokenDetails[0].app_id;

                    if (app_idHeader != appId) {
                        console.log(' GameHead ---------------' + app_idHeader + '\n' +
                            ' Game ' + appId + '\n' +
                            'SessionToken ' + sessionToken)
                    }
                    if (app_idHeader == appId) {
                        var playerId = isSessionTokenDetails[0].player_id;

                        let scoreType = "valid";
                        gValidScores.forEach(app => {
                            if (app.app_id == appId) {
                                if (parseInt(score) >= parseInt(app.suspicious) &&
                                    parseInt(score) < parseInt(app.maximum)) {
                                    scoreType = "suspicious";
                                }
                                else if (parseInt(score) > parseInt(app.suspicious) &&
                                    parseInt(score) >= parseInt(app.maximum)) {
                                    scoreType = "fake";
                                }
                            }
                        });

                        if (scoreType != "fake") {
                            if (scoreType == "suspicious") {
                                let insertsuscpiciousscore = "insert into tbl_suspicious_scores(app_id,player_id,session_token,score,score_type) " +
                                    " values (" + appId + "," + playerId + ",'" + sessionToken + "'," + score + ",'" + scoreType + "')";
                                dbConnection.executeQuery(insertsuscpiciousscore, "rmg_db", function (err, dbResult) { });
                                let queryBlockUser = " update tbl_player set status = 'BLOCK' where player_id = " + playerId + "  ";
                                //dbConnection.executeQuery(queryBlockUser, "rmg_db", function (err, dbResultblock) { });
                            }
                            var checkStatus = " select count(1) from vw_player_contest where contest_id = " + contestId
                                + " and player_id = " + playerId + " and player_status = 'PLAY' "
                            var query = " update tbl_app_score set  score =  " + score + " , score_submit_date = now() where session_token = '" + sessionToken + "' " +
                                "RETURNING app_score_id ";
                            console.log(query);
                            dbConnection.executeQuery(checkStatus, "rmg_db", function (err, dbResult) {
                                if (dbResult[0].count > 0) {
                                    dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
                                        if (err) {
                                            sendResp.sendCustomJSON(null, req, res, false, [], err.toString());
                                        } else {
                                            if (dbResult == null || dbResult == undefined) {
                                                sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                            } else if (dbResult.length == 0) {
                                                sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                            } else if (dbResult[0].app_score_id) {
                                                var query_leader_board = " update tbl_contest_leader_board set total_score = " + score + ",created_at=now()   " +
                                                    " where contest_id = " + contestId + " and player_id = " + playerId + " " +
                                                    "  and app_id = " + appId + " and total_score <  " + score + "  ";
                                                // let updateUsedLives = `update tbl_contest_players set used_lives = 
                                                //             COALESCE( used_lives ,0) + 1  where contest_id = ${contestId} and 
                                                //             player_id = ${playerId} `;
                                                 console.log('query_leader_board: ' + query_leader_board);
                                                // dbConnection.executeQuery(updateUsedLives, "rmg_db", function (err, dbResult) { });
                                                dbConnection.executeQuery(query_leader_board, "rmg_db", function (err, dbResult) {
                                                    if (dbResult == null || dbResult == undefined) {
                                                        sendResp.sendResultShort(400, 1000, res);
                                                        //sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                                    }
                                                    else {
                                                        sendResp.sendResultShort(200, 200, res);
                                                        // sendResp.sendCustomJSON(null, req, res, true, [], "Score posted successfully!", true);
                                                    }
                                                });
                                            } else {
                                                sendResp.sendResultShort(400, 1000, res);
                                                //sendResp.sendCustomJSON(null, req, res, false, [], "Unable to post score. Please try again!");
                                            }
                                        }
                                    })
                                } else {
                                    sendResp.sendResultShort(400, 1001, res);
                                    //sendResp.sendCustomJSON(err, req, res, false, [], "Contest Is not Valid to post score");
                                }
                            });
                        } else {
                            let insertFakescore = "insert into tbl_suspicious_scores(app_id,player_id,session_token,score,score_type) " +
                                " values (" + appId + "," + playerId + ",'" + sessionToken + "'," + score + ",'" + scoreType + "')";
                            let queryBlockUser = " update tbl_player set status = 'BLOCK' where player_id = " + playerId + "  ";
                            let blockDevice = `insert into tbl_player_block_device (device_id,blocked_at,reason) 
                            select distinct device.device_id,now(),'Found Playing with GameGuardian' from tbl_player player
                            inner join tbl_player_device device on player.player_id = device.player_id 
                             where player.player_id = ${playerId}`;
                            let blockAllNumberFromThisPlayer = ` update tbl_player set status = 'BLOCK' where player_id in (
                                         select distinct playerDetail.player_id from tbl_player playerDetail 
                                         inner join tbl_player_device deviceDetail
                                         on playerDetail.player_id = deviceDetail.player_id
                                         where device_id in ( 
                                         select device.device_id from tbl_player player
                                         inner join tbl_player_device device
                                         on player.player_id = device.player_id
                                         where player.player_id = ${playerId} )) `;
                            // dbConnection.executeQuery(queryBlockUser, "rmg_db", function (err, dbResultblock) { });
                            // dbConnection.executeQuery(blockDevice, "rmg_db", function (err, dbResultblock) { });
                            // dbConnection.executeQuery(blockAllNumberFromThisPlayer, "rmg_db", function (err, dbResultblock) { });
                            dbConnection.executeQuery(insertFakescore, "rmg_db", function (err, dbResult) {
                                sendResp.sendResultShort(400, 1002, res);
                            });
                        }
                    } else {
                        sendResp.sendResultShort(400, 1002, res);
                    }
                } else {
                    sendResp.sendResultShort(400, 1002, res);
                    //sendResp.sendCustomJSON(null, req, res, false, [], "Invalid session Token!")
                }
            })
        } else {
            sendResp.sendResultShort(400, 1003, res);
            //sendResp.sendCustomJSON(null, req, res, false, [], "Please send session Token!")
        }
    },

    cheatApi: async function (req, res) {
        var cheatToken = req.params.token;

        try {
            var checkQuery = "select * from tbl_app_score where session_token = '" + cheatToken + "' ";
            var response = await dbConnection.executeQueryAll(checkQuery, "rmg_db");
            console.log(response)
            if (response != undefined && response != null && response.length > 0) {
                var query = "insert into tbl_cheat (cheat_id,session_token) values( unique_rowid() ,'" + cheatToken + "')";
                console.log(query)
                var response = await dbConnection.executeQueryAll(query, "rmg_db");
                res.send(200, 'ok')
            } else {
                res.send(400, 'NOK')
            }
        } catch (error) {
            res.send(400, 'NOK')
        }
    },

    getLeaderboard: async function (req, res) {
        sessionToken = req.params.token;
        try {
            var checkQuery = "select contest_id,player_id,score from tbl_app_score where session_token = '" + sessionToken + "' ";
            var response = await dbConnection.executeQueryAll(checkQuery, "rmg_db");
            console.log(response)
            if (response != undefined && response != null && response.length > 0) {
                let contestId = response[0].contest_id;
                let playerId = response[0].player_id;
                let currentScore = response[0].score;
                let contestDetails = "select * from vw_apps_contests where contest_id = " + contestId;
                let winnerDetails = ` select * from vw_last7days_winner  where  contest_id = ${contestId} ; `;
                let contestRankquery = ` select * from tbl_contest_rank  where contest_id = ${contestId} order by upper_rank asc; `;
                let livesCheckQuery = `select COALESCE( used_lives ,0) as  used_lives from 
                            tbl_contest_players where contest_id =  ${contestId} and player_id = ${playerId}  `;
                async.parallel({
                    contestDetails: function (callback) {
                        dbConnection.executeQuery(contestDetails, "rmg_db", function (err, dbResult) {
                            callback(err, dbResult);
                        });
                    },
                    winnerDetails: function (callback) {
                        dbConnection.executeQuery(winnerDetails, "rmg_db", function (err, dbResult) {
                            callback(err, dbResult);
                        });
                    },
                    contestRankquery: function (callback) {
                        dbConnection.executeQuery(contestRankquery, "rmg_db", function (err, dbResult) {
                            callback(err, dbResult);
                        });
                    },
                    livesCheck: function (callback) {
                        dbConnection.executeQuery(livesCheckQuery, "rmg_db", function (err, dbResult) {
                            callback(err, dbResult);
                        });
                    }
                },
                    function (err_async, result_async) {
                        //console.log(err_async)
                        if (err_async) {
                            sendResp.sendCustomJSON(err_async, req, res, false, [], "Something got wrong")
                        } else {
                            var contestdetails = result_async.contestDetails;
                            var winnerDetails = result_async.winnerDetails;
                            var rankDetails = result_async.contestRankquery;
                            let livesCheck = result_async.livesCheck;
                            var outJson = {};


                            var currenttime = new Date(contestdetails[0].currenttime);
                            var conteststarttime = new Date(contestdetails[0].start_date);
                            var contestendtime = new Date(contestdetails[0].end_date);

                            var remainingstartseconds = (conteststarttime.getTime() - currenttime.getTime()) / 1000;
                            var remainingendseconds = (contestendtime.getTime() - currenttime.getTime()) / 1000;
                            let max_lives = contestdetails[0].max_lives;

                            contestdetails[0].remainingstartseconds = remainingstartseconds;
                            contestdetails[0].remainingendseconds = remainingendseconds;



                            contestdetails[0].contest_rank = [];
                            rankDetails.forEach(contestRank => {
                                if (contestRank.contest_id == contestdetails[0].contest_id) {
                                    let rank = {}
                                    rank.contest_rank_id = contestRank.contest_rank_id;
                                    rank.rank_name = contestRank.rank_name;
                                    rank.rank_desc = contestRank.rank_desc;
                                    rank.lower_rank = contestRank.lower_rank;
                                    rank.upper_rank = contestRank.upper_rank;
                                    rank.prize_amount = contestRank.prize_amount;
                                    rank.credit_type = contestRank.credit_type;
                                    contestdetails[0].contest_rank.push(rank);
                                }
                            });

                            contestdetails[0].used_lives = livesCheck[0].used_lives;
                            if (contestdetails[0].live_status == true) {
                                if (max_lives != 0 && livesCheck[0].used_lives >= max_lives) {
                                    contestdetails[0].live_status == false;
                                    contestdetails[0].play_status = "GAMEOVER";
                                } else {
                                    contestdetails[0].play_status = "PLAY";
                                }
                            } else {
                                contestdetails[0].play_status = "CONTESTEND";
                            }

                            outJson.ContestDetails = contestdetails[0];
                            outJson.PlayerRank = {};
                            outJson.PreviousRank = {};
                            outJson.NextRank = {};
                            outJson.Winners = [];
                            outJson.CurrentScore = currentScore;
                            var playerRankNo = 0;

                            winnerDetails.forEach(players => {
                                if (players.player_id == playerId) {
                                    outJson.PlayerRank = players;
                                    outJson.PlayerRank.winPrize = 0;
                                    playerRankNo = parseInt(players.player_rank);
                                }
                                rankDetails.forEach(contestRank => {
                                    if (contestRank.contest_id == contestdetails[0].contest_id &&
                                        parseInt(players.player_rank) >= parseInt(contestRank.lower_rank) &&
                                        parseInt(players.player_rank) <= parseInt(contestRank.upper_rank)) {
                                        if (players.player_id == playerId) {
                                            outJson.PlayerRank.winPrize = contestRank.prize_amount;
                                            outJson.PlayerRank.credit_type = contestRank.credit_type;
                                            //players.winPrize = contestRank.prize_amount;
                                            if (parseFloat(players.total_score) > 0) {
                                                players.winPrize = contestRank.prize_amount;
                                            } else {
                                                players.winPrize = 0;
                                            }
                                            players.credit_type = contestRank.credit_type;
                                        } else {
                                            players.winPrize = contestRank.prize_amount;
                                            players.credit_type = contestRank.credit_type;
                                        }
                                    }
                                });
                                if (parseFloat(players.total_score) > 0) {
                                    outJson.Winners.push(players);
                                }
                            });
                            var NextRank = playerRankNo + 1;
                            var PrevRank = playerRankNo - 1;
                            winnerDetails.forEach(element => {

                                if (element.player_id != playerId) {
                                    if (NextRank == element.player_rank &&
                                        parseFloat(element.total_score) > 0) {
                                        outJson.NextRank = element;
                                        outJson.NextRank.winPrize = 0;
                                        rankDetails.forEach(contestRank => {
                                            if (contestRank.contest_id == contestdetails[0].contest_id &&
                                                parseInt(NextRank) >= parseInt(contestRank.lower_rank) &&
                                                parseInt(NextRank) <= parseInt(contestRank.upper_rank)) {
                                                outJson.NextRank.winPrize = contestRank.prize_amount;
                                                outJson.NextRank.credit_type = contestRank.credit_type;
                                            }
                                        });
                                    } else if (PrevRank == element.player_rank && parseFloat(element.total_score) > 0) {
                                        outJson.PreviousRank = element;
                                        outJson.PreviousRank.winPrize = 0;
                                        rankDetails.forEach(contestRank => {
                                            if (contestRank.contest_id == contestdetails[0].contest_id &&
                                                parseInt(PrevRank) >= parseInt(contestRank.lower_rank) &&
                                                parseInt(PrevRank) <= parseInt(contestRank.upper_rank)) {
                                                outJson.PreviousRank.winPrize = contestRank.prize_amount;
                                                outJson.PreviousRank.credit_type = contestRank.credit_type;
                                            }
                                        });
                                    }
                                }
                            });
                            sendResp.sendCustomJSON(null, req, res, true, outJson, "Contest Details");
                            scoreUpdown(contestId, winnerDetails, function () { });
                        }

                    });

            } else {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token!")
            }
        } catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something Got wrong!")
        }
    },

    getSessionToken: async function (req, res) {

        console.log('getSessionToken params - ', req.params)
        console.log('getSessionToken headers - ', req.headers)

        let appSecretKey = req.headers["x-nazara-app-secret-key"];
        let userToken = req.headers["authorization"];
        let contestId = req.params.contestid;

        try {
            let chkOldToken = "select * from tbl_app_score where session_token_isvalid = true and contest_id =  " + contestId;
            let query = "select * from vw_player_live_contests where contest_id = " + contestId + " ";

            let userDetails = await userModel.getUserDetailPromise(userToken);
            console.log('getSessionToken userDetails - ', userDetails);

            if (userDetails.playerId != "") {
                let player_id = userDetails.playerId;

                console.log('vw_player_live_contests - ', query);

                let result = await dbConnection.executeQueryAll(query, 'rmg_db');

                if (result != null && result != undefined && result.length > 0) {

                    let appId = result[0].app_id;
                    let sessionToken = null;
                    let randomNumber = (Math.floor(Math.random() * 90000) + 1);

                    chkOldToken = chkOldToken + " and player_id = " + player_id + " limit 1";
                    console.log('chkOldToken - ', chkOldToken);

                    let ifOldTokenAvailable = await dbConnection.executeQueryAll(chkOldToken, 'rmg_db');
                    if (ifOldTokenAvailable != null && ifOldTokenAvailable != undefined && ifOldTokenAvailable.length > 0) {
                        sessionToken = ifOldTokenAvailable[0].session_token;
                        sendResp.sendCustomJSON(null, req, res, true, { sessionToken: sessionToken }, "Session Token Generated!");
                    } else {
                        sessionToken = tokgen2.generate();
                        let isTokenSave = insertIntoScore(contestId, player_id, appId, 0, sessionToken, randomNumber);
                        if (isTokenSave) {
                            sendResp.sendCustomJSON(null, req, res, true, { sessionToken: sessionToken }, "Session Token Generated!");
                        } else {
                            sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong!");
                        }
                    }
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "ContestId Not Valid!");
                }
            } else {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token Token!");
            }
        } catch (error) {
            console.log('getSessionToken err - ', error);
            sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong!");
        }
    },

    getUserDetailsSessionToken: async function (req, res) {
        try {
            let sessionToken = req.params.token;
            let query = "select * from vw_getPlayerInfo_PlayToken " +
                " where session_token = '" + sessionToken + "'";
            console.log(query)
            let result = await dbConnection.executeQueryAll(query, 'rmg_db');
            if (result != null && result != undefined && result.length > 0) {
                var response = [{
                    playerId: result[0].playerid,
                    deviceId: result[0].deviceid,
                    appId: result[0].appid,
                    airpayToken: result[0].airpaytoken,
                    airpayConsumerId: result[0].airpayconsumerid,
                    token: result[0].token,
                    fullName: result[0].fullname,
                    firstName: result[0].firstname,
                    lastName: result[0].lastname,
                    isGuest: result[0].isguest,
                    photo: result[0].photo,
                    emailId: result[0].emailid,
                    emailVerified: result[0].emailverified,
                    mobile: result[0].mobile,
                    mobileVerified: result[0].mobileverified,
                    facebookId: result[0].facebookid,
                    googleId: result[0].googleid,
                    status: result[0].status,
                    source: result[0].source
                }]
                sendResp.sendCustomJSON(null, req, res, true, response, "User Details Found!");
            } else {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token Token!");
            }
        } catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, [], "Something Got Wrong!");
        }
    },

    getPlayerInfoFromToken: async function (req, res) {
        var token = req.params.token;
        try {
            if (token != "") {
                /*  let query = " select randnumber from tbl_app_score where session_token = '" +
                     token + "' and session_token_isvalid =true "; */
                // let query = `select  case when (tbl_player.full_name is null) 
                //      or (tbl_player.full_name = '') then replace(tbl_player.phone_number, 
                //      substring(tbl_player.phone_number, 5, 6), 'XXXXXX') 
                //      else tbl_player.full_name  end as username, 
                //      photo as imageUrl, tbl_player.google_id, tbl_player.player_id ,
                //      tbl_player.facebook_id ,tbl_app_score.randnumber 
                //      from tbl_app_score inner join tbl_player 
                //      on tbl_player.player_id = tbl_app_score.player_id 
                //      and tbl_app_score.session_token = '${token}' `;

                let query = `select  case when (tbl_player.full_name is null) 
                     or (tbl_player.full_name = '') then replace(tbl_player.phone_number, 
                     substring(tbl_player.phone_number, 5, 6), 'XXXXXX') 
                     else tbl_player.full_name  end as username, 
                     photo as imageUrl, tbl_player.google_id, tbl_player.player_id ,
                     tbl_player.facebook_id ,tbl_app_score.randnumber,tbl_app_score.contest_id ,
                     coalesce(tbl_contest.max_lives,0) as max_lives,tbl_contest_players.used_lives
                     from tbl_app_score inner join tbl_player 		    
                     on tbl_player.player_id = tbl_app_score.player_id 
                     and tbl_app_score.session_token = '${token}'
		            inner join tbl_contest on tbl_contest.contest_id = tbl_app_score.contest_id   	
		            inner join tbl_contest_players on tbl_contest.contest_id = tbl_contest_players.contest_id and
		            tbl_contest_players.player_id = tbl_player.player_id`

                let result = await dbConnection.executeQueryAll(query, 'rmg_db');
                console.log(result)
                if (result != undefined && result != null && result.length > 0) {
                    output = {
                        gc: result[0].game_conf ? result[0].game_conf : '',
                        rn: result[0].randnumber ? result[0].randnumber : '',
                        player_id: result[0].player_id ? result[0].player_id : 0,
                        max_lives: result[0].max_lives ? result[0].max_lives : 0,
                        used_lives: result[0].used_lives ? result[0].used_lives : 0,
                    }
                    res.send(200, output);
                } else {
                    res.send(400, {});
                }
            } else {
                res.send(400, {});
            }
        } catch (error) {
            console.log(error)
            res.send(400, {});
        }
    },

    getFeedback: async (req, res) => {

        var topic = req.body.topic;
        var details = req.body.details;

        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];

        userModel.getUserDetails(userToken, function (err, userDetails) {
            if (err) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
            } else {

                playerId = userDetails.playerId;
                console.log('playerId|' + playerId + "|")

                if (playerId) {

                    queryText = `INSERT INTO tbl_feedback (player_id, topic, details, created_at, status) values (${playerId},'${topic}','${details}',NOW(),'PENDING') RETURNING *`;

                    console.log('queryText', queryText)

                    dbConnection.executeQuery(queryText, "rmg_db", function (err, dbResult) {

                        console.log('err', err);
                        console.log(dbResult);

                        if (err) {
                            sendResp.sendCustomJSON(null, req, res, false, [], err, false, false);
                        } else {

                            sendResp.sendCustomJSON(null, req, res, true, dbResult, "Feedback Submitted!")
                        }
                    })

                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
                }

            }

        })
    },

    getBanners: async (req, res) => {
        let channel = req.query.channel;
        let banners = [];

        console.log(channel)
        if (channel != null && channel != undefined && channel != "") {
            gBanners.forEach(banner => {

                if (banner.channel != null && banner.channel != undefined && banner.channel != "") {
                    console.log(banner.channel.toUpperCase() + "|" + channel.toUpperCase())
                    if (banner.channel.toUpperCase() == channel.toUpperCase()) {
                        banners.push(banner);
                    } else if (banner.channel.toUpperCase() == channel.toUpperCase()) {
                        banners.push(banner);
                    }
                } else {
                    banners.push(banner);
                }
            });
            sendResp.sendCustomJSON(null, req, res, true, banners, "Banners")
        } else {
            gBanners.forEach(banner => {
                console.log(banner.channel)
                if (banner.channel == null || banner.channel == "") {
                    banners.push(banner);
                }
            });
            sendResp.sendCustomJSON(null, req, res, true, banners, "Banners")
        }
    },

    checkVersion: async (req, res) => {

        let appId = req.query.appId ? req.query.appId : "";
        let channel = req.query.channel ? req.query.channel : "";
        let currVersion = req.query.currVersion;
        if (currVersion != undefined && currVersion != "" && currVersion == "1.0.10") {
            //playtore version update
            sendResp.sendCustomJSON(null, req, res, false, null, "Version Details not available!")
        } else {
            if (appId && channel) {

                let query = "select * from tbl_app_version where app_id = " + appId
                    + " and channel = '" + channel + "' order by replace(new_version, '.', '')::int desc limit 1";

                var result = await dbConnection.executeQueryAll(query, "rmg_db");
                if (result) {
                    if (result[0]) {
                        sendResp.sendCustomJSON(null, req, res, true, result, "Version Details found!");
                    }
                    else {
                        sendResp.sendCustomJSON(null, req, res, false, null, "Version Details not available!")
                    }
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, null, "Version Details not available!")
                }
            }
            else {
                sendResp.sendCustomJSON(null, req, res, false, null, "Please provide appId and channel parameters.")
            }
        }

    },

    redumptionMaster: async (req, res) => {
        let query = "select * from tbl_recharge_master ";

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("app details - ", JSON.stringify(dbResult));
            sendResp.sendCustomJSON(null, req, res, true, dbResult, "App List")
        })
    },

    topGameWinnerList: (req, res) => {
        console.log(gTopGameWinners.length)
        if (gTopGameWinners.length > 0) {
            sendResp.sendCustomJSON(null, req, res, true, gTopGameWinners, "Winner List");
        } else {
            sendResp.sendCustomJSON(null, req, res, true, [], "No Data Found");
        }
    },

    getEvents: (req, res) => {
        let event_detail = {};
        if (gEventMaster != undefined && gEventMaster != null) {
            gEventMaster.forEach(event => {
                if (event.event_type == 'register_new') {
                    event_detail = event;
                }
            });
            sendResp.sendCustomJSON(null, req, res, true, event_detail, "Event Details!");
        } else {
            sendResp.sendCustomJSON(null, req, res, false, [], "Event Not Found!");
        }
    },

    getAllEvents: (req, res) => {
        sendResp.sendCustomJSON(null, req, res, true, gEventMaster, "Event Details!");
    },

    getdepositeCount: (req, res) => {
        var userToken = req.headers["authorization"];
        userModel.getUserDetails(userToken, async function (err, userDetails) {
            if (err || userDetails.playerId == '') {
                sendResp.sendCustomJSON(null, req, res, false, [], "Token Is Invalid", false, false);
            } else {
                console.log(userDetails)
                playerId = userDetails.playerId;

                let depositeCount = " select count(1) from tbl_wallet_transaction " +
                    " where player_id =  " + playerId + " and " +
                    " nz_txn_status = 'SUCCESS' " +
                    " and nz_txn_type = 'DEPOSIT'; ";
                console.log(depositeCount)
                var result = await dbConnection.executeQueryAll(depositeCount, "rmg_db");
                sendResp.sendCustomJSON(null, req, res, true, result, "Deposite Counts!");
            }
        });

    },

    contestoftheday: async (req, res) => {

        var playerId = req.body.playerId;
        var contestId = req.body.contestId;
        var appId = req.body.appId;
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        var userToken = req.headers["authorization"];
        var checkSum = req.headers["checksum"];
        var isPlaystoreApp = req.body.isPlaystoreApp;
        var isPlaystore = req.body.isPlaystore;
        var platform = req.body.platform;
        var channel = req.body.channel;
        var hideapk = req.body.hideapk;
        var api_source = req.body.api_source;

        if (appId == null || appId == undefined) {
            appId = '';
        }
        if (isPlaystoreApp == null || isPlaystoreApp == undefined) {
            isPlaystoreApp = false;
        }
        if (platform == null || platform == undefined) {
            platform = '';
        }
        if (contestId == null || contestId == undefined) {
            contestId = '';
        }
        userModel.getUserDetails(userToken, function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            let sendOutContest =[];
            let contestRankquery = " select * from vw_Upcoming_rankDetails where 1=1 ";
            var contestquery = "select * from vw_apps_upcoming_contests_new where 1=1";
            let playerquery = ` select * from vw_playerjoined where player_id = ${playerId} `

            if (process.env.NODE_ENV == "preprod") {
                contestquery = "select * from  vw_apps_upcoming_contests_preprod where 1=1";
            }

            if (contestId != null && contestId != "" && contestId != undefined && contestId != "undefined") {
                contestId = contestId.toString();
                contestquery = contestquery + " and contest_id = " + contestId;
                contestRankquery = contestRankquery + " and contest_id = " + contestId;
            }
            if (isPlaystore != null && isPlaystore != "" && isPlaystore != undefined && isPlaystore != "undefined") {
                contestquery = contestquery + " and debit_type = 'COIN' ";
            }
            if (appId != null && appId != "" && appId != undefined && appId != "undefined") {
                contestquery = contestquery + " and app_id = " + appId;
            }
            if (playerId != null && playerId != "" && playerId != undefined && playerId != "undefined") {
                // playerquery = playerquery + " and player_id = " + playerId;
            } else {
                playerquery = "select now()";
            }

            //console.log(playerquery)
            //contestquery = contestquery + " order by  app_priority,contest_priority";
            //console.log(contestquery)
            async.parallel({
                contestquery: function (callback) {
                    dbConnection.executeQuery(contestquery, "rmg_db", function (err, dbResult) {
                        callback(err, dbResult);
                    }, true, 40);
                },
                playerquery: function (callback) {
                    dbConnection.executeQuery(playerquery, "rmg_db", function (err, dbResult) {
                        callback(err, dbResult);
                    });
                }
            },
                function (err_async, result_async) {
                    var ContestOut = result_async.contestquery;
                    //console.log(result_async.playerquery)
                    var PlayerContests = [];
                    if (playerId != null && playerId != "" && playerId != undefined && playerId != "undefined") {
                        PlayerContests = result_async.playerquery;
                    }
                    var distinctApps = [];
                    if (ContestOut != undefined) {
                        let splContestCt = 0;
                        ContestOut.forEach(contests => {
                            if (contests.css_class != null
                                && contests.css_class.toLowerCase().indexOf('special') > -1
                                && contests.live_status == true) {
                                    splContestCt = splContestCt+1;
                            }
                        });

                        ContestOut.forEach(element => {
                            let isnew = true;
                            distinctApps.forEach(distinctElement => {
                                if (distinctElement.app_id == element.app_id) {
                                    isnew = false;
                                }
                            });
                            if (isnew) {
                                let app = {};
                                app.app_id = element.app_id;
                                app.app_name = element.app_name;
                                app.app_type = element.app_type;
                                app.app_code = element.app_code;
                                app.app_icon = element.app_icon;
                                if (element.app_icon_url != undefined && element.app_icon_url != null) {
                                    app.app_icon_url = element.app_icon_url;
                                } else {
                                    app.app_icon_url = "";
                                }
                                app.app_secret = element.app_secret;
                                app.app_status = element.app_status;
                                app.package_name = element.package_name;
                                app.download_path = config.api_url + "app/v1/filedownload?appid=" + element.app_id;
                                app.download_file = config.api_url + element.filename;

                                app.contests = [];

                                //console.log("app.download_path", app.download_path);
                               

                                ContestOut.forEach(contests => {
                                    if (contests.app_id == element.app_id) {
                                        let contest = {}
                                        if (contests.css_class != null && contests.css_class.toLowerCase().indexOf('special') > -1 && contests.live_status == true) {
                                            contest.contest_id = contests.contest_id;
                                            contest.contest_name = contests.contest_name;
                                            contest.contest_desc = contests.contest_desc;
                                            contest.start_date_actual = contests.start_date_actual;
                                            contest.end_date_actual = contests.end_date_actual;
                                            contest.start_date = contests.start_date;
                                            contest.end_date = contests.end_date;
                                            contest.from_time = contests.from_time;
                                            contest.to_time = contests.to_time;
                                            contest.package_name = contests.package_name;
                                            contest.max_players = contests.max_players;
                                            contest.winners = contests.winners;
                                            contest.currency = contests.currency;
                                            contest.debit_type = contests.debit_type;
                                            contest.credit_type = contests.credit_type;
                                            contest.entry_fee = contests.entry_fee;
                                            contest.profit_margin = contests.profit_margin;
                                            contest.cash_margin = 0;//contests.cash_margin;
                                            contest.total_amount = contests.total_amount;
                                            contest.win_amount = contests.win_amount;
                                            contest.css_class = contests.css_class;
                                            contest.win_amount = contests.win_amount;
                                            contest.contest_status = contests.contest_status;
                                            contest.currenttime = contests.currenttime;
                                            contest.min_players = contests.min_player;
                                            contest.max_lives = contests.max_lives;
                                            contest.rank_desc = contests.rank_desc;
                                            contest.contest_minutes = contests.contest_minutes;
                                            contest.infinite_users = contests.infinite_users;
                                            contest.matrix_code = contests.matrix_code;
                                            if (contests.contest_icon != undefined && contests.contest_icon != null) {
                                                contest.contest_icon = contests.contest_icon;
                                            } else {
                                                contest.contest_icon = "";
                                            }
                                            let publish_type = contests.publish_type;
                                            let contest_channel = contests.channel;

                                            var currenttime = new Date(contest.currenttime);
                                            var conteststarttime = new Date(contest.start_date_actual);
                                            var contestendtime = new Date(contest.end_date_actual);

                                            var remainingstartseconds = (conteststarttime.getTime() - currenttime.getTime()) / 1000;
                                            var remainingendseconds = (contestendtime.getTime() - currenttime.getTime()) / 1000;

                                            contest.remainingstartseconds = remainingstartseconds;
                                            contest.remainingendseconds = remainingendseconds;

                                            contest.contest_rank = [];
                                            g15daysRankDetails.forEach(contestRank => {
                                                if (contestRank.contest_id == contest.contest_id) {
                                                    let rank = {}
                                                    rank.contest_rank_id = contestRank.contest_rank_id;
                                                    rank.rank_name = contestRank.rank_name;
                                                    rank.rank_desc = contestRank.rank_desc;
                                                    rank.lower_rank = contestRank.lower_rank;
                                                    rank.upper_rank = contestRank.upper_rank;
                                                    rank.credit_type = contestRank.credit_type;
                                                    rank.prize_amount = contestRank.prize_amount;
                                                    contest.contest_rank.push(rank);
                                                }
                                            });

                                            contest.player_joined = contests.player_joined;
                                            contest.live_status = contests.live_status;
                                            contest.play_status = 'JOIN';
                                            contest.used_lives = 0;
                                            //console.log(contest.player_joined +"|"+ contest.max_players)
                                            if (parseInt(contest.player_joined) >= parseInt(contest.max_players)) {
                                                contest.play_status = 'FULL';
                                                contest.player_joined = contest.max_players;
                                                //console.log('ISFULL')
                                            }

                                            if (remainingendseconds < 300 && contest.play_status != 'FULL' && contest.play_status != 'JOINED') {
                                                contest.play_status = 'ENTRY-CLOSED';
                                            }

                                            if (playerId != undefined && playerId != null && playerId != '') {
                                                PlayerContests.forEach(contestplayer => {
                                                    if (contestplayer.contest_id == contest.contest_id) {
                                                        contest.play_status = contestplayer.player_status;
                                                        contest.used_lives = contestplayer.used_lives;
                                                    }
                                                });
                                            }

                                            if (contest_channel != "" && contest_channel != null && contest_channel != undefined) {
                                                if (channel.toUpperCase() == "PLAYSTORE" && contest_channel.toUpperCase() == "PLAYSTORE") {
                                                    if (contest.contest_minutes > 0 && contest.play_status == 'FULL') {
                                                    } else {
                                                        app.contests.push(contest);
                                                    }
                                                }
                                                else if (channel.toUpperCase() == "NON-PLAYSTORE" && contest_channel.toUpperCase() == "NON-PLAYSTORE") {
                                                    if (contest.contest_minutes > 0 && contest.play_status == 'FULL') {
                                                    } else {
                                                        app.contests.push(contest);
                                                    }
                                                }
                                            } else {
                                                if (contest.contest_minutes > 0 && contest.play_status == 'FULL') {
                                                } else {
                                                    app.contests.push(contest);
                                                }
                                            }
                                        }
                                    }
                                });
                                if (app.contests.length > 0) {
                                    if (isPlaystoreApp || hideapk == true) {
                                        if (app.app_type.toLowerCase() != 'android') {
                                            distinctApps.push(app);
                                        }
                                    } else {
                                        if (platform.toLowerCase() != 'ios') {
                                            distinctApps.push(app);
                                        } else {
                                            if (app.app_type.toLowerCase() != 'android') {
                                                distinctApps.push(app);
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                    if(distinctApps.length > 1){
                        console.log(distinctApps.length);
                       let randomNumber = Math.floor(Math.random() * distinctApps.length-1) + 1 ;
                      console.log('Random Number -'+randomNumber)
                      console.log('count-'+distinctApps.length)
                       sendOutContest.push(distinctApps[randomNumber]);
                       
                    }
                    sendResp.sendCustomJSON(null, req, res, true, sendOutContest, "App List")
                });
        });
    },

    showConversionPopup: async (req, res) => {
        var userToken = req.headers["authorization"];
        userModel.getUserDetails(userToken, async function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            if (playerId == "") {
                sendResp.sendCustomJSON(null, req, res, false, [], "Invalid Token");
            } else {
                let query = `select * from tbl_bonus_transfer where player_id = ${playerId} and popup_shown =false `;
                var result = await dbConnection.executeQueryAll(query, "rmg_db");
                if (result != null && result != undefined && result.length > 0) {
                    let query = `update tbl_bonus_transfer  set popup_shown = true , popup_shown_at =now() where player_id = ${playerId} `;
                    let updateResult = await dbConnection.executeQueryAll(query, "rmg_db");
                    sendResp.sendCustomJSON(null, req, res, true, result, "Popup Details");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Nothing To Show");
                }
            }
        });
    },

    topwinnersContest: async (req, res) => {
        let contest_id = req.body.contestId;
        if(contest_id!= undefined && contest_id !=null){
      
        let query = `  select tbl_contest_leader_board.total_score, tbl_player.player_id,CASE
                        WHEN tbl_player.full_name IS NULL OR tbl_player.full_name = ''::text 
                         THEN replace(tbl_player.phone_number, "substring"(tbl_player.phone_number, 
                          5, 6), 'XXXXXX'::text)
                         ELSE tbl_player.full_name
                        END AS player_name,
                        tbl_player.photo
                        from tbl_contest_leader_board  
                        inner join tbl_player on tbl_player.player_id = 
                        tbl_contest_leader_board.player_id where  
                        contest_id =  ${contest_id} and 
                        total_score > 0 order by 
                        tbl_contest_leader_board.total_score  desc,
                        tbl_contest_leader_board.created_at asc   
                        limit 3 `;

                    console.log(query)
        var result = await dbConnection.executeQueryAll(query, "rmg_db");
        if (result != null && result != undefined && result.length != 0 &&  result.length ==3) {
            sendResp.sendCustomJSON(null, req, res, true, result, "Top 3 winners");
        }else{
            sendResp.sendCustomJSON(null, req, res, false, [], "Nothing To Show");
        }
    }else{
        sendResp.sendCustomJSON(null, req, res, false, [], "Contest_id mandatory");
    }
    }
}

async function insertIntoScore(contest_id, player_id, app_id, score, session_token, randomNumber) {
    try {
        let query = "INSERT INTO public.tbl_app_score " +
            " ( contest_id, player_id, app_id, score, status, created_at,session_token,randNumber,session_token_isvalid) " +
            " VALUES(" + contest_id + ", " + player_id + ", " + app_id
            + "," + score + ", 'ACTIVE', now(),'" + session_token + "'," + randomNumber
            + ",true) RETURNING session_token ;";
        console.log(query)

        var result = await dbConnection.executeQueryAll(query, "rmg_db");
        if (result != null && result != undefined && result.length != 0) {
            return true;
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

async function validateSessionToken(token, contestId, appId, playerId) {
    appId = appId.trim()
    try {
        let query = " update tbl_app_score set session_token_isvalid = false " +
            " where session_token = '" + token + "' and (created_at + (20 * interval '1 minute')) > now() " +
            " and session_token_isvalid = true RETURNING session_token, contest_id,app_id ,player_id ;";
        var result = await dbConnection.executeQueryAll(query, "rmg_db");
        if (result != null && result != undefined && result.length != 0) {
            // console.log("|" + result[0].contest_id + "|" + contestId + "|" + result[0].app_id + "|" + appId + "|")
            // console.log("|" + appId + "|")
            // console.log("|" + result[0].player_id + "|" + playerId + "|")
            if (result[0].contest_id == contestId && result[0].app_id == appId && result[0].player_id == playerId) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    } catch (err) {
        return false;
    }
}

async function validateToken(token, app_max_game_minute) {
    let query = "";
    try {
        if (app_max_game_minute != undefined && app_max_game_minute != null && app_max_game_minute != "" && app_max_game_minute != 0) {
            query = " update tbl_app_score set session_token_isvalid = false " +
                " where session_token = '" + token + "' " +
                " and session_token_isvalid = true  " +
                " and (created_at + (" + app_max_game_minute + " * interval '1 minute')) > now() " +
                " RETURNING session_token, contest_id,app_id ,player_id ;";
        } else {
            query = " update tbl_app_score set session_token_isvalid = false " +
                " where session_token = '" + token + "' " +
                " and session_token_isvalid = true " +
                " RETURNING session_token, contest_id,app_id ,player_id ;";
        }

        console.log('validateToken QUERY - ', query);

        var result = await dbConnection.executeQueryAll(query, "rmg_db");
        if (result != null && result != undefined && result.length != 0) {
            return result
        } else {
            return [];
        }
    } catch (err) {
        return [];
    }
}

function scoreUpdown(contest_id, winnerList, callback) {
    // let contest_id =contest_id;
    // let winnerList = winnerList;

    async function a(contest_id, winnerList) {
        let datetime = new Date();
        var date1 = moment(datetime);
        let key = 'leaderboard|' + contest_id;
        console.log(key)
        let contestquery = "select * from vw_apps_upcoming_contests_new where 1=1";
        let result = await dbConnection.executeQueryAll(contestquery, 'rmg_db', true, 40);
        if (result != undefined && result != null && result.length > 0) {
            result.forEach(async contest => {
                if (contest.contest_id == contest_id && contest.live_status == true) {
                    let app_name = contest.app_name;
                    let contest_name = contest.contest_name;
                    let old_winner_list = await redisConnection.getRedisPromise(key);
                    if (old_winner_list == null || old_winner_list == undefined || old_winner_list == "undefined") {
                        let winners = []
                        winnerList.forEach(playerList => {
                            let winner = { date: date1, player: playerList }
                            winners.push(winner);
                        });
                        console.log('INSERTING OLD')
                        let isset = await redisConnection.setRedisPromise(key, JSON.stringify(winners), 7200);
                    } else {
                        old_winner_list = JSON.parse(old_winner_list);
                        let winners = []
                        winnerList.forEach(async newWinner => {
                            let isNewUser = false;
                            let newWinnerPlayerId = newWinner.player_id;
                            old_winner_list.forEach(async oldWinner => {
                                if (newWinnerPlayerId == oldWinner.player.player_id) {
                                    isNewUser = true;
                                }
                            });
                            if (!isNewUser) {
                                let winner = { date: date1, player: newWinner }
                                old_winner_list.push(winner);
                            }
                        });
                        let isset = await redisConnection.setRedisPromise(key, JSON.stringify(old_winner_list), 7200);
                        let newList = [];
                        old_winner_list.forEach(async element => {
                            let olddt = moment(element.date);
                            let old_player = element.player;
                            var diffInMinutes = date1.diff(olddt, 'minutes');

                            if (parseInt(diffInMinutes) > 10) {
                                winnerList.forEach(async winnerNew => {
                                    if (winnerNew.player_id == old_player.player_id) {
                                        let winner = { date: date1, player: winnerNew }
                                        newList.push(winner)
                                    }

                                    if (winnerNew.player_id == old_player.player_id &&
                                        parseInt(winnerNew.player_rank) > parseInt(old_player.player_rank)) {
                                        let oldWinPrize = 0;
                                        let newwinPrize = 0;
                                        let oldCreditType = ''
                                        let newCreditType = ''

                                        g15daysRankDetails.forEach(async rank => {
                                            if (rank.contest_id == contest_id) {
                                                if (parseInt(rank.lower_rank) <= parseInt(winnerNew.player_rank) &&
                                                    parseInt(rank.upper_rank) >= parseInt(winnerNew.player_rank)) {
                                                    newwinPrize = rank.prize_amount;
                                                    newCreditType = rank.credit_type;
                                                }
                                                if (parseInt(rank.lower_rank) <= parseInt(old_player.player_rank) &&
                                                    parseInt(rank.upper_rank) >= parseInt(old_player.player_rank)) {
                                                    oldWinPrize = rank.prize_amount;
                                                    oldCreditType = rank.credit_type;
                                                }
                                            }
                                        });

                                        let checkIsAlreadySent = await redisConnection.getRedisPromise('scoreupdown' + contest_id + "|" + winnerNew.player_id);
                                        if (checkIsAlreadySent != null && checkIsAlreadySent != undefined) {
                                        } else {
                                            if (newwinPrize + "-" + newCreditType != oldWinPrize + "-" + oldCreditType) {
                                                let msg = 'HURRY UP!! You are loosing your rank in ' + app_name + ' (' + contest_name + ') from ' + old_player.player_rank
                                                    + ' to ' + winnerNew.player_rank
                                                    + ' and your winning prize would be ' + newwinPrize + " " + newCreditType + "."
                                                //console.log(msg)
                                                // if (winnerNew.player_id == 404373224658698241 || winnerNew.player_id == 404373834730733569 ||
                                                //     winnerNew.player_id == 412566148535386114 || winnerNew.player_id == 404727633506664449) {
                                                let checkIsAlreadySent = await redisConnection.setRedisPromise('scoreupdown' + contest_id + "|" + winnerNew.player_id, true, 1200);
                                                console.log('lOOSE ' + winnerNew.player_id + "|" + "You are loosing" + msg);
                                                push.sendPushPlayerId(winnerNew.player_id, 'You are loosing', msg);
                                                // } else {
                                                //     console.log('NOT WHITELIST')
                                                // }
                                            }
                                        }
                                    }
                                });
                            }
                            else {
                                newList.push(element)
                            }
                        });
                        isset = await redisConnection.setRedisPromise(key, JSON.stringify(newList), 7200);
                    }
                }
            })
        }
    } a(contest_id, winnerList);
    callback('ok')
}

function increaseLives(playerId, contestId) {
    let updateUsedLives = `update tbl_contest_players set used_lives = 
                       COALESCE( used_lives ,0) + 1 ,last_play_date = now()  
                       where contest_id = ${contestId} and 
                       player_id = ${playerId} `;
    console.log(updateUsedLives + "|" + updateUsedLives)
    dbConnection.executeQuery(updateUsedLives, "rmg_db", function (err, dbResult) { });
}

function getNewLives(contestInfo, player_id, userToken, airpayToken, callback) {
    console.log('GET NEW LIVES CALLED');
    let orderId = Date.now();
    let event = 'RE-JOIN CONTEST';
    let event_id = contestInfo.contest_id;
    let amount = contestInfo.entry_fee;
    let matrix_code = contestInfo.matrix_code;
    let event_name = contestInfo.app_name + "(" + contestInfo.contest_name + ")";
    debitcredit.debitAmountAirpayContestJoin(userToken, airpayToken, orderId, 'DEBIT', amount,
        event, event_id, event_name, matrix_code, function (err, debitResponse) {
            console.log('NEW RESPONSE ---------------------------');
            console.log(debitResponse);
            console.log(debitResponse.statusCode)
            console.log('NEW RESPONSE ---------------------------')
            if (debitResponse.statusCode == "200") {

                let query = ` update tbl_contest_players set used_lives = 0 
                            where player_id = ${player_id} and contest_id = ${event_id} `;
                console.log(query)
                dbConnection.executeQuery(query, "rmg_db", function () { });
                callback(err, debitResponse);
            } else {
                callback(true, null);
            }

        });
}