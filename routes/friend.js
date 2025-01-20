const router = require("express").Router();
const friendController = require("../controllers/friendController");
const middleware = require("../middleware");

//Gợi ý kết bạn
router.get("/get-suggest-friends", middleware.verifyToken, friendController.getSuggestFriends)

//Gửi lời mời kết bạn
router.post("/request-friend/:userId", middleware.verifyToken, friendController.requestFriend)

//Chấp nhận kết bạn
router.post("/accepet-friend/:userId", middleware.verifyToken, friendController.acceptFriend)

//Hủy lời mời kết bạn
router.post("/cancel-request-friend/:userId", middleware.verifyToken, friendController.cancelRequestFriend)

//Hủy  kết bạn
router.post("/cancel-friend/:userId", middleware.verifyToken, friendController.cancelFriend)

//Từ chối kết bạn
router.post("/refuse-friend/:userId", middleware.verifyToken, friendController.refuseFriend)

//get friend
router.get("/get-friends/:userId", middleware.verifyToken, friendController.getFriends)

//get lời mời kết bạn
router.get("/get-requested", middleware.verifyToken, friendController.getFriendsRequested)

//get mutual
router.get("/get-mutual-friends/:userId", middleware.verifyToken, friendController.getMutualFriends)

module.exports = router;