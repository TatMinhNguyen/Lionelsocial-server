const groupController = require("../controllers/groupController");
const postGroupController = require("../controllers/postGroupController");
const middleware = require("../middleware");
const upload = require("../middleware/multerConfig");
const PostGroupModel = require("../models/PostGroupModel");

const router = require("express").Router();

router.post('/create-group', middleware.verifyToken, groupController.createGroup)

router.get('/get-a-group/:groupId', middleware.verifyToken, groupController.getAGroup)

router.get('/get-suggest', middleware.verifyToken, groupController.getSuggestGroup)

router.get('/get-user-group', middleware.verifyToken, groupController.getUserGroups)

router.get('/get-members/:groupId', middleware.verifyToken, groupController.getMembers)

router.get('/get-pending-members/:groupId', middleware.verifyToken, groupController.getPendingMembers)

router.post('/add-members/:groupId', middleware.verifyToken, groupController.addMembers)

router.post('/remove-members/:groupId', middleware.verifyToken, groupController.removeMember)

router.post('/leave-group/:groupId', middleware.verifyToken, groupController.leaveGroup)

router.post('/join-group/:groupId', middleware.verifyToken, groupController.joinGroup)

router.post('/cancel-join/:groupId', middleware.verifyToken, groupController.cancelJoinGroup)

router.delete('/delete-group/:groupId', middleware.verifyToken, groupController.deleteGroup)

router.post('/accept-members/:groupId/:requestId', middleware.verifyToken, groupController.approveRequest)

router.post('/refuse-members/:groupId/:requestId', middleware.verifyToken, groupController.refuseRequest)

router.post('/change-avatar/:groupId', 
    upload.fields([{name: 'image', maxCount:1}]),
    middleware.verifyToken,
    groupController.uploadGroupPicture
)

router.post('/change-name/:groupId', middleware.verifyToken, groupController.editGroup)

router.get('/get-suggest-user', middleware.verifyToken, groupController.getSuggestionUser)

router.post('/search-suggest-user', middleware.verifyToken, groupController.searchSuggestionUser)
router.post('/search-invite-user/:groupId', middleware.verifyToken, groupController.searchInviteUser)

router.post('/create-post/:groupId',
    upload.fields([{name: 'images'}, { name: 'video', maxCount: 1 }]),
    middleware.verifyToken,
    postGroupController.createPost
)

router.post(
    '/update-a-post/:postId',
    upload.fields([{ name: 'images'}, { name: 'video', maxCount: 1 }]),
    middleware.verifyToken, 
    postGroupController.updatePost
)

router.delete('/delete-post/:groupId/:postId', middleware.verifyToken, postGroupController.deletePost)

router.get(
    '/get-all-posts/:groupId', 
    middleware.verifyToken, 
    middleware.paginatedResult(PostGroupModel),
    postGroupController.getPosts
)

router.get('/get-a-post/:postId', middleware.verifyToken, postGroupController.getAPost)
router.get('/get-pending-post/:groupId', middleware.verifyToken, postGroupController.getPendingPost)

router.post('/report-post/:postId', middleware.verifyToken, postGroupController.reportPost);

router.get('/get-post-reported/:groupId', middleware.verifyToken, postGroupController.getPostReported)
router.get('/get-detail-report/:postId', middleware.verifyToken, postGroupController.getContentReport)

router.post('/keep-post/:postId', middleware.verifyToken, postGroupController.keepPost)

router.post('/report-group/:groupId', middleware.verifyToken, groupController.reportGroup)

module.exports = router;