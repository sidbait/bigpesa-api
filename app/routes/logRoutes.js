var webAppRoutes = express.Router();
var authToken = require('../auth/auth');
var logController = require('../controller/logController');

webAppRoutes.post('/log/visitorLog', logController.visitLog);
webAppRoutes.post('/log/bonusVisit',logController.bonusVisit);
webAppRoutes.post('/log/checkSpinToday',logController.checkSpinToday);
webAppRoutes.post('/log/claimDailySpin',logController.claimDailySpin);


module.exports = webAppRoutes;