var notificationRoutes = express.Router(); 
var notificationController = require('../controller/notificationController'); 
 

notificationRoutes.post('/fbRegister',notificationController.fbRegister);
notificationRoutes.post('/sendNotification',notificationController.sendNotificationAll);

module.exports = notificationRoutes;