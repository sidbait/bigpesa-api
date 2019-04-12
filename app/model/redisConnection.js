var redis = require("redis");

if (process.env.NODE_ENV == "production" || process.env.NODE_ENV == "preprod") {
    client = redis.createClient( 6379,"192.168.5.128",  { no_ready_check: true });//6379, "172.31.23.190", { no_ready_check: true }
}else{
    client = redis.createClient(); 
}
var isRedis = false;

client.on("error", function (err) {
    console.log("Error COming in redits " + err);
    isRedis = false;
});
client.on("connect", function (err) {
    console.log('Connected')
    isRedis = true;
});
module.exports = {
    GetRedis: function (key, callback) {
        if (isRedis) {
            client.get(key, function (err, reply) {
                callback(err, reply);
            });
        }
        else {
            callback(true, null);
        }
    },
    SetRedis: function (key, val, expiretime, callback) {
        if (isRedis) {
            client.set(key, val, redis.print);
            client.expire(key, expiretime);
            callback('done')
        } else {
            callback('error')
        }
    },
    setRedisPromise: function (key, val, expiretime) {
        return new Promise(function (resolve, reject) {

            setRedis(key, val, expiretime, function (err, out) {
                if (err) {
                    reject(err);
                } else {
                    resolve(out);
                }
            })

        })
    },
    getRedisPromise: function (key) {
        return new Promise(function (resolve, reject) {
            getRedis(key, function (err, value) {
                if (err) {
                    reject(err);
                } else {
                    resolve(value);
                }
            });
        });
    }
}
function setRedis(key, val, expiretime, callback) {
    if (isRedis) {
        client.set(key, val, redis.print);
        if (expiretime != null && expiretime != undefined) {
            client.expire(key, expiretime);
        }
        callback(null, 'done')
    } else {
        callback(true, 'error')
    }
}
function getRedis(key, callback) {
    if (isRedis) {
        client.get(key, function (err, reply) {
            callback(err, reply);
        });
    }
    else {
        console.log('isRedis' + isRedis)
        callback(true, null);
    }
}