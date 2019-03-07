module.exports = {
    sendDBResponse: function (err, result, req, res, message, all) {

        var response = {};

        if (err) {
            res.writeHead(200, { 'Content-Type': 'json' });

            response.IsValidToken = true;
            response.Success = false;
            response.Message = 'Error occured to data base - ' + err.toString();
            response.Data = null;
            res.write(JSON.stringify(response, null) + "\n");
            res.end();
        }
        else {
            if (result.length > 0) {
                res.writeHead(200, { 'Content-Type': 'json' });

                response.IsValidToken = true;
                response.Success = true;
                response.Message = message;
                console.log(result);
                if (all) {
                    response.Data = result;
                } else {
                    if (result[0].data != null) {
                        response.Data = result[0].data;
                    }
                    else {
                        res.writeHead(200, { 'Content-Type': 'json' });

                        response.IsValidToken = true;
                        response.Success = false;
                        response.Message = "Details not found!";
                        response.Data = null;
                        res.write(JSON.stringify(response, null) + "\n");
                        res.end();
                    }

                }

                res.write(JSON.stringify(response, null) + "\n");
                res.end();
            }
            else {
                res.writeHead(200, { 'Content-Type': 'json' });

                response.IsValidToken = true;
                response.Success = false;
                response.Message = "Details not found!";
                response.Data = null;
                res.write(JSON.stringify(response, null) + "\n");
                res.end();
            }
        }
    },

    sendCustomJSON: function (err, req, res, isSuccess, customJSON, message, forceTrue,isTokenValid) {
        var response = {};
        // res.writeHead(200, { 'Content-Type': 'json' });
        // res.setHeader('Content-Type', 'application/json');
        response.IsValidToken = true;
        
        
        response.Success = isSuccess;
        response.Message = message;
        response.Data = customJSON;
        if (err) {
            response.Success = false;
            response.Message = err.toString();
        }
        //console.log(isTokenValid)
        if (isTokenValid != undefined && isTokenValid == false) {
            //console.log(isTokenValid + "|"+'HRRE')
            response.IsValidToken = false;
            response.Success = false;
            response.Message = "No Data Found";
        } else {
            if (!forceTrue) {
                if (customJSON != null && customJSON != undefined && customJSON.length == 0) {
                    response.Success = false;
                    response.Message = "No Data Found";
                }
            }
        }
        //console.log('HERE')
        if(!isSuccess){
            response.Success = false;
            response.Message = message;
        }
       // console.log( response)
        //res.write(JSON.stringify(response, null) + "\n");
        res.send(response)
        res.end();
    },


    sendResult: function (err, result, statuscode, res, message) {

        var response = {};

        if (err) {
            res.writeHead(statuscode, { 'Content-Type': 'json' });        
            response.Success = false;
            response.Message = message;
            response.Data = null;
            res.write(JSON.stringify(response, null) + "\n");
            res.end();
        }
        else {            
                res.writeHead(200, { 'Content-Type': 'json' });
                response.IsValidToken = true;
                response.Success = false;
                response.Message = message;
                response.Data = result;
                res.write(JSON.stringify(response, null) + "\n");
                res.end();
           
        }
    },

    sendResultShort: function(status,errCode,res){         
        res.send(status,{ resCode : errCode});
    }
}