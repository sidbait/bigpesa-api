var webAppRoutes = express.Router();
var authToken = require('../auth/auth'); 
var scratchCardController = require('../controller/scratchCardController');
var cors = require('cors'); 

 
webAppRoutes.get('/sratchcard/campaigns' ,scratchCardController.scratchCardContests);
webAppRoutes.post('/sratchcard/getscratchcards' ,scratchCardController.getScratchCards);
webAppRoutes.post('/sratchcard/claimscratchcards' ,scratchCardController.claimScratchCard);
webAppRoutes.post('/sratchcard/checkscratchcard' ,scratchCardController.checkscratchcard);


module.exports = webAppRoutes;
