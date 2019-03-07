module.exports = {
    ExecuteQuery: function (query, callback) {
        var pg = require('pg');
        var pgConnectUrl = config.connectionString.postgre;
        var pgClient = new pg.Client(pgConnectUrl);
        pg.connect(pgConnectUrl, (err, client, done) => {
            // Handle connection errors
            if (err) {
                console.log(err);
                callback(err, null);
            }
            // SQL Query > Select Data
            client.query(query, function (err, result) {

                done();

                if (err) {
                    console.log('Connection Error - ' + err);
                    callback(err, null);
                }
                else {
                    if (result == undefined) {
                        callback(err, result);
                    } else {
                        callback(null, result.rows);
                    }
                }
            });
        });

    },

    Execute_DBQuery: function (query, database, callback) {
        var pg = require('pg');

        var pgConnectUrl = '';

        if (database.toLowerCase() == "cdr")
            pgConnectUrl = config.cdr_connectionString.postgre;
        else if (database.toLowerCase() == "subscription")
            pgConnectUrl = config.subscription_connectionString.postgre;
        else
            pgConnectUrl = config.connectionString.postgre;

        var pgClient = new pg.Client(pgConnectUrl);

        pg.connect(pgConnectUrl, (err, client, done) => {
            // Handle connection errors
            if (err) {
                console.log(err);
                callback(err, null);
            }
            // SQL Query > Select Data
            client.query(query, function (err, result) {

                done();

                if (err) {
                    console.log('Connection Error - ' + err);
                    callback(err, null);
                }
                else {
                    if (result == undefined) {
                        callback(err, result);
                    } else {
                        callback(null, result.rows);
                    }
                }
            });
        });
    }
}