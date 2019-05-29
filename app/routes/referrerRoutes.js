var referrerRoutes = express.Router();
var authToken = require('../auth/auth');
var referrerController = require('../controller/referrerController');
var cors = require('cors');

referrerRoutes.post('/playerEvents',  function(req, res)
{
    referrerController.playerEvents(req, res);
});
referrerRoutes.post('/referId',  function(req, res)
{
    referrerController.referId(req, res);
});
referrerRoutes.post('/claimEvent',function(req,res){
    referrerController.claimEvent(req, res);
});

referrerRoutes.post('/refererDetails',function(req,res){
    referrerController.refererDetails(req, res);
});
referrerRoutes.post('/claimRegisterEvent',function(req,res){
    referrerController.claimRegisterEvent(req, res);
});
 
referrerRoutes.post('/claimShareEvent',function(req,res){ 
    referrerController.claimShareEvent(req, res);
});
referrerRoutes.get('/referEvent',function(req,res){
    referrerController.referEvent(req, res);
})

referrerRoutes.post('/addReferrer', referrerController.addReferrer)
referrerRoutes.post('/getReferrerDetails', referrerController.getReferrerDetails)

module.exports = referrerRoutes;