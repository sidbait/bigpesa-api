var dbConnection = require('../model/dbConnection');
var services = require('../service/service');
var userModel = require('../model/UserModel');
var sendResp = require('../service/send');
module.exports = {
    popupCheck: function (req, res) {
        var userToken = req.headers["authorization"];
        userModel.getUserDetails(userToken,async function (err, userDetails) {
            if (err) {
                playerId = "";
            } else {
                playerId = userDetails.playerId;
            }
            if (playerId != "") {
              let queryPopupList = `  select * from tbl_popup_master 
              where status = 'ACTIVE' and popup_segment = 'home_screen' 
              and from_date < nowInd() and to_date > nowInd() `;
                let dbResult = await dbConnection.executeQueryAll(queryPopupList,'rmg_db',true,5000);
               if(dbResult !=null && dbResult !=undefined && dbResult.length >0){
                   var popupOut = [];
                   var callbackCount = 0;
                   dbResult.forEach(async popupToCheck => {
                       let checkpopupQuery = ` select * from fn_check_popup(${popupToCheck.id},${playerId})`;
                       console.log(checkpopupQuery)
                       let checkpopupOut = await dbConnection.executeQueryAll(checkpopupQuery, 'rmg_db');
                       callbackCount = callbackCount + 1;
                       console.log(checkpopupOut[0].data[0])
                       if (checkpopupOut != null && checkpopupOut != undefined && checkpopupOut.length > 0) {
                           if (checkpopupOut[0].data[0].v_canshow) {
                               popupOut.push(popupToCheck);
                           }
                       }
                       if (callbackCount == dbResult.length) {
                           if (popupOut.length > 0) {
                               console.log('out')
                               sendResp.sendCustomJSON(null, req, res, true, popupOut, "No Popup Available");
                           } else {
                               console.log('out')
                               sendResp.sendCustomJSON(null, req, res, false, null, "No Popup Available");
                           }
                       }
                   });             
               }else{
                sendResp.sendCustomJSON(null, req, res, false,null,  "No Popup Available");
               }
                
            } else {
                sendResp.sendCustomJSON(null, req, res, false, null, "Invalid Token");
            }
        });
    }
}