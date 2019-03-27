var config = require('config');
var logger = require('tracer').colorConsole();
var dbConnection = require('./dbConnection');

module.exports = {

    getAllApps: function (callback) {

        let query = "select distinct tbl_app.app_id, app_name, app_secret, app_code, app_icon, " +
            "tbl_app.status, callback_url, ios_app_url, android_app_url, deep_link, web_url, app_priority " +
            "from tbl_app " +
            "inner join tbl_contest on tbl_app.app_id = tbl_contest.app_id " +
            "where tbl_app.status = 'ACTIVE' and tbl_contest.status in ('ACTIVE', 'FULL') " +
            "order by from_time, (max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100) desc, app_name";

        logger.info("getAllApps query - ", query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("app details - ", JSON.stringify(dbResult));
            callback(err, dbResult);
        })
    },

    getAppContests: function (appId, playerId, callback) {

        let query = "select distinct tbl_contest.contest_id, tbl_contest.app_id, tbl_contest.contest_name, tbl_contest.contest_type, " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11) as start_date, substring(end_date::text, 0, 11) as end_date, " +
            "substring(from_time::text, 0, 6) as from_time, substring(to_time::text, 0, 6) as to_time, " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(100 - profit_margin) as cash_margin, (max_players * entry_fee) as total_amount, " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100) as win_amount, " +
            "count(distinct tbl_contest_players.player_id) as players_joined, " +
            "case when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::TIME between from_time and to_time " +
            "then 'Play' " +
            "when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "then 'Joined' " +
            "when tbl_contest.status = 'FULL' then 'FULL' " +
            "else 'Pay' end as play_status " +
            "from tbl_contest " +
            "left join tbl_contest_players on tbl_contest.contest_id = tbl_contest_players.contest_id and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = (transaction_date+ (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "and player_id = " + playerId + " " +
            "where app_id = " + appId + " and " +
            "tbl_contest.status in ('ACTIVE', 'FULL') " +
            "group by tbl_contest.contest_id, tbl_contest.app_id, tbl_contest.contest_name, tbl_contest.contest_type, " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11), substring(end_date::text, 0, 11), " +
            "substring(from_time::text, 0, 6), substring(to_time::text, 0, 6), " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(100 - profit_margin), (max_players * entry_fee), " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100), " +
            "case when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::TIME between from_time and to_time " +
            "then 'Play' " +
            "when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "then 'Joined' " +
            "when tbl_contest.status = 'FULL' then 'FULL' " +
            "else 'Pay' end " +
            "order by win_amount desc, from_time";

        logger.info("getAppContests query - ", query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("app contest details - ", JSON.stringify(dbResult));
            callback(err, dbResult);
        })
    },

    getLiveContestDetails: function (contestId, appId, playerId, callback) {
      
        let query = `select distinct tbl_app.app_id, tbl_app.package_name,
        tbl_app.app_type,app_name,app_code, app_icon,app_secret,tbl_app.status as app_status,
        tbl_app.deep_link,  tbl_contest_players.player_id, tbl_contest.contest_id,
        contest_name, contest_desc, start_date, end_date,from_time, to_time,
        max_players,winners,
        currency,  entry_fee,
        profit_margin,
        (100 - profit_margin) as cash_margin,
        (max_players * entry_fee) as total_amount,
        tbl_contest.win_amount,
        tbl_contest.status as contest_status,
        count(distinct tbl_contest_players.player_id) as player_joined,
        case
            when (now()  + (330 * interval '1 minute')) 
            between start_date and end_date then true
            else false
        end as live_status,
        transaction_date,
        case
            when  (now()  + (330 * interval '1 minute')) between start_date
             and end_date
            and tbl_contest_players.player_id in (${playerId}) then 'PLAY'
            when count(distinct player_id) >= max_players then 'FULL'
            when (now() + (330 * interval '1 minute')) < start_date
            and tbl_contest_players.player_id in (${playerId}) then 'JOINED'
            when 
            ((now() + (330 * interval '1 minute')) > (end_date  - (5 * interval '1 minute'))) then 'ENTRY-CLOSED'
            else 'PAY'
        end as play_status,
        debit_type,
        credit_type ,
        tbl_app.send_params,
        tbl_contest.game_conf,
        COALESCE(tbl_contest.max_lives,0) as max_lives
    from
        tbl_app
    inner join tbl_contest on
        tbl_app.app_id = tbl_contest.app_id
    left join tbl_contest_players on
        tbl_contest.contest_id = tbl_contest_players.contest_id 
    where
        (tbl_app.status = 'ACTIVE'
        and tbl_contest.status in ('ACTIVE',
        'FULL')
        and tbl_app.app_id = ${appId}
        and tbl_contest.contest_id = ${contestId})
        and (start_date >= (now() + (330 * interval '1 minute')) 
        or (now() + (330 * interval '1 minute'))  between start_date and end_date)
    group by
        tbl_app.app_id, app_name,  tbl_app.package_name, tbl_app.app_type, app_code, app_icon,
        app_secret, tbl_app.status, tbl_app.deep_link, tbl_contest_players.player_id,
        tbl_contest.contest_id, contest_name,  contest_desc, start_date,
        end_date, from_time, to_time, max_players, winners, currency,  entry_fee, profit_margin,
        (100 - profit_margin), (max_players * entry_fee), tbl_contest.win_amount, tbl_contest.status,
        transaction_date,
        debit_type,
        credit_type,
        tbl_app.send_params,
        tbl_contest.game_conf,
        COALESCE(tbl_contest.max_lives,0)
    order by
        app_name,
        from_time,
        to_time
    `
    //and (from_time >= (now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::time
        //or (now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::time between from_time and to_time)
       // console.log(query)
        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("app contest details - ", JSON.stringify(dbResult));

            if(dbResult !=null && dbResult !=undefined && dbResult.length > 1){
               var resPlayStatus = [];
                dbResult.forEach(element => {
                    if(element.player_id ==playerId ){
                        resPlayStatus.push(element);
                    }
                });
                if(resPlayStatus.length ==0){
                    resPlayStatus.push(dbResult[0]);
                }
                callback(err, resPlayStatus);
            }else{
                callback(err, dbResult);
            }
        })
    },

    getContestDetails: function (contestId, appId, playerId, callback) {

        let query = "select distinct tbl_contest.contest_id, tbl_contest.app_id, tbl_contest.contest_name, tbl_contest.contest_type, " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11) as start_date, substring(end_date::text, 0, 11) as end_date, " +
            "substring(from_time::text, 0, 6) as from_time, substring(to_time::text, 0, 6) as to_time, " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(100 - profit_margin) as cash_margin, (max_players * entry_fee) as total_amount, " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100) as win_amount, " +
            "count(distinct tbl_contest_players.player_id) as players_joined, " +
            "case when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::TIME between from_time and to_time " +
            "then 'Play' " +
            "when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "then 'Joined' " +
            "when tbl_contest.status = 'FULL' then 'FULL' " +
            "else 'Pay' end as play_status " +
            "from tbl_contest " +
            "left join tbl_contest_players on tbl_contest.contest_id = tbl_contest_players.contest_id and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = (transaction_date+ (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "and player_id = " + playerId + " " +
            "where tbl_contest.contest_id = " + contestId + " and tbl_contest.app_id = " + appId +
            //comment while testing
            // " and (now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE between start_date and end_date and " +
            // "from_time >= (now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::TIME " +
            //
            "and tbl_contest.status in ('ACTIVE', 'RUNNING') " +
            "group by tbl_contest.contest_id, tbl_contest.app_id, tbl_contest.contest_name, tbl_contest.contest_type, " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11), substring(end_date::text, 0, 11), " +
            "substring(from_time::text, 0, 6), substring(to_time::text, 0, 6), " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(100 - profit_margin), (max_players * entry_fee), " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100), " +
            "case when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::TIME between from_time and to_time " +
            "then 'Play' " +
            "when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "then 'Joined' " +
            "when tbl_contest.status = 'FULL' then 'FULL' " +
            "else 'Pay' end";

        logger.info("getContestDetails query - ", query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("app contest details - ", JSON.stringify(dbResult));
            callback(err, dbResult);
        })
    },

    getContestRankDetails: function (contestId, callback) {

        let query = "select * from tbl_contest_rank where contest_id = " + contestId;

        logger.info("getContestRankDetails query - ", query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("app details - ", JSON.stringify(dbResult));
            callback(err, dbResult);
        })
    },

    checkPlayerStatus: function (appId, contestId, playerId, callback) {

        // var query = "select tbl_contest.contest_id, tbl_contest.app_id, contest_name, contest_type, contest_desc, " +
        //     "start_date, end_date, from_time, to_time, max_players, winners, entry_fee, currency, " +
        //     "tbl_contest.status, transaction_amount, transaction_id, transaction_date " +
        //     "from tbl_contest " +
        //     "inner join tbl_contest_players on tbl_contest.contest_id = tbl_contest_players.contest_id " +
        //     "where " +
        //     //"tbl_contest.app_id = " + appId + " and " +
        //     "player_id = " + playerId + " and " +
        //     "tbl_contest_players.status = 'ACTIVE' and " +
        //     "tbl_contest.status = 'ACTIVE' and " +
        //     "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE =  " +
        //     "(transaction_date+ (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE"

        let query = "select distinct tbl_contest.contest_id, tbl_contest.app_id, tbl_contest.contest_name, tbl_contest.contest_type, " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11) as start_date, substring(end_date::text, 0, 11) as end_date, " +
            "substring(from_time::text, 0, 6) as from_time, substring(to_time::text, 0, 6) as to_time, " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(100 - profit_margin) as cash_margin, (max_players * entry_fee) as total_amount, " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100) as win_amount, " +
            "count(distinct tbl_contest_players.player_id) as players_joined, tbl_contest.status, tbl_contest.status as contest_status, " +
            "case when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::TIME between from_time and to_time " +
            "then 'Play' " +
            "when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "then 'Joined' " +
            "when tbl_contest.status = 'FULL' then 'FULL' " +
            "else 'Pay' end as play_status, transaction_id, transaction_amount, substring(transaction_date::text, 0, 11) as transaction_date " +
            "from tbl_contest " +
            "inner join tbl_contest_players on tbl_contest.contest_id = tbl_contest_players.contest_id and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = (transaction_date+ (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "and player_id = " + playerId + " " +
            "where app_id = " + appId + " and ";

        if (contestId != null && contestId != undefined && contestId != '') {
            query = query + "tbl_contest.contest_id = " + contestId + " and ";
        }

        query = query + "tbl_contest.status in ('ACTIVE', 'FULL') " +
            "group by tbl_contest.contest_id, tbl_contest.app_id, tbl_contest.contest_name, tbl_contest.contest_type, " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11), substring(end_date::text, 0, 11), " +
            "substring(from_time::text, 0, 6), substring(to_time::text, 0, 6), " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(100 - profit_margin), (max_players * entry_fee), " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100), tbl_contest.status, " +
            "case when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::TIME between from_time and to_time " +
            "then 'Play' " +
            "when tbl_contest_players.status = 'ACTIVE' and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE = " +
            "(transaction_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "then 'Joined' " +
            "when tbl_contest.status = 'FULL' then 'FULL' " +
            "else 'Pay' end, transaction_id, transaction_amount, substring(transaction_date::text, 0, 11) " +
            "order by win_amount desc, from_time";

        logger.info("checkPlayerStatus query - ", query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            //logger.info("check player status - ", JSON.stringify(dbResult));

            if (err) {
                callback(false, "Error occured!", null)
            }
            else {
                if (dbResult == null || dbResult == undefined) {
                    callback(false, "Player has not joined the contest!", null)
                }
                else if (dbResult.length == 0) {
                    callback(false, "Player has not joined the contest!", null)
                }
                else {
                    callback(true, "Player has joined the contest!", dbResult)
                }
            }
        })
    },

    getContestPlayerRanks: function (contestId, callback) {

        /* var query = "select contest_id, app_id, player_id, full_name, first_name, last_name, email_id, phone_number, " +
            "total_score, ROW_NUMBER() OVER (ORDER BY total_score DESC, total_post ASC) as rank from " +
            "( " +
            "SELECT contest_id, tbl_app_score.app_id, " +
            "tbl_app_score.player_id, " +
            "full_name, first_name, last_name, email_id, phone_number, " +
            "sum(app_score_id) total_post, " +
            "sum(score) total_score " +
            "from tbl_app_score " +
            "inner join tbl_player on tbl_player.player_id = tbl_app_score.player_id " +
            "where contest_id = " + contestId + //" and  " +
            // "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE =  " +
            // "(tbl_app_score.created_at + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE " +
            "group by contest_id, tbl_app_score.app_id, " +
            "tbl_app_score.player_id,  " +
            "full_name, first_name, last_name, email_id, phone_number " +
            ")ranks"; */

        var query = "SELECT contest_id, tbl_contest_leader_board.app_id, " +
            "tbl_contest_leader_board.player_id, " +
            "full_name, first_name, last_name, email_id, phone_number, total_score, " +
            "ROW_NUMBER() OVER (ORDER BY total_score DESC) as rank " +
            "from tbl_contest_leader_board " +
            "inner join tbl_player on tbl_player.player_id = tbl_contest_leader_board.player_id " +
            "where contest_id = " + contestId + " and  " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE =  contest_date " +
            " group by contest_id, tbl_contest_leader_board.app_id, " +
            "tbl_contest_leader_board.player_id,  " +
            "full_name, first_name, last_name, email_id, phone_number, total_score";

        logger.info("getContestPlayerRanks query - ", query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            logger.info("app contest details - ", JSON.stringify(dbResult));
            callback(err, dbResult);
        })
    },

    joinContest: function (contestId, appId, playerId, amount, debitResponse, userInfo,contestInfo,channel,debit_type,max_lives, callback) {
        console.log('----------------------------')
        console.log(contestInfo)
        console.log('----------------------------')
        var status = "FAILED";
        var walletTransId = null;
        var RespStatus = "FAILED";
        
        if (debitResponse.TRANSACTION) {
            if (debitResponse.TRANSACTION.TRANSACTIONSTATUS &&
                debitResponse.TRANSACTION.TRANSACTIONSTATUS == "200") {
                status = "ACTIVE";
                RespStatus = "SUCCESS";
            }
        }
        
        if (status == "ACTIVE") {
            // var event = 'JOIN CONTEST';
            // var event_id = contestInfo.contest_id;
            // var event_name = contestInfo.contest_name;

            // var wallet_transQuery = "INSERT INTO public.tbl_wallet_transaction " +
            //     " (wallet_txn_id, app_id, player_id, order_id, txn_type, comment, total_balance, " +
            //     " wallet_balance, mobile_no, amount, currency, ip_address, device_id, user_agent, " +
            //     " status, ap_txn_id, ap_txn_status, response_txt, chmod, " +
            //     " bank_name, created_at, updated_at,nz_txn_type,nz_txn_status,nz_txn_event,nz_txn_event_id,nz_txn_event_name)" +
            //     " VALUES(nextval('wallet_txn_seq'), " + appId +
            //     ", " + playerId +
            //     ", '" + debitResponse.TRANSACTION.TRANSACTIONID +
            //     "', '"+ debitResponse.TRANSACTION.TRANSACTIONTYPE +"', " +
            //     " 'Debit', 0, " +
            //     "'" + debitResponse.TRANSACTION.WALLETBALANCE + "', '" + userInfo.phone_number + "', " +
            //     "'" + amount + "', '" + debitResponse.TRANSACTION.CURRENCYCODE + "', " +
            //     "'', '', '', '"+ debitResponse.TRANSACTION.TRANSACTIONSTATUS +"', '" + debitResponse.TRANSACTION.APTRANSACTIONID + "', " +
            //     "'" + debitResponse.TRANSACTION.TRANSACTIONSTATUS + "', '"+ JSON.stringify(debitResponse) +"', " +
            //     "'" + debitResponse.TRANSACTION.CHMOD + "', '', now(), now(),'DEBIT','" + RespStatus + "','"+event+"','"+event_id+"','"+event_name+"') " +
            //     "RETURNING wallet_txn_id";

            //logger.info('joinContest - ', wallet_transQuery);

           // dbConnection.executeQuery(wallet_transQuery, "rmg_db", function (err, dbResult) {

               // logger.info('wallet_transQuery dbResult - ', dbResult);

               // if (err) {
               //     walletTransId = null;
               // } else {
                 //   if (dbResult == null || dbResult == undefined) {
                   //     walletTransId = null;
                   // } else if (dbResult.length == 0) {
                   //     walletTransId = null;
                  //  } else if (dbResult[0].wallet_txn_id) {
                  //      walletTransId = dbResult[0].wallet_txn_id
                   // } else {
                   //     walletTransId = null;
                   // }
               // }
               walletTransId = debitResponse.TRANSACTION.TRANSACTIONID;
                insertContestPlayer(contestId, appId, playerId, amount, debitResponse, walletTransId, status,channel,debit_type,max_lives,
                    function (isSuccess) {
                        callback(isSuccess)
                    });
            //})
        }
        else {
            callback(false)
            // insertContestPlayer(contestId, appId, playerId, amount, debitResponse, walletTransId, status,
            //     function (isSuccess) {
            //         callback(isSuccess)
            //     });
        }
    },

    getContestWithPlayerRank: function (appId, playerId, callback) {

        var query = "SELECT tbl_contest.contest_id, tbl_contest.app_id, " +
            "tbl_contest.contest_name, tbl_contest.contest_type,  " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11) as start_date, substring(end_date::text, 0, 11) as end_date,  " +
            "substring(from_time::text, 0, 6) as from_time, substring(to_time::text, 0, 6) as to_time, " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100) as win_amount, " +
            "tbl_contest_leader_board.player_id,  " +
            "full_name, first_name, last_name, email_id, phone_number, total_score,  " +
            "ROW_NUMBER() OVER (ORDER BY total_score DESC) as rank  " +
            "from tbl_contest  " +
            "inner join tbl_contest_leader_board on tbl_contest.contest_id = tbl_contest_leader_board.contest_id  " +
            "inner join tbl_player on tbl_player.player_id = tbl_contest_leader_board.player_id  " +
            "and tbl_contest_leader_board.player_id = " + playerId + " " +
            "where tbl_contest.app_id = " + appId + " and " +
            "(now() + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE >= " +
            "(contest_date + (5 * interval '1 hour') + (30 * interval '1 minute'))::DATE" +
            "group by tbl_contest.contest_id, tbl_contest.app_id, tbl_contest.contest_name, tbl_contest.contest_type,  " +
            "tbl_contest.contest_desc, substring(start_date::text, 0, 11), substring(end_date::text, 0, 11), " +
            "substring(from_time::text, 0, 6), substring(to_time::text, 0, 6), " +
            "tbl_contest.max_players, tbl_contest.winners, tbl_contest.entry_fee, tbl_contest.currency, " +
            "(max_players * entry_fee) - (max_players * entry_fee * profit_margin / 100), " +
            "tbl_contest_leader_board.player_id,   " +
            "full_name, first_name, last_name, email_id, phone_number, total_score";

        logger.info("getContestWithPlayerRank query - ", query);

        dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {
            logger.info("getContestWithPlayerRank details - ", JSON.stringify(dbResult));
            callback(err, dbResult);
        })
    },

    insertContestScore: function (contestId, appId, playerId, score, callback) {
 
                    var query_leader_board = "INSERT INTO public.tbl_contest_leader_board " +
                        "(contest_id, player_id, app_id, total_score, status, contest_date, created_at) " +
                        "VALUES(" + contestId + ", " + playerId + ", " + appId + ", " + score + ", 'ACTIVE', " +
                        "now()::date, now()) " +
                        "ON CONFLICT (contest_id, player_id) " +
                        "DO UPDATE SET total_score = (select total_score from tbl_contest_leader_board  " +
                        "where contest_id =  " + contestId + " and app_id = " + appId + " and player_id = " + playerId + "  " +
                        "and contest_date = now()::date limit 1) +  " +
                        "excluded.total_score returning tbl_contest_leader_board.*";

                    logger.info("query_leader_board query - ", query_leader_board);

                    dbConnection.executeQuery(query_leader_board, "rmg_db", function (err, dbResult) {

                        if (dbResult == null || dbResult == undefined) {
                            callback({
                                success: 0,
                                error: "Unable to post score. Please try again!",
                                message: "Unable to post score. Please try again!",
                            })
                        }
                        else if (dbResult.length == 0) {
                            callback({
                                success: 0,
                                error: "Unable to post score. Please try again!",
                                message: "Unable to post score. Please try again!",
                            })
                        }
                        else {
                            callback({
                                success: 1,
                                error: null,
                                message: 'Score posted successfully!'
                            })
                        }
                    });
 
    },

    joinContestPlayer(contestId, appId, playerId, amount, debitResponse, walletTransId, status,channel,debit_type,max_lives, callback) {
        console.log('CHANNEL joinContestPlayer ----' + channel)
        insertContestPlayer(contestId, appId, playerId, amount, debitResponse, walletTransId, status, channel,debit_type ,max_lives, function (isSuccess) {
                callback(isSuccess)
        });
    }
}

