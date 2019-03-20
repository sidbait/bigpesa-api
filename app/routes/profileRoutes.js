var webAppRoutes = express.Router();
var authToken = require('../auth/auth');
var userProfileController = require('../controller/userProfileController');
  
webAppRoutes.post('/userProfile',authToken.validateAppReq, userProfileController.playerProfile)
webAppRoutes.post('/followPlayer',authToken.validateAppReq,userProfileController.followPlayer);
webAppRoutes.post('/unfollowPlayer',authToken.validateAppReq,userProfileController.unfollowPlayer);
webAppRoutes.post('/followerList',authToken.validateAppReq,userProfileController.followerList);
webAppRoutes.post('/followingList',authToken.validateAppReq,userProfileController.followingList);
webAppRoutes.get('/newPlayerOnboard',authToken.validateAppReq, userProfileController.newPlayerOnboard);

module.exports = webAppRoutes;