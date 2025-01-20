const router = require("express").Router();

const userController = require("../controllers/userController");
const middleware = require("../middleware/index");
const upload = require("../middleware/multerConfig");

//GET PROFILE
router.get("/get-profile/:id", middleware.verifyToken, userController.getProfileUser)
router.get("/get-my-profile", middleware.verifyToken, userController.getMyProfileUser)

//UPDATE PROFILE
router.post("/update-profile", middleware.verifyToken, userController.updateProfile)

// Route upload avatar
router.post('/update-avatar', 
    upload.fields([{ name: 'image', maxCount: 1 }]), 
    middleware.verifyToken, 
    userController.uploadProfilePicture
);

// Route upload background
router.post('/update-background', 
    upload.fields([{ name: 'image', maxCount: 1 }]), 
    middleware.verifyToken, 
    userController.uploadBackgroundPicture
);

//Block
router.post('/block/:userId', middleware.verifyToken, userController.setBlock)

//UnBlock
router.post('/unblock/:userId', middleware.verifyToken, userController.setUnBlock)

//get block
router.get('/get-block', middleware.verifyToken, userController.getBlocks)

router.post('/report/:userId', middleware.verifyToken, userController.reportUser)

module.exports = router;