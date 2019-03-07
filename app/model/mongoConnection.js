module.exports = {
    mongofind: function (collection, jsonwhr, lim, callback) {
        var db = app.get('mongodb');
        var collection = db.collection(collection);
        if (lim == 0) {
            collection.find(jsonwhr).toArray(function (err, docs) {
                callback(err, docs)
            });
        } else {
            collection.find(jsonwhr).limit(lim).toArray(function (err, docs) {
                callback(err, docs)
            });
        }
    },
    mongofindwithdb: function (db, collection, jsonwhr, lim, callback) {
        var db = app.get(db);
        var collection = db.collection(collection);
        if (lim == 0) {
            collection.find(jsonwhr).toArray(function (err, docs) {
                callback(err, docs)
            });
        } else {
            collection.find(jsonwhr).limit(lim).toArray(function (err, docs) {
                callback(err, docs)
            });
        }
    },
    mongofindwithoutid: function (collection, jsonwhr, lim, callback) {
        var db = app.get('mongodb');
        var collection = db.collection(collection);
        if (lim == 0) {
            collection.find(jsonwhr, { _id: 0 }).toArray(function (err, docs) {
                callback(err, docs)
            });
        } else {
            collection.find(jsonwhr, { _id: 0 }).limit(lim).toArray(function (err, docs) {
                callback(err, docs)
            });
        }
    },
    mongoinsert: function (collection, insjson, callback) {
        var db = app.get('mongodb');
        var collection = db.collection(collection);
        collection.insertMany([
            insjson
        ], function (err, result) {
            console.log("Inserted");
            callback(result);
        });
    },
    mongoupdateone: function (dbname, collection, findjson, updatejson, callback) {
        var db = app.get(dbname);
        var collection = db.collection(collection);
        collection.updateOne(findjson
            , { $set: updatejson }, function (err, result) {
                callback(err, result);
            });
    },
    mongoinsertOne: function (dbname, collection, insjson, callback) {
        var db = app.get(dbname);
        var collection = db.collection(collection);
        collection.insertOne(insjson, function (err, result) {
            callback(err, result);
        });
    },
    mongoRemoveByid: function (dbname, collection, deljson, callback) {
        var db = app.get(dbname);
        var collection = db.collection(collection);
        collection.remove(deljson, function (err, result) {
            callback(err, result);
        });
    },
    mongoinsertwithdb: function (db, collection, insjson, callback) {
        var db = app.get(db);
        var collection = db.collection(collection);
        collection.insertMany([
            insjson
        ], function (err, result) {
            console.log("Inserted");
            callback(err, result);
        });
    },
    mongogroup: function (db, collection, insjson, callback) {
        var db = app.get(db);
        var collection = db.collection(collection);
        collection.aggregate(insjson).toArray(function (err, docs) {
            if (err) {
                callback(err);
            }
            //console.log(docs);
            callback(null, docs);
        });
    }
}