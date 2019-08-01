var request = require('request');
var config = require('config');
module.exports = {
    contestJoinEvent: function (loyalityToken, type) {
        if (loyalityToken != undefined && loyalityToken != null && loyalityToken != "") {
            var event_code = ""
            var domain = config.loyality_domain;
            if (type == "ONLY_REWARD") {
                event_code = "PLAY_FREE";
            } else {
                event_code = "PLAY_CASH";
            }
            try {
                var options = {
                    method: 'POST',
                    url: domain + 'event/claimEvent',
                    headers:
                    {
                        'access-token': loyalityToken,
                        'x-naz-app-key': 'asdsawrsadasdwxfadwfasq',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    form: { "event_code": event_code }
                };

                request(options, function (error, response, body) {
                    if (error) throw new Error(error);

                    console.log(body);
                });

            } catch (error) {
                console.log(error);
            }
        }
    }
}