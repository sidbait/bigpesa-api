let pgconnection = require('./app/model/dbConnection');

let query = 'Select * from tbl_app';

pgconnection.executeQuery(query,'rmg_db',function(err,dbResult){
    console.log(err)
    console.log(dbResult)
})