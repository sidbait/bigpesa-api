var webAppRoutes = express.Router();
var authToken = require('../auth/auth');
var webappController = require('../controller/webappController');
var logController = require('../controller/logController');
var fileuploadController = require('../controller/fileuploadController');

var cors = require('cors');

webAppRoutes.get('/appListing', function (req, res) {
    webappController.appListing(req, res);
});
webAppRoutes.post('/appContests', authToken.validateAppReq, function (req, res) {
    webappController.appContests(req, res);
});
webAppRoutes.post('/playerContest', function (req, res) {
    webappController.playerContest(req, res);
});
webAppRoutes.post('/contestResult', function (req, res) {
    webappController.contestResult(req, res);
});
webAppRoutes.post('/playerTransaction', authToken.validateAppReq, authToken.AuthorizationCheck, function (req, res) {
    webappController.playerTransaction(req, res);
});
webAppRoutes.post('/getWinningAmount', authToken.validateAppReq, authToken.AuthorizationCheck, function (req, res) {
    webappController.getWinningAmount(req, res);
});
webAppRoutes.post('/postContestScore', function (req, res) {
    webappController.postContestScore(req, res);
});
webAppRoutes.post('/updateAppStatus', function (req, res) {
    webappController.updateAppStatus(req, res);
});
webAppRoutes.post('/checkAppStatus', authToken.validateAppReq, authToken.AuthorizationCheck, function (req, res) {
    webappController.checkAppStatus(req, res);
});
webAppRoutes.post('/joinContest', authToken.validateAppReq, authToken.AuthorizationCheck, function (req, res) {
    webappController.joinContest(req, res);
});
webAppRoutes.get('/filedownload', cors(), function (req, res) {
    webappController.dowloadFile(req, res);
});
webAppRoutes.get('/leaderboard', authToken.validateAppReq, authToken.AuthorizationCheck, function (req, res) {
    webappController.leaderBoard(req, res);
});
webAppRoutes.post('/updateAppStatusSdk', function (req, res) {
    webappController.updateAppStatusSdk(req, res);
});

webAppRoutes.post('/updatePoints', function (req, res) {
    webappController.updatePoints(req, res);
});
webAppRoutes.post('/claimToEarn', function (req, res) {
    webappController.claimToEarn(req, res);
});
webAppRoutes.post('/pendingClaim', function (req, res) {
    webappController.pendingClaim(req, res);
});
webAppRoutes.post('/postHtmlScore', function (req, res) {
    webappController.postHtmlScore(req, res);
});
webAppRoutes.post('/visitorLog', function (req, res) {
    logController.visitorLog(req, res);
});
webAppRoutes.post('/postScore', function (req, res) {
    console.log('postScore');
    webappController.postScore(req, res);
});
// webAppRoutes.post('/postScore',function(req, res){
//     webappController.postScore(req, res);
// });
webAppRoutes.get('/game/data/:token', function (req, res) {
    webappController.checkToken(req, res);
});
webAppRoutes.post('/game/score/:token/:score',authToken.validateAppReq, function (req, res) {
    console.log('game/score/:token/:score');
    webappController.postScoreNew(req, res);
});
webAppRoutes.post('/game/cheat/:token', function (req, res) {
    webappController.cheatApi(req, res);
});
webAppRoutes.get('/game/leaderboard/:token', webappController.getLeaderboard);

webAppRoutes.post('/game/token/:contestid', webappController.getSessionToken);

webAppRoutes.post('/user/token/:token', webappController.getUserDetailsSessionToken);

webAppRoutes.get('/user/user/:token', webappController.getPlayerInfoFromToken);

webAppRoutes.post('/downloadlog', logController.downloadLog); 

webAppRoutes.post('/getFeedback', webappController.getFeedback);

webAppRoutes.get('/getBanners', authToken.validateAppReq, webappController.getBanners);

webAppRoutes.get('/checkVersion', webappController.checkVersion);

webAppRoutes.get('/redumptionMaster', function (req, res) {
    webappController.redumptionMaster(req, res);
});
webAppRoutes.get('/getEvents', function (req, res) {
    webappController.getEvents(req, res);
});
webAppRoutes.get('/getAllEvents', function (req, res) {
    webappController.getAllEvents(req, res);
});
webAppRoutes.get('/topgamewinner',webappController.topGameWinnerList)
webAppRoutes.get('/checkisprouser/:device_id', logController.checkisProUser)
webAppRoutes.post('/fileupload', fileuploadController.upload);


module.exports = webAppRoutes;
