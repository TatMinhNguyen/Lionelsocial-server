const chatController = require("../controllers/chatController");
const messageController = require("../controllers/messageController");
const middleware = require("../middleware");
const upload = require("../middleware/multerConfig");

const router = require("express").Router();

router.post("/create-chat/:member", middleware.verifyToken, chatController.createChat);

router.post('/create-group-chat', middleware.verifyToken, chatController.createGroupChat);

router.get('/get-user-chat', middleware.verifyToken, chatController.userChats)

router.get('/get-a-chat/:chatId', middleware.verifyToken, chatController.getAChat)

router.post("/add-message",
    upload.fields([{ name: 'image', maxCount: 1}]), 
    middleware.verifyToken,
    messageController.addMessage
)

router.delete('/delete-message/:messageId', middleware.verifyToken, messageController.deleteMessage)

router.get('/get-message/:chatId', middleware.verifyToken, messageController.getMessages)

router.get('/get-members/:chatId', middleware.verifyToken, chatController.getMembers)

router.post('/add-members/:chatId', middleware.verifyToken, chatController.addMembersToGroupChat)

router.post('/delete-members/:chatId', middleware.verifyToken, chatController.removeMemberFromGroupChat)

router.post('/leave-group/:chatId', middleware.verifyToken, chatController.leaveGroupChat)

router.delete('/delete-group/:chatId', middleware.verifyToken, chatController.deleteGroupChat)

router.post('/change-avatar/:chatId', 
    upload.fields([{name: 'image', maxCount:1}]),
    middleware.verifyToken,
    chatController.changeChatPhoto
)

router.post('/change-name/:chatId', middleware.verifyToken, chatController.changeChatName)

router.post('/search-user/:chatId', middleware.verifyToken, chatController.searchUsers)

router.post('/search-members', middleware.verifyToken, chatController.searchMembers)

router.post('/check-message/:chatId', middleware.verifyToken, messageController.checkMessages);

module.exports = router;