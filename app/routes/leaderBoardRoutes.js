var webAppRoutes = express.Router();
var authToken = require('../auth/auth');
var leaderBoardController = require('../controller/leaderBoardController');

webAppRoutes.post('/leaderboard/gameWise',
    authToken.validateAppReq,
    authToken.AuthorizationCheck,
    leaderBoardController.gameWiseLeaderBoard);

webAppRoutes.post('/leaderboard/allGames',
    authToken.validateAppReq,
    authToken.AuthorizationCheck,
    leaderBoardController.gameWiseLeaderBoard);

module.exports = webAppRoutes;