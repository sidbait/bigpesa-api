var pg = require('pg');
var logger = require('tracer').colorConsole();
var config = require('config');
var redisConnection = require('./redisConnection');
var pool_rmg_db = null;
pool_rmg_db = new pg.Pool(config.db_connectionString.cockroach);
console.log(config.db_connectionString.cockroach)
module.exports = {

    executeQuery: function (query, database, callback, cache, cahetime) {
        executeQuery(query, database, callback, cache, cahetime);
    },
    executeQueryOnlyResolve: function (query, database, cache, cahetime) {
        return new Promise(function (resolve, reject) {
            executeQuery(query, database, function (err, result) {
                let output = { err: err, result: result }
                resolve(output);
            }, cache, cahetime);
        })
    },
    executeQueryAll: function (query, database, cache, cahetime) {
        return new Promise(function (resolve, reject) {
            executeQuery(query, database, function (err, result) {
                if (err) {
                    reject(err)
                } else {
                    resolve(result);
                }
            }, cache, cahetime);
        })
    }
}

function executeQuery(query, database, callback, cache, cahetime) {
    let pool = null;
    if (database.toLowerCase() == "rmg_db") {
        pool = pool_rmg_db;
    }
    console.log(pool)
    let key = query;
    if (query.indexOf('tbl_token.player_id = tbl_player.player_id where token =') > 0) {
        key = 'Auth:' + query.substring(query.indexOf('TOKEN'), query.length);
        //console.log(key)
    }

    if (!cache) {
        if (pool == null) {
            logger.info("DB pull not available for database - ", database);
            callback("DB pull not available!", null);
        }
        else {
            pool.connect(function (err, client, done) {

                done();

                // logger.info("--------DB QUERY CONNECT--------\n" +
                //     "query - " + query + "\n" +
                //     'err - ' + JSON.stringify(err) + "\n")

                if (err) {
                    logger.info("Could not connect to cockroachdb |  Database - "
                        + database + " | Error - ", err);
                }
                else {
                    client.query(query, function (err, result) {

                        // logger.info("--------DB QUERY RESULT--------\n" +
                        //     "query - " + query + "\n" +
                        //     'err - ' + JSON.stringify(err) + "\n" +
                        //     'result - ' + JSON.stringify(result) + "\n")

                        if (err) {
                            callback(err, null);
                        }
                        else {
                            if (result == undefined) {
                                callback(err, null);
                            } else {
                                callback(null, result.rows);
                            }
                        }
                    });
                }
            });
        }
    } else {
        //console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
        redisConnection.GetRedis(key, function (err, value) {
            if (err) {
                console.log('Error In redit So query if PG')
                if (pool == null) {
                    logger.info("DB pull not available for database - ", database);
                    callback("DB pull not available!", null);
                }
                else {
                    pool.connect(function (err, client, done) {
                        done();
                        // logger.info("--------DB QUERY CONNECT--------\n" +
                        //     "query - " + query + "\n" +
                        //     'err - ' + JSON.stringify(err) + "\n")        
                        if (err) {
                            logger.info("Could not connect to cockroachdb |  Database - "
                                + database + " | Error - ", err);
                            callback(err, null);
                        }
                        else {
                            client.query(query, function (err, result) {
                                // logger.info("--------DB QUERY RESULT--------\n" +
                                //     "query - " + query + "\n" +
                                //     'err - ' + JSON.stringify(err) + "\n" +
                                //     'result - ' + JSON.stringify(result) + "\n")        
                                if (err) {
                                    callback(err, null);
                                }
                                else {
                                    if (result == undefined) {
                                        callback(err, null);
                                    } else {
                                        callback(null, result.rows);
                                    }
                                }
                            });
                        }
                    });
                }
            } else {
                if (value == null) {

                    if (pool == null) {
                        logger.info("DB pull not available for database - ", database);
                        callback("DB pull not available!", null);
                    }
                    else {
                        pool.connect(function (err, client, done) {
                            done();
                            // logger.info("--------DB QUERY CONNECT--------\n" +
                            //     "query - " + query + "\n" +
                            //     'err - ' + JSON.stringify(err) + "\n")        
                            if (err) {
                                logger.info("Could not connect to cockroachdb |  Database - "
                                    + database + " | Error - ", err);
                                callback(err, null);
                            }
                            else {
                                client.query(query, function (err, result) {
                                    // logger.info("--------DB QUERY RESULT--------\n" +
                                    //     "query - " + query + "\n" +
                                    //     'err - ' + JSON.stringify(err) + "\n" +
                                    //     'result - ' + JSON.stringify(result) + "\n")        
                                    if (err) {
                                        callback(err, null);
                                    }
                                    else {
                                        if (result == undefined) {
                                            var results = JSON.stringify(result);
                                            redisConnection.SetRedis(key, results, cahetime, function () { })
                                            callback(err, result);
                                        } else {
                                            var results = JSON.stringify(result.rows);
                                            redisConnection.SetRedis(key, results, cahetime, function () { })
                                            callback(null, result.rows);
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
                else {
                    var results = JSON.parse(value);
                    callback(null, results);
                }
            }
        });
    }
}