var webAppRoutes = express.Router();
var authToken = require('../auth/auth');
var userProfileController = require('../controller/userProfileController');
  

webAppRoutes.post('/userProfile',authToken.validateAppReq, userProfileController.playerProfile)
webAppRoutes.post('/followPlayer',authToken.validateAppReq,userProfileController.followPlayer);
webAppRoutes.post('/unfollowPlayer',authToken.validateAppReq,userProfileController.unfollowPlayer);
webAppRoutes.get('/newPlayerOnboard',authToken.validateAppReq, userProfileController.newPlayerOnboard);

module.exports = webAppRoutes;