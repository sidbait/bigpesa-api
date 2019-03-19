var webAppRoutes = express.Router();
var authToken = require('../auth/auth');
var userProfileController = require('../controller/userProfileController');
  

webAppRoutes.post('/userProfile', userProfileController.playerProfile)
webAppRoutes.post('/followPlayer',userProfileController.followPlayer);
webAppRoutes.post('/unfollowPlayer',userProfileController.unfollowPlayer);
webAppRoutes.get('/newPlayerOnboard', userProfileController.newPlayerOnboard)
module.exports = webAppRoutes;