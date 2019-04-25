
require('rootpath')();

var apiRoutes = express.Router();


//Master Module Route Files
var webappRoutes = require('../routes/webappRoutes');
var referrerRoutes = require('../routes/referrerRoutes');
var notificationRoutes = require('../routes/notificationRoutes');
var leaderBoardRoutes = require('../routes/leaderBoardRoutes');

var profileRoutes =require('./profileRoutes');

apiRoutes.get('/', function (req, res) {
    res.send('Welcome To Bigpesa')
});

//Master Module Routes
apiRoutes.use(webappRoutes);
apiRoutes.use(referrerRoutes);
apiRoutes.use(notificationRoutes);
apiRoutes.use(profileRoutes);
apiRoutes.use(leaderBoardRoutes);
module.exports = apiRoutes;

