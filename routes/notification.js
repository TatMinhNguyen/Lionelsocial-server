const notificationController = require("../controllers/notificationController");
const middleware = require("../middleware");

const router = require("express").Router();

router.get('/get-notification', middleware.verifyToken, notificationController.getNotification)

router.post('/check-notification/:notificationId', middleware.verifyToken, notificationController.checkNotification)

module.exports = router;