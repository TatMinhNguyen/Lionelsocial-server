const router = require("express").Router();

const middleware = require("../middleware/index")
const postController = require("../controllers/postController");
const upload = require("../middleware/multerConfig");
const PostModel = require("../models/PostModel");

router.post('/create-post',  
            upload.fields([{ name: 'images'}, { name: 'video', maxCount: 1 }]), 
            middleware.verifyToken,
            postController.createPost
        )

router.delete('/delete-post/:postId', middleware.verifyToken, postController.deletePost)

router.get(
    '/get-all-posts', 
    middleware.verifyToken, 
    middleware.paginatedResult(PostModel),
    postController.getPosts
)

router.get(
    '/get-friend-posts',
    middleware.verifyToken,
    middleware.paginatedResult(PostModel),
    postController.getFriendPosts
)

router.get('/get-a-post/:postId', middleware.verifyToken, postController.getAPost)

router.get(
    '/get-user-post/:userId', 
    middleware.verifyToken, 
    middleware.paginatedResult(PostModel),
    postController.getUserPost
)

router.post(
    '/update-a-post/:postId',
    upload.fields([{ name: 'images'}, { name: 'video', maxCount: 1 }]),
    middleware.verifyToken, 
    postController.updatePost
)

router.post('/report-post/:postId', middleware.verifyToken, postController.reportPost)

module.exports = router;
