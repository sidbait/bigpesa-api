var dbConnection = require('./dbConnection');
var rp = require('request-promise'); 

module.exports = {
    sendPushOneSignal: function (mobile, title, msg) {         
        let url = "http://172.31.23.254:5010/api/notifications/sendNotification"
        var options = {
            method: 'POST',
            uri: url,
            form: {
                appId: "8a205a4c-49ec-435a-a8ab-f33dfe9faa55",
                title: title,
                content: msg,
                mobile: mobile
            },
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            json: false,
        };
        console.log(options)
        rp(options).then(data => {
            console.log(data)
        })
    },
    sendPushPlayerId: function (player_id, title, msg) {
       
        let getMobileNumber = 'select phone_number from tbl_player where player_id =' + player_id;
       // console.log(getMobileNumber)
        dbConnection.executeQuery(getMobileNumber, 'rmg_db', function (err, dbresult) {
            if (!err && dbresult != null && dbresult != undefined && dbresult.length > 0) {
                let phone_number = dbresult[0].phone_number;
                console.log('LooseMsg - '+phone_number + "|" + player_id + "|"+ title + "|"+ msg)
                let url = "http://172.31.23.254:5010/api/notifications/sendNotification"
                var options = {
                    method: 'POST',
                    uri: url,
                    form: {
                        appId: "8a205a4c-49ec-435a-a8ab-f33dfe9faa55",
                        title: title,
                        content: msg,
                        mobile: phone_number
                    },
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded'
                    },
                    json: false,
                };
                //console.log(options)
                rp(options).then(data => {
                    console.log(data)
                })
            }
        })
    }

}