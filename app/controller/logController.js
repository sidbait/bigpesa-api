var config = require('config');
var logger = require('tracer').colorConsole();
var dbConnection = require('../model/dbConnection');
var useragent = require('useragent');
var sendResp = require('../service/send');
var userModel = require('../model/UserModel');
var requestIp = require('request-ip');

module.exports = {
    visitorLog: function (req, res) {
        let phone_number = req.body.phone_number ? req.body.phone_number : '';
        let user_agent = req.body.user_agent ? req.body.user_agent : '';
        let device_name = req.body.device_name ? req.body.device_name : '';
        let agency_source = req.body.agency_source ? req.body.agency_source : '';
        let agency_name = req.body.agency_name ? req.body.agency_name : '';
        let agency_para = req.body.agency_para ? req.body.agency_para : '';
        let agency_pubid = req.body.agency_pubid ? req.body.agency_pubid : '';
        let referer = req.body.referer ? req.body.referer : '';
        let referer_id = req.body.referer_id ? req.body.referer_id : '';
        let referer_url = req.body.referer_url ? req.body.referer_url : '';
        let ip_address = req.body.ip_address ? req.body.ip_address : '';
        let os_name = req.body.os_name ? req.body.os_name : '';
        let os_version = req.body.os_version ? req.body.os_version : '';
        let browser = req.body.browser ? req.body.browser : '';
        let page = req.body.page ? req.body.page : '';
        let click_id = req.body.click_id ? req.body.click_id : '';
        let browser_version = req.body.browser_version ? req.body.browser_version : '';
        let device_id = req.body.device_id ? req.body.device_id : '';
        let channel = req.body.channel ? req.body.channel : '';
        var userToken = req.headers["authorization"];
        var playerId = "";
        var unique_id = req.body.unique_id ? req.body.unique_id : '';
        //channel = "PLAYSTORE"
        if (channel == "") {
            channel = "PLAYSTORE"
        } else {
            channel = channel.toUpperCase();
        }

        if (channel != 'PLAYSTORE' && channel != 'NON-PLAYSTORE') {
            channel = 'PLAYSTORE';
        }

        userModel.getUserDetails(userToken, function (err, userDetails) {

            playerId = userDetails.playerId;
            if (playerId == "") {
                playerId = null;
            }
            if (unique_id == "" && device_id != "") {
                unique_id = device_id;
            }


            if (user_agent != null && user_agent != undefined && user_agent != '') {

                var agent = useragent.parse(user_agent);

                device_name = agent.device.toString();
                browser = agent.toAgent();
                if (browser) {
                    browser = browser.replace(agent.toVersion(), '')
                }
                browser_version = agent.toVersion();
                os_name = agent.os.toString();
                if (os_name) {
                    os_name = os_name.replace(agent.os.toVersion(), '')
                }
                os_version = agent.os.toVersion();
            }

            let visitor_query = "INSERT INTO public.tbl_visitors " +
                "( phone_number, user_agent, device_name, agency_source, " +
                " agency_name, agency_para, agency_pubid, referer, referer_id, " +
                " referer_url, ip_address, os_name, os_version, browser, " +
                " browser_version, visit_date,playerid,page,click_id,device_id,unique_id,channel) " +
                " VALUES('" + phone_number + "', '" + user_agent + "', '" + device_name + "', '" + agency_source + "', " +
                " '" + agency_name + "', '" + agency_para + "', '" + agency_pubid + "', '" + referer + "', '" + referer_id + "', " +
                " '" + referer_url + "', '" + ip_address + "', '" + os_name + "', " +
                " '" + os_version + "', '" + browser + "', '" + browser_version + "', " +
                "  now()," + playerId + ",'" + page + "','" + click_id + "','" + device_id
                + "','" + unique_id + "','" + channel + "')  RETURNING visitor_id;";

            logger.info('visitor_query insert - ', visitor_query);

            dbConnection.executeQuery(visitor_query, "rmg_db", function (err, dbResult) {

                logger.info('visitor_query dbResult - ', dbResult);

                var data = { visitor_id: null };
                data.isVisitBonus = false;
                data.isDailyBonus = false;
                data.isTimeBonus = false;
                if (err) {
                    data = { visitor_id: null };
                } else {

                    if (dbResult == null || dbResult == undefined) {
                        data = { visitor_id: null };
                    } else if (dbResult.length == 0) {
                        data = { visitor_id: null };
                    } else if (dbResult[0].visitor_id) {
                        data = { visitor_id: dbResult[0].visitor_id };
                    } else {
                        data = { visitor_id: null };
                    }
                }

                if (data.visitor_id != null) {
                    if (playerId != null) {
                        let chkQeury = 'select  tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' tbl_visitbonus_master.fromtime, ' +
                            ' tbl_visitbonus_master.totime ,\'TIMESLOT\' as type, ' +
                            ' count(*) from vw_todays_visitors  as tbl_visitors ' +
                            ' inner join tbl_visitbonus_master ' +
                            ' on (tbl_visitors.visit_date + (330 * interval \'1 minute\'))  ::time ' +
                            ' between tbl_visitbonus_master.fromtime::time  ' +
                            ' and tbl_visitbonus_master.totime::time ' +
                            ' where  playerid = ' + playerId + '   ' +
                            ' and (now() + (330 * interval \'1 minute\') )::time between ' +
                            ' tbl_visitbonus_master.fromtime::time 	and tbl_visitbonus_master.totime::time ' +
                            ' and tbl_visitbonus_master.status = \'ACTIVE\' and (tbl_visitors.visit_date + (330 * interval \'1 minute\'))::date = ' +
                            ' (now()+ (330 * interval \'1 minute\'))::date ' +
                            ' group by tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' tbl_visitbonus_master.fromtime, ' +
                            ' tbl_visitbonus_master.totime  ' +
                            ' union all ' +
                            ' select  tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' \'20:00:00\'::time as fromtime, \'20:00:00\'::time as totime,\'DAILY\' as type , ' +
                            ' count(*) from vw_todays_visitors  as tbl_visitors ' +
                            ' inner join tbl_visitbonus_master  on  ' +
                            ' tbl_visitbonus_master.type = \'DAILY\' ' +
                            ' where  playerid = ' + playerId + ' ' +
                            ' and  tbl_visitbonus_master.status = \'ACTIVE\' and (tbl_visitors.visit_date + (330 * interval \'1 minute\'))::date = ' +
                            ' (now()+ (330 * interval \'1 minute\'))::date ' +
                            ' group by tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus order by count asc';
                        console.log(chkQeury)
                        dbConnection.executeQuery(chkQeury, "rmg_db", function (err, result) {
                            // console.log(result)
                            if (result != null && result.length > 0) {
                                let VisitRow = {}
                                let TimeSlotRow = {}

                                result.forEach(element => {
                                    if (element.type == "DAILY") {
                                        VisitRow = element;
                                    } else if (element.type == "TIMESLOT") {
                                        TimeSlotRow = element;
                                    }
                                });

                                var data = {};
                                data.isVisitBonus = false;
                                data.isDailyBonus = false;
                                data.isTimeBonus = false;
                                // console.log(TimeSlotRow)
                                if (TimeSlotRow != null && TimeSlotRow.count == 1) {
                                    data.isTimeBonus = true;

                                    let insertVisitBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                        " (player_id, visit_datetime, fromtime, totime, " +
                                        " credit_type, credit_bonus, is_credited,type,status,next_retry ) " +
                                        " VALUES( " + playerId + ", now(), '" + TimeSlotRow.fromtime + "' " +
                                        " , '" + TimeSlotRow.totime + "', '" + TimeSlotRow.credit_type + "', " +
                                        " " + TimeSlotRow.credit_bonus + ", false,'TIME-BONUS','ACTIVE',now());"
                                    //console.log(insertVisitBonusLog);
                                    dbConnection.executeQuery(insertVisitBonusLog, "rmg_db", function (err, ress) {
                                        if (!err) {
                                            let visitLogQuery = "select distinct tbl_visitbonus_master.fromtime, " +
                                                " tbl_visitbonus_master.totime, " +
                                                " tbl_visitbonus_master.credit_type,tbl_visitbonus_master.credit_bonus , " +
                                                " case when tbl_visit_bonus_log.id is null then false else true end as isearn, " +
                                                " case " +
                                                " when (now() + (330 * interval '1 minute')) ::time between " +
                                                " tbl_visitbonus_master.fromtime and tbl_visitbonus_master.totime " +
                                                " then true else false end as Active " +
                                                " from tbl_visitbonus_master  " +
                                                " left join tbl_visit_bonus_log on " +
                                                " tbl_visit_bonus_log.fromtime = tbl_visitbonus_master.fromtime " +
                                                " and tbl_visit_bonus_log.totime = tbl_visitbonus_master.totime " +
                                                " and tbl_visit_bonus_log.player_id = " + playerId + " " +
                                                " and visit_datetime::date = now()::date " +
                                                " where tbl_visitbonus_master.type = 'TIMESLOT' and tbl_visitbonus_master.status = 'ACTIVE' order by " +
                                                " tbl_visitbonus_master.fromtime asc ";
                                            // console.log(visitLogQuery)
                                            dbConnection.executeQuery(visitLogQuery, "rmg_db", function (err, visitLog) {
                                                if (err) {
                                                    sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                                } else {

                                                    data.bonusLog = visitLog;
                                                    data.visitbonus = { credit_type: TimeSlotRow.credit_type, amount: TimeSlotRow.credit_bonus };
                                                    // console.log(data)
                                                    if (VisitRow != null && VisitRow.count == 1) {
                                                        data.isVisitBonus = true;
                                                        data.isDailyBonus = true;

                                                        var getSpinWheelquery = " select * from tbl_dailybonus_spin_master where  status = 'ACTIVE' and upper(channel) = '" + channel + "'";
                                                        dbConnection.executeQuery(getSpinWheelquery, "rmg_db", function (err, spinwheelData) {
                                                            if (err || spinwheelData == undefined || spinwheelData.length == 0) {
                                                                sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + TimeSlotRow.credit_bonus + ")");
                                                            } else {
                                                                data.isDailyBonus = true;
                                                                data.dailybonus = { credit_type: VisitRow.credit_type, amount: VisitRow.credit_bonus };
                                                                data.dailybonus = getRandomDailyBonus(spinwheelData)
                                                                data.spinWheel = spinwheelData;
                                                                // console.log('DAILY VISIT')
                                                                let insertDailyBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                                                    " (player_id, visit_datetime, fromtime, totime, " +
                                                                    " credit_type, credit_bonus, is_credited,type,status,next_retry ) " +
                                                                    " VALUES( " + playerId + ", now(), '00:00:00' " +
                                                                    " , '00:00:00', '" + data.dailybonus.credit_type + "', " +
                                                                    " " + data.dailybonus.amount + ", false,'DAILY-BONUS','ACTIVE',now());";
                                                                // console.log(insertDailyBonusLog)
                                                                dbConnection.executeQuery(insertDailyBonusLog, "rmg_db", function (err, visitLog) {
                                                                    if (err) {
                                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + result[0].credit_bonus + ")");
                                                                    } else {
                                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Daily Bonus " + data.dailybonus.credit_type + "(" + data.dailybonus.amount + ")");
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + TimeSlotRow.credit_bonus + ")");
                                                    }
                                                }
                                            });
                                        } else {
                                            sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                        }
                                    });
                                } else {
                                    if (VisitRow != null && VisitRow.count == 1) {
                                        data.isVisitBonus = true;
                                        data.isDailyBonus = true;
                                        var getSpinWheelquery = " select * from tbl_dailybonus_spin_master  where upper(channel) = '" + channel + "'";
                                        dbConnection.executeQuery(getSpinWheelquery, "rmg_db", function (err, spinwheelData) {
                                            if (err || spinwheelData == undefined || spinwheelData.length == 0) {
                                                sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + TimeSlotRow.credit_bonus + ")");
                                            } else {
                                                data.isDailyBonus = true;
                                                data.dailybonus = { credit_type: VisitRow.credit_type, amount: VisitRow.credit_bonus };
                                                data.dailybonus = getRandomDailyBonus(spinwheelData)
                                                data.spinWheel = spinwheelData;
                                                // console.log('DAILY VISIT')
                                                let insertDailyBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                                    " (player_id, visit_datetime, fromtime, totime, " +
                                                    " credit_type, credit_bonus, is_credited,type,status,next_retry ) " +
                                                    " VALUES( " + playerId + ", now(), '00:00:00' " +
                                                    " , '00:00:00', '" + data.dailybonus.credit_type + "', " +
                                                    " " + data.dailybonus.amount + ", false,'DAILY-BONUS','ACTIVE',now());";
                                                // console.log(insertDailyBonusLog)
                                                dbConnection.executeQuery(insertDailyBonusLog, "rmg_db", function (err, visitLog) {
                                                    if (err) {
                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + result[0].credit_bonus + ")");
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Daily Bonus " + data.dailybonus.credit_type + "(" + data.dailybonus.amount + ")");
                                                    }
                                                });
                                            }
                                        });
                                    }
                                    else {
                                        sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                    }
                                }
                            } else {
                                sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                            }
                        })
                    } else {
                        sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                    }
                }
                else
                    sendResp.sendCustomJSON(null, req, res, false, data, "Visitor Log Entry Failed!");
            });
        });
    },
    visitLog: function (req, res) {
        let phone_number = req.body.phone_number ? req.body.phone_number : '';
        let user_agent = req.body.user_agent ? req.body.user_agent : '';
        let device_name = req.body.device_name ? req.body.device_name : '';
        let agency_source = req.body.agency_source ? req.body.agency_source : '';
        let agency_name = req.body.agency_name ? req.body.agency_name : '';
        let agency_para = req.body.agency_para ? req.body.agency_para : '';
        let agency_pubid = req.body.agency_pubid ? req.body.agency_pubid : '';
        let referer = req.body.referer ? req.body.referer : '';
        let referer_id = req.body.referer_id ? req.body.referer_id : '';
        let referer_url = req.body.referer_url ? req.body.referer_url : '';
        let ip_address = req.body.ip_address ? req.body.ip_address : '';
        let os_name = req.body.os_name ? req.body.os_name : '';
        let os_version = req.body.os_version ? req.body.os_version : '';
        let browser = req.body.browser ? req.body.browser : '';
        let page = req.body.page ? req.body.page : '';
        let click_id = req.body.click_id ? req.body.click_id : '';
        let browser_version = req.body.browser_version ? req.body.browser_version : '';
        let device_id = req.body.device_id ? req.body.device_id : '';
        let channel = req.body.channel ? req.body.channel : '';
        var userToken = req.headers["authorization"];
        var playerId = "";
        var unique_id = req.body.unique_id ? req.body.unique_id : '';
        //channel = "PLAYSTORE"
        if (channel == "") {
            channel = "PLAYSTORE"
        } else {
            channel = channel.toUpperCase();
        }

        if (channel != 'PLAYSTORE' && channel != 'NON-PLAYSTORE') {
            channel = 'PLAYSTORE';
        }

        userModel.getUserDetails(userToken, function (err, userDetails) {
            playerId = userDetails.playerId;
            if (playerId == "") {
                playerId = null;
            }
            if (unique_id == "" && device_id != "") {
                unique_id = device_id;
            }
            if (user_agent != null && user_agent != undefined && user_agent != '') {
                var agent = useragent.parse(user_agent);
                device_name = agent.device.toString();
                browser = agent.toAgent();
                if (browser) {
                    browser = browser.replace(agent.toVersion(), '')
                }
                browser_version = agent.toVersion();
                os_name = agent.os.toString();
                if (os_name) {
                    os_name = os_name.replace(agent.os.toVersion(), '')
                }
                os_version = agent.os.toVersion();
            }

            let visitor_query = "INSERT INTO public.tbl_visitors " +
                "( phone_number, user_agent, device_name, agency_source, " +
                " agency_name, agency_para, agency_pubid, referer, referer_id, " +
                " referer_url, ip_address, os_name, os_version, browser, " +
                " browser_version, visit_date,playerid,page,click_id,device_id,unique_id,channel) " +
                " VALUES('" + phone_number + "', '" + user_agent + "', '" + device_name + "', '" + agency_source + "', " +
                " '" + agency_name + "', '" + agency_para + "', '" + agency_pubid + "', '" + referer + "', '" + referer_id + "', " +
                " '" + referer_url + "', '" + ip_address + "', '" + os_name + "', " +
                " '" + os_version + "', '" + browser + "', '" + browser_version + "', " +
                "  now()," + playerId + ",'" + page + "','" + click_id + "','" + device_id
                + "','" + unique_id + "','" + channel + "')  RETURNING visitor_id;";

            logger.info('visitor_query insert - ', visitor_query);

            dbConnection.executeQuery(visitor_query, "rmg_db", function (err, dbResult) {
                if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                    sendResp.sendCustomJSON(null, req, res, true, dbResult, "Visitor Log Entry Success!");
                }
                else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Visitor Log Entry Failed!");
                }
            });
        });
    },
    downloadLog: async function (req, res) {
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        let app_id = req.body.appid ? req.body.appid : null;
        if (app_id == null) {
            sendResp.sendCustomJSON(null, req, res, false, [], "AppId Required");
        } else {
            let userToken = req.headers["authorization"];
            let playerInfo = await userModel.getUserDetailPromise(userToken);
            let player_id = playerInfo.playerId;

            if (player_id == '') {
                player_id = null;
            }
            let phone_number = req.body.phone_number ? req.body.phone_number : '';
            let user_agent = req.body.user_agent ? req.body.user_agent : '';
            let device_name = req.body.device_name ? req.body.device_name : '';
            let agency_source = req.body.agency_source ? req.body.agency_source : '';
            let agency_name = req.body.agency_name ? req.body.agency_name : '';
            let agency_para = req.body.agency_para ? req.body.agency_para : '';
            let agency_pubid = req.body.agency_pubid ? req.body.agency_pubid : '';
            let referer = req.body.referer ? req.body.referer : '';
            let referer_id = req.body.referer_id ? req.body.referer_id : '';
            let referer_url = req.body.referer_url ? req.body.referer_url : '';
            let os_name = req.body.os_name ? req.body.os_name : '';
            let os_version = req.body.os_version ? req.body.os_version : '';
            let browser = req.body.browser ? req.body.browser : '';
            let device_id = req.body.device_id ? req.body.device_id : '';
            let browser_version = req.body.browser_version ? req.body.browser_version : '';
            let channel = req.body.channel ? req.body.channel : '';
            let version = req.body.version ? req.body.version : '';
            if (user_agent != null && user_agent != undefined && user_agent != '') {
                var agent = useragent.parse(user_agent);
                device_name = agent.device.toString();
                browser = agent.toAgent();
                if (browser) {
                    browser = browser.replace(agent.toVersion(), '')
                }
                browser_version = agent.toVersion();
                os_name = agent.os.toString();
                if (os_name) {
                    os_name = os_name.replace(agent.os.toVersion(), '')
                }
                os_version = agent.os.toVersion();
            }
            let ip_address = requestIp.getClientIp(req);

            let query = "INSERT INTO public.tbl_app_download " +
                " ( app_id, player_id, phone_number, user_agent, " +
                " device_name, agency_source, agency_name, agency_para, agency_pubid, " +
                " referer, referer_id, referer_url, ip_address, os_name, os_version, " +
                " browser, browser_version, download_date,device_id,channel,app_version) " +
                " VALUES( " + app_id + ", " + player_id + ", '" + phone_number
                + "', '" + user_agent + "', '" + device_name + "','" + agency_source + "' ," +
                " '" + agency_name + "','" + agency_para + "','" + agency_pubid + "','" + referer + "', " +
                " '" + referer_id + "', '" + referer_url + "', '" + ip_address + "', '" + os_name
                + "', '" + os_version + "', '" + browser + "', '" + browser_version
                + "', now(),'" + device_id + "','" + channel + "','" + version + "');";
            // console.log(query)
            let result = await dbConnection.executeQueryAll(query, 'rmg_db')

            res.send('ok')
        }
    },
    checkisProUser: async function (req, res) {
        try {

            let device_id = req.params.device_id;
            // console.log(device_id)
            let checkproQuery = `select count(1) from tbl_player_device where 
            created_at::Date < (now()- (8::int * '1d'::interval)) 
             and device_id = '${device_id}'  `;
            let dbResult = await dbConnection.executeQueryAll(checkproQuery, 'rmg_db');
            //console.log(dbResult)
            if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
                //  console.log(dbResult[0].count)
                if (dbResult[0].count > 1) {
                    sendResp.sendCustomJSON(null, req, res, true, dbResult, "Already Pro User");
                } else {
                    sendResp.sendCustomJSON(null, req, res, false, [], "Something went wrong!");
                }
            }
        } catch (error) {
            sendResp.sendCustomJSON(null, req, res, false, data, "Something went wrong!");
        }
    },
    bonusVisit: function (req, res) {
        let phone_number = req.body.phone_number ? req.body.phone_number : '';
        let user_agent = req.body.user_agent ? req.body.user_agent : '';
        let device_name = req.body.device_name ? req.body.device_name : '';
        let agency_source = req.body.agency_source ? req.body.agency_source : '';
        let agency_name = req.body.agency_name ? req.body.agency_name : '';
        let agency_para = req.body.agency_para ? req.body.agency_para : '';
        let agency_pubid = req.body.agency_pubid ? req.body.agency_pubid : '';
        let referer = req.body.referer ? req.body.referer : '';
        let referer_id = req.body.referer_id ? req.body.referer_id : '';
        let referer_url = req.body.referer_url ? req.body.referer_url : '';
        let ip_address = req.body.ip_address ? req.body.ip_address : '';
        let os_name = req.body.os_name ? req.body.os_name : '';
        let os_version = req.body.os_version ? req.body.os_version : '';
        let browser = req.body.browser ? req.body.browser : '';
        let page = req.body.page ? req.body.page : '';
        let click_id = req.body.click_id ? req.body.click_id : '';
        let browser_version = req.body.browser_version ? req.body.browser_version : '';
        let device_id = req.body.device_id ? req.body.device_id : '';
        let channel = req.body.channel ? req.body.channel : '';
        var userToken = req.headers["authorization"];
        var playerId = "";
        var unique_id = req.body.unique_id ? req.body.unique_id : '';
        //channel = "PLAYSTORE"
        if (channel == "") {
            channel = "PLAYSTORE"
        } else {
            channel = channel.toUpperCase();
        }

        if (channel != 'PLAYSTORE' && channel != 'NON-PLAYSTORE') {
            channel = 'PLAYSTORE';
        }

        userModel.getUserDetails(userToken, function (err, userDetails) {

            playerId = userDetails.playerId;
            if (playerId == "") {
                playerId = null;
            }
            if (unique_id == "" && device_id != "") {
                unique_id = device_id;
            }


            if (user_agent != null && user_agent != undefined && user_agent != '') {

                var agent = useragent.parse(user_agent);

                device_name = agent.device.toString();
                browser = agent.toAgent();
                if (browser) {
                    browser = browser.replace(agent.toVersion(), '')
                }
                browser_version = agent.toVersion();
                os_name = agent.os.toString();
                if (os_name) {
                    os_name = os_name.replace(agent.os.toVersion(), '')
                }
                os_version = agent.os.toVersion();
            }

            let visitor_query = "INSERT INTO public.tbl_visit_spin_log " +
                "( phone_number, user_agent, device_name, agency_source, " +
                " agency_name, agency_para, agency_pubid, referer, referer_id, " +
                " referer_url, ip_address, os_name, os_version, browser, " +
                " browser_version, visit_date,playerid,page,click_id,device_id,unique_id,channel) " +
                " VALUES('" + phone_number + "', '" + user_agent + "', '" + device_name + "', '" + agency_source + "', " +
                " '" + agency_name + "', '" + agency_para + "', '" + agency_pubid + "', '" + referer + "', '" + referer_id + "', " +
                " '" + referer_url + "', '" + ip_address + "', '" + os_name + "', " +
                " '" + os_version + "', '" + browser + "', '" + browser_version + "', " +
                "  now()," + playerId + ",'" + page + "','" + click_id + "','" + device_id
                + "','" + unique_id + "','" + channel + "')  RETURNING visitor_id;";

            logger.info('visitor_query insert - ', visitor_query);

            dbConnection.executeQuery(visitor_query, "rmg_db", function (err, dbResult) {

                logger.info('visitor_query dbResult - ', dbResult);

                var data = { visitor_id: null };
                data.isVisitBonus = false;
                data.isDailyBonus = false;
                data.isTimeBonus = false;
                if (err) {
                    data = { visitor_id: null };
                } else {

                    if (dbResult == null || dbResult == undefined) {
                        data = { visitor_id: null };
                    } else if (dbResult.length == 0) {
                        data = { visitor_id: null };
                    } else if (dbResult[0].visitor_id) {
                        data = { visitor_id: dbResult[0].visitor_id };
                    } else {
                        data = { visitor_id: null };
                    }
                }

                if (data.visitor_id != null) {
                    if (playerId != null) {
                        let chkQeury = 'select  tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' tbl_visitbonus_master.fromtime, ' +
                            ' tbl_visitbonus_master.totime ,\'TIMESLOT\' as type, ' +
                            ' count(*) from vw_todays_visitors  as tbl_visit_spin_log ' +
                            ' inner join tbl_visitbonus_master ' +
                            ' on (tbl_visit_spin_log.visit_date + (330 * interval \'1 minute\'))  ::time ' +
                            ' between tbl_visitbonus_master.fromtime::time  ' +
                            ' and tbl_visitbonus_master.totime::time ' +
                            ' where  playerid = ' + playerId + '   ' +
                            ' and (now() + (330 * interval \'1 minute\') )::time between ' +
                            ' tbl_visitbonus_master.fromtime::time 	and tbl_visitbonus_master.totime::time ' +
                            ' and tbl_visitbonus_master.status = \'ACTIVE\' and (tbl_visit_spin_log.visit_date + (330 * interval \'1 minute\'))::date = ' +
                            ' (now()+ (330 * interval \'1 minute\'))::date ' +
                            ' group by tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' tbl_visitbonus_master.fromtime, ' +
                            ' tbl_visitbonus_master.totime  ' +
                            ' union all ' +
                            ' select  tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' \'20:00:00\'::time as fromtime, \'20:00:00\'::time as totime,\'DAILY\' as type , ' +
                            ' count(*) from vw_todays_visitors  as tbl_visit_spin_log ' +
                            ' inner join tbl_visitbonus_master  on  ' +
                            ' tbl_visitbonus_master.type = \'DAILY\' ' +
                            ' where  playerid = ' + playerId + ' ' +
                            ' and  tbl_visitbonus_master.status = \'ACTIVE\' and (tbl_visit_spin_log.visit_date + (330 * interval \'1 minute\'))::date = ' +
                            ' (now()+ (330 * interval \'1 minute\'))::date ' +
                            ' group by tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus order by count asc';
                        console.log(chkQeury)
                        dbConnection.executeQuery(chkQeury, "rmg_db", function (err, result) {
                            // console.log(result)
                            if (result != null && result.length > 0) {
                                let VisitRow = {}
                                let TimeSlotRow = {}

                                result.forEach(element => {
                                    if (element.type == "DAILY") {
                                        VisitRow = element;
                                    } else if (element.type == "TIMESLOT") {
                                        TimeSlotRow = element;
                                    }
                                });

                                var data = {};
                                data.isVisitBonus = false;
                                data.isDailyBonus = false;
                                data.isTimeBonus = false;
                                // console.log(TimeSlotRow)
                                if (TimeSlotRow != null && TimeSlotRow.count == 1) {
                                    data.isTimeBonus = true;

                                    let insertVisitBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                        " (player_id, visit_datetime, fromtime, totime, " +
                                        " credit_type, credit_bonus, is_credited,type,status,next_retry ) " +
                                        " VALUES( " + playerId + ", now(), '" + TimeSlotRow.fromtime + "' " +
                                        " , '" + TimeSlotRow.totime + "', '" + TimeSlotRow.credit_type + "', " +
                                        " " + TimeSlotRow.credit_bonus + ", false,'TIME-BONUS','ACTIVE',now());"
                                    //console.log(insertVisitBonusLog);
                                    dbConnection.executeQuery(insertVisitBonusLog, "rmg_db", function (err, ress) {
                                        if (!err) {
                                            let visitLogQuery = "select distinct tbl_visitbonus_master.fromtime, " +
                                                " tbl_visitbonus_master.totime, " +
                                                " tbl_visitbonus_master.credit_type,tbl_visitbonus_master.credit_bonus , " +
                                                " case when tbl_visit_bonus_log.id is null then false else true end as isearn, " +
                                                " case " +
                                                " when (now() + (330 * interval '1 minute')) ::time between " +
                                                " tbl_visitbonus_master.fromtime and tbl_visitbonus_master.totime " +
                                                " then true else false end as Active " +
                                                " from tbl_visitbonus_master  " +
                                                " left join tbl_visit_bonus_log on " +
                                                " tbl_visit_bonus_log.fromtime = tbl_visitbonus_master.fromtime " +
                                                " and tbl_visit_bonus_log.totime = tbl_visitbonus_master.totime " +
                                                " and tbl_visit_bonus_log.player_id = " + playerId + " " +
                                                " and visit_datetime::date = now()::date " +
                                                " where tbl_visitbonus_master.type = 'TIMESLOT' and tbl_visitbonus_master.status = 'ACTIVE' order by " +
                                                " tbl_visitbonus_master.fromtime asc ";
                                            // console.log(visitLogQuery)
                                            dbConnection.executeQuery(visitLogQuery, "rmg_db", function (err, visitLog) {
                                                if (err) {
                                                    sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                                } else {

                                                    data.bonusLog = visitLog;
                                                    data.visitbonus = { credit_type: TimeSlotRow.credit_type, amount: TimeSlotRow.credit_bonus };
                                                    // console.log(data)
                                                    if (VisitRow != null && VisitRow.count == 1) {
                                                        data.isVisitBonus = true;
                                                        data.isDailyBonus = true;

                                                        var getSpinWheelquery = " select * from tbl_dailybonus_spin_master where  status = 'ACTIVE' and upper(channel) = '" + channel + "'";
                                                        dbConnection.executeQuery(getSpinWheelquery, "rmg_db", function (err, spinwheelData) {
                                                            if (err || spinwheelData == undefined || spinwheelData.length == 0) {
                                                                sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + TimeSlotRow.credit_bonus + ")");
                                                            } else {
                                                                data.isDailyBonus = true;
                                                                data.dailybonus = { credit_type: VisitRow.credit_type, amount: VisitRow.credit_bonus };
                                                                data.dailybonus = getRandomDailyBonus(spinwheelData)
                                                                data.spinWheel = spinwheelData;
                                                                // console.log('DAILY VISIT')
                                                                let insertDailyBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                                                    " (player_id, visit_datetime, fromtime, totime, " +
                                                                    " credit_type, credit_bonus, is_credited,type,status,next_retry ) " +
                                                                    " VALUES( " + playerId + ", now(), '00:00:00' " +
                                                                    " , '00:00:00', '" + data.dailybonus.credit_type + "', " +
                                                                    " " + data.dailybonus.amount + ", false,'DAILY-BONUS','ACTIVE',now());";
                                                                // console.log(insertDailyBonusLog)
                                                                dbConnection.executeQuery(insertDailyBonusLog, "rmg_db", function (err, visitLog) {
                                                                    if (err) {
                                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + result[0].credit_bonus + ")");
                                                                    } else {
                                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Daily Bonus " + data.dailybonus.credit_type + "(" + data.dailybonus.amount + ")");
                                                                    }
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + TimeSlotRow.credit_bonus + ")");
                                                    }
                                                }
                                            });
                                        } else {
                                            sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                        }
                                    });
                                } else {
                                    if (VisitRow != null && VisitRow.count == 1) {
                                        data.isVisitBonus = true;
                                        data.isDailyBonus = true;
                                        var getSpinWheelquery = " select * from tbl_dailybonus_spin_master  where upper(channel) = '" + channel + "'";
                                        dbConnection.executeQuery(getSpinWheelquery, "rmg_db", function (err, spinwheelData) {
                                            if (err || spinwheelData == undefined || spinwheelData.length == 0) {
                                                sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + TimeSlotRow.credit_bonus + ")");
                                            } else {
                                                data.isDailyBonus = true;
                                                data.dailybonus = { credit_type: VisitRow.credit_type, amount: VisitRow.credit_bonus };
                                                data.dailybonus = getRandomDailyBonus(spinwheelData)
                                                data.spinWheel = spinwheelData;
                                                // console.log('DAILY VISIT')
                                                let insertDailyBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                                    " (player_id, visit_datetime, fromtime, totime, " +
                                                    " credit_type, credit_bonus, is_credited,type,status,next_retry ) " +
                                                    " VALUES( " + playerId + ", now(), '00:00:00' " +
                                                    " , '00:00:00', '" + data.dailybonus.credit_type + "', " +
                                                    " " + data.dailybonus.amount + ", false,'DAILY-BONUS','ACTIVE',now());";
                                                // console.log(insertDailyBonusLog)
                                                dbConnection.executeQuery(insertDailyBonusLog, "rmg_db", function (err, visitLog) {
                                                    if (err) {
                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + TimeSlotRow.credit_type + "(" + result[0].credit_bonus + ")");
                                                    } else {
                                                        sendResp.sendCustomJSON(null, req, res, true, data, "Got Daily Bonus " + data.dailybonus.credit_type + "(" + data.dailybonus.amount + ")");
                                                    }
                                                });
                                            }
                                        });
                                    }
                                    else {
                                        sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                    }
                                }
                            } else {
                                sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                            }
                        })
                    } else {
                        sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                    }
                }
                else
                    sendResp.sendCustomJSON(null, req, res, false, data, "Visitor Log Entry Failed!");
            });
        });
    },
    claimDailySpin : function(req,res){
        
    },    
    checkSpinToday: async function (req, res) {
        var appSecretKey = req.headers["x-nazara-app-secret-key"];
        let userToken = req.headers["authorization"];
        let app_id = req.body.appid ? req.body.appid : null;
        let channel = req.body.channel;
        let playerInfo = await userModel.getUserDetailPromise(userToken);
        let player_id = playerInfo.playerId;
        console.log(playerInfo)
        if (player_id == "") {
            sendResp.sendCustomJSON(null, req, res, false, [], "Token Invalid!");
        } else {
            let query = ` select * from tbl_wallet_credit_que  where player_id = ${player_id}
                        and event_type ='DAILY-BONUS'
                        and (add_date + (330 * interval '1 minute'))::date  = nowInd()::date `;
            let dbResult = await dbConnection.executeQueryAll(query, 'rmg_db');
            if (dbResult != null && dbResult != undefined && dbResult.length > 0) {
               if(dbResult[0].is_claim){

                var getSpinWheelquery = " select * from tbl_dailybonus_spin_master where  status = 'ACTIVE' and upper(channel) = '" + channel + "'";
                dbConnection.executeQuery(getSpinWheelquery, "rmg_db", function (err, spinwheelData) {
                    if (err || spinwheelData == undefined || spinwheelData.length == 0) {
                        sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong!");
                    } else {
                        data.isDailyBonus = true;
                        data.dailybonus = { credit_type: VisitRow.credit_type, amount: VisitRow.credit_bonus };
                      
                        data.spinWheel = spinwheelData;
                        // console.log('DAILY VISIT')
                        let insertDailyBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                            " (player_id, visit_datetime, fromtime, totime, " +
                            " credit_type, credit_bonus, is_credited,type,status,next_retry ) " +
                            " VALUES( " + playerId + ", now(), '00:00:00' " +
                            " , '00:00:00', '" + data.dailybonus.credit_type + "', " +
                            " " + data.dailybonus.amount + ", false,'DAILY-BONUS','ACTIVE',now());";
                        // console.log(insertDailyBonusLog)
                        dbConnection.executeQuery(insertDailyBonusLog, "rmg_db", function (err, visitLog) {
                            if (err) {
                                sendResp.sendCustomJSON(null, req, res, false, [], "Something got wrong!");
                            } else {
                                sendResp.sendCustomJSON(null, req, res, true, data, "Got Daily Bonus " + data.dailybonus.credit_type + "(" + data.dailybonus.amount + ")");
                            }
                        });
                    }
                });
               }else{
                sendResp.sendCustomJSON(null, req, res, false, [], "Come back tommarow!");
               }
            }else{
                sendResp.sendCustomJSON(null, req, res, false, [], "Come back tommarow!");
            }
        }
    }
}


function getRandomDailyBonus(data) {
    let validBonus = []
    let outRandom = 0;
    data.forEach(element => {
        if (element.isvalid) {
            validBonus.push(element);
        }
    });
    outRandom = randomIntFromInterval(0, validBonus.length - 1);
    return validBonus[outRandom];
}
function randomIntFromInterval(min, max) // min and max included
{
    return Math.floor(Math.random() * (max - min + 1) + min);
}