var webAppRoutes = express.Router();
var authToken = require('../auth/auth'); 
var scratchCardController = require('../controller/scratchCardController');
var cors = require('cors'); 

 
webAppRoutes.get('/scratchcard/campaigns' ,scratchCardController.scratchCardContests);
webAppRoutes.post('/scratchcard/getscratchcards' ,scratchCardController.getScratchCards);
webAppRoutes.post('/scratchcard/claimscratchcards' ,scratchCardController.claimScratchCard);
webAppRoutes.post('/scratchcard/checkscratchcard' ,scratchCardController.checkscratchcard);
webAppRoutes.post('/scratchcard/winnerbanners' ,scratchCardController.scratchWinnerBanners);


module.exports = webAppRoutes;
