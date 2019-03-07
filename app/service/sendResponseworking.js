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
            if ((result.length > 0) && (result[0].data != null)) {
                res.writeHead(200, { 'Content-Type': 'json' });

                response.IsValidToken = true;
                response.Success = true;
                response.Message = message;
                if (all) {
                    response.Data = result[0];
                } else {
                    response.Data = result[0].data;
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

    sendCustomJSON: function (err, result, req, res, isSuccess, customJSON, message) {

        var response = {};

        res.writeHead(200, { 'Content-Type': 'json' });

        response.IsValidToken = true;
        response.Success = isSuccess;
        response.Message = message;
        response.Data = customJSON;
        res.write(JSON.stringify(response, null) + "\n");
        res.end();
    },

    sendCompleteResult: function (err, result, req, res, message) {

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
                response.Data = result;
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
    }
}