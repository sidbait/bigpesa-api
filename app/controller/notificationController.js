var dbConnection = require('../model/dbConnection')
var services = require('../service/service');
var fcm = require('fcm-notification');
var json = require('../../fcmConfig/bigpesa-ionic-firebase-adminsdk.json');
var FCM = new fcm(json);
module.exports = {

    sendNotificationAll: async function (req, res) {
        var rules = {
            title: "required",
            msg: 'required'
        };
        var validation = new services.validator(req.body, rules);

        if (validation.passes()) {
            var result = await dbConnection.executeQueryAll("select fb_id from tbl_fb_not_details", "rmg_db");
            var Tokens = [];
            var title = req.body.title;
            var msg = req.body.msg;
            console.log(result)
            if (result != null && result != undefined && result.length != 0) {
                result.forEach(element => {
                    Tokens.push(element.fb_id)
                });

                var message = {
                    data: {
                     
                    },
                    notification: {
                        title: title,
                        body: msg                         
                    },
                    android: {
                      ttl: 3600 * 1000,
                      notification: {
                        icon: 'https://homepages.cae.wisc.edu/~ece533/images/boat.png',
                        color: '#f45342',
                      },
                    }
                };
                FCM.sendToMultipleToken(message, Tokens, function (err, response) {
                    if (err) {
                        console.log('err--', err);
                    } else {
                        console.log('response-----', response);
                    }

                })
            }
        } else {

        }
        res.send('ok')
    },
    fbRegister: async function (req, res) {
        let userToken = req.headers["authorization"];
        let playerDetails = await userModel.getUserDetailPromise(userToken);
        let fb_token = req.body.fbtoken;
        let player_id = playerDetails.playerId;
        let query = "insert into tbl_fb_not_details (player_id,fb_id,created_at) values " +
            " ( " + player_id + ", '" + fb_token + "' , now() ) ON conflict (player_id) do update  " +
            " set fb_id = '" + fb_token + "' where tbl_fb_not_details.player_id = " + player_id + " ";
        console.log(query)
        let result = await dbConnection.executeQueryOnlyResolve(query, 'rmg_db');
        res.send('ok')
    }
}