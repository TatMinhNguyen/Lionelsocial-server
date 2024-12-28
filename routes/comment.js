const router = require("express").Router();
const upload = require("../middleware/multerConfig");
const middleware = require("../middleware");
const commentController = require("../controllers/commentController");
const CommentModel = require("../models/CommentModel");
const feelController = require("../controllers/feelController");

router.post(
    '/set-comment', 
    upload.fields([{ name: 'image', maxCount: 1 }]),
    middleware.verifyToken, 
    commentController.createComment
)

router.post(
    '/update-comment/:commentId',
    upload.fields([{ name: "image", maxCount: 1 }]),
    middleware.verifyToken,
    commentController.updateComment
)

router.delete('/delete-comment/:commentId', middleware.verifyToken, commentController.deleteComment)

router.get(
    '/get-comments/:postId',
    middleware.verifyToken,
    middleware.paginatedResult(CommentModel),
    commentController.getComment
)

router.post("/set-feel", middleware.verifyToken, feelController.setFell)

router.get("/get-feel/:postId", middleware.verifyToken, feelController.getFelt)

router.delete("/delete-feel/:postId", middleware.verifyToken, feelController.unFelt)

router.post("/update-feel/:postId", middleware.verifyToken, feelController.updateFelt)

module.exports = router;