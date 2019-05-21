var webAppRoutes = express.Router();
var authToken = require('../auth/auth'); 
var scratchCardController = require('../controller/scratchCardController');
var cors = require('cors'); 

 
webAppRoutes.get('/sratchcard/campaigns' ,scratchCardController.scratchCardContests);
webAppRoutes.post('/sratchcard/getscratchcards' ,scratchCardController.getScratchCards);
webAppRoutes.post('/sratchcard/claimscratchcards' ,scratchCardController.claimScratchCard);


module.exports = webAppRoutes;