function insertContestPlayer(contestId, appId, playerId, amount, debitResponse, walletTransId, status, channel,debit_type,max_lives, callback) {
    console.log('CHANNEL functionjoinContestPlayer ----' + channel)
    var query = "INSERT INTO public.tbl_contest_players " +
        "(contest_id, player_id, transaction_amount, transaction_id, " +
        " transaction_date, status, debit_response,channel,contest_app_id, " +
        " contest_debit_type,max_lives,used_lives) " +
        "VALUES(" + contestId + ", " + playerId + ", " + amount + "," +
        " '" + walletTransId + "', " +
        "now(), '" + status + "', '" + JSON.stringify(debitResponse) 
        + "','"+ channel +"',"+ appId +",'"+ debit_type +"',"+ max_lives +", 0 ) " +
        "RETURNING contest_player_id";

    logger.info('tbl_contest_players insert - ', query);

    dbConnection.executeQuery(query, "rmg_db", function (err, dbResult) {

        logger.info('tbl_contest_players dbResult - ', dbResult);

        if (err) {
            callback(false);
        } else {
            if (dbResult == null || dbResult == undefined) {
                callback(false);
            } else if (dbResult.length == 0) {
                callback(false);
            } else if (dbResult[0].contest_player_id) {
                callback(true);
            } else {
                callback(false);
            }
        }
    });
}

