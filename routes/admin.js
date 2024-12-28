const adminController = require("../controllers/adminController");
const middleware = require("../middleware");

const router = require("express").Router();

router.get('/get-post-reported', middleware.verifyToken, adminController.getPostReported)

router.post('/keep-post/:postId', middleware.verifyToken, adminController.keepPost)

router.delete('/delete-post/:postId', middleware.verifyToken, adminController.deletePost)

router.get('/get-report-post/:postId', middleware.verifyToken, adminController.getContentReport)

router.get('/get-reported-user', middleware.verifyToken, adminController.getReportedUsers)

router.post('/ban-user/:userId', middleware.verifyToken, adminController.setBan)

router.post('/unban-user/:userId', middleware.verifyToken, adminController.unBan)

router.get('/get-detail-report-user/:userId', middleware.verifyToken, adminController.getDetailReportUser)

router.get('/get-baners', middleware.verifyToken, adminController.getBannedUser)

router.get('/get-reported-group', middleware.verifyToken, adminController.getReportedGroup)

router.post('/keep-group/:groupId', middleware.verifyToken, adminController.keepGroup)

router.delete('/delete-group/:groupId', middleware.verifyToken, adminController.deleteGroup)

router.get('/get-detail-report-group/:groupId', middleware.verifyToken, adminController.getDetailReportedGroup)

module.exports = router;