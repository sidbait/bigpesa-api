var config = require('config');
var logger = require('tracer').colorConsole();
var dbConnection = require('../model/dbConnection');
var useragent = require('useragent');
var sendResp = require('../service/send');
var userModel = require('../model/UserModel');

module.exports = {

    visitorLog: function (req, res) {
        visitorLog(req, res);
    }
}

async function visitorLog(req, res) {
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
    let browser_version = req.body.browser_version ? req.body.browser_version : '';
    var userToken = req.headers["authorization"];
    var playerId = "";
    try {
        let userdetails = await userModel.getUserDetailPromise(userToken);

        if (userdetails.playerId == "") {
            sendResp.sendCustomJSON(null, req, res, false, data, "Invalid Token!");
        } else {
            playerId = userdetails.playerId;
            if (playerId == "") {
                playerId = null;
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
                "(phone_number, user_agent, device_name, agency_source, " +
                "agency_name, agency_para, agency_pubid, referer, referer_id, " +
                "referer_url, ip_address, os_name, os_version, browser, browser_version, visit_date,playerid) " +
                "VALUES('" + phone_number + "', '" + user_agent + "', '" + device_name + "', '" + agency_source + "', " +
                " '" + agency_name + "', '" + agency_para + "', '" + agency_pubid + "', '" + referer + "', '" + referer_id + "', " +
                " '" + referer_url + "', '" + ip_address + "', '" + os_name + "', " +
                " '" + os_version + "', '" + browser + "', '" + browser_version + "', " +
                "  now()," + playerId + ")  RETURNING visitor_id;";
            var result = await dbConnection.executeQueryPromise(visitor_query, "rmg_db");
            if (result.err) {
                sendResp.sendCustomJSON(null, req, res, false, [], "Visitor Log Entry Failed!");
            } else {
                var data = { visitor_id: null };
                data.isVisitBonus = false;
                data.isDailyBonus = false;
                if (result.result == null || result.result == undefined) {
                    data = { visitor_id: null };
                } else if (result.result.length == 0) {
                    data = { visitor_id: null };
                } else if (result.result[0].visitor_id) {
                    data = { visitor_id: result.result[0].visitor_id };
                } else {
                    data = { visitor_id: null };
                }
                if (data.visitor_id != null) {
                    if (playerId != null) {
                        let chkQeury = 'select  tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' tbl_visitbonus_master.fromtime, ' +
                            ' tbl_visitbonus_master.totime, ' +
                            ' count(*) from tbl_visitors ' +
                            ' inner join tbl_visitbonus_master ' +
                            ' on  tbl_visitors.visit_date::time ' +
                            ' between tbl_visitbonus_master.fromtime::time  ' +
                            ' and tbl_visitbonus_master.totime::time ' +
                            ' where  playerid = ' + playerId + '   ' +
                            ' and now()::time between tbl_visitbonus_master.fromtime::time ' +
                            ' and tbl_visitbonus_master.totime::time   ' +
                            ' group by tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' tbl_visitbonus_master.fromtime, ' +
                            ' tbl_visitbonus_master.totime  ' +
                            ' union all ' +
                            ' select  tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus, ' +
                            ' \'20:00:00\'::time as fromtime, \'20:00:00\'::time as totime,  ' +
                            ' count(*) from tbl_visitors ' +
                            ' inner join tbl_visitbonus_master  on  ' +
                            ' tbl_visitbonus_master.type = \'DAILY\' ' +
                            ' where  playerid = ' + playerId + ' ' +
                            ' group by tbl_visitbonus_master.credit_type, ' +
                            ' tbl_visitbonus_master.credit_bonus order by count asc';

                        var result = await dbConnection.executeQueryPromise(chkQeury, "rmg_db");
                        if (result.err) {
                            sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                        } else {
                            result = result.result;
                        }
                        if (result != null && result.length > 0) {
                            if (result[0].count == 1) {
                                let insertVisitBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                    " (player_id, visit_datetime, fromtime, totime, " +
                                    " credit_type, credit_bonus, is_credited,type ) " +
                                    " VALUES( " + playerId + ", now(), '" + result[0].fromtime + "' " +
                                    " , '" + result[0].totime + "', '" + result[0].credit_type + "', " +
                                    " " + result[0].credit_bonus + ", false,'TIMESLOT');"
                                console.log(insertVisitBonusLog);
                                var ress = await dbConnection.executeQueryPromise(insertVisitBonusLog, "rmg_db");
                                if (ress.err) {
                                    sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                } else {
                                    ress = ress.result;

                                    let visitLogQuery = "select distinct tbl_visitbonus_master.fromtime,tbl_visitbonus_master.totime, " +
                                        " tbl_visitbonus_master.credit_type,tbl_visitbonus_master.credit_bonus , " +
                                        " case when tbl_visit_bonus_log.id is null then false else true end as isearn, " +
                                        " case " +
                                        " when now()::time between tbl_visitbonus_master.fromtime and tbl_visitbonus_master.totime " +
                                        " then true else false end as Active " +
                                        " from tbl_visitbonus_master  " +
                                        " left join tbl_visit_bonus_log on " +
                                        " tbl_visit_bonus_log.fromtime = tbl_visitbonus_master.fromtime " +
                                        " and tbl_visit_bonus_log.totime = tbl_visitbonus_master.totime " +
                                        " and tbl_visit_bonus_log.player_id = " + playerId + " " +
                                        " and visit_datetime::date = now()::date " +
                                        " where tbl_visitbonus_master.type = 'TIMESLOT' order by  tbl_visitbonus_master.fromtime asc ";
                                    console.log(visitLogQuery)
                                    var visitLog = await dbConnection.executeQueryPromise(visitLogQuery, "rmg_db");
                                    if (ress.err) {
                                        sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                                    } else {
                                        visitLog = visitLog.result;
                                        let data = {};
                                        data.isVisitBonus = true;
                                        data.bonusLog = visitLog;
                                        data.visitbonus = { credit_type: result[0].credit_type, amount: result[0].credit_bonus };
                                        if (result[1] != undefined && result[1].count == 1) {
                                            let insertDailyBonusLog = "INSERT INTO public.tbl_visit_bonus_log " +
                                                " (player_id, visit_datetime, fromtime, totime, " +
                                                " credit_type, credit_bonus, is_credited,type ) " +
                                                " VALUES( " + playerId + ", now(), '00:00:00' " +
                                                " , '00:00:00', '" + result[1].credit_type + "', " +
                                                " " + result[1].credit_bonus + ", false,'DAILY');";
                                            var visitLog = await dbConnection.executeQueryPromise(insertDailyBonusLog, "rmg_db");
                                            if (visitLog.err) {

                                                sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + result[0].credit_type + "(" + result[0].credit_bonus + ")");
                                            } else {
                                                visitLog = visitLog.result;
                                                data.isDailyBonus = true;
                                                data.dailybonus = { credit_type: result[1].credit_type, amount: result[1].credit_bonus };;
                                                sendResp.sendCustomJSON(null, req, res, true, data, "Got Daily Bonus " + result[0].credit_type + "(" + result[0].credit_bonus + ")");
                                            }
                                        } else {
                                            sendResp.sendCustomJSON(null, req, res, true, data, "Got Visit Bonus " + result[0].credit_type + "(" + result[0].credit_bonus + ")");
                                        }
                                    }
                                }
                            } else {
                                sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                            }
                        } else {
                            sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                        }
                    } else {
                        sendResp.sendCustomJSON(null, req, res, true, data, "Visitor Log Entry Success!");
                    }
                }
                else {
                    sendResp.sendCustomJSON(null, req, res, false, data, "Visitor Log Entry Failed!");
                }
            }
        }
    } catch (error) {
        sendResp.sendCustomJSON(null, req, res, false, data, "Visitor Log Entry Failed!");
    }
}