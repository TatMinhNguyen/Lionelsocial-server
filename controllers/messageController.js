const ChatModel = require("../models/ChatModel");
const MessageModel = require("../models/MessageModel");
const UserModel = require("../models/UserModel");
const { sendMessage, sendChats } = require("../socket/socket");
const imagekit = require("../utils/imagekitConfig");

const messageController = {
    addMessage : async (req, res) => {
        try {
            const { chatId, text } = req.body;
            const senderId = req.user.id;

            const chat = await ChatModel.findById(chatId)

            if(!chat){
                return res.status(404).json('Not Chat Found')
            }

            const checkSender = chat?.members.includes(senderId)

            if(!checkSender){
                return res.status(403).json("The user is not a member of this chat.")
            }

            // Upload ảnh lên ImageKit
            const imageUploadPromises = req.files.image ? imagekit.upload({
                file: req.files.image[0].buffer, // buffer video từ multer
                fileName: req.files.image[0].originalname,
                folder: '/images' // Thư mục lưu video
            }) : Promise.resolve(null);

            const [imageUploadResults] = await Promise.all([
                imageUploadPromises,
            ]);
    
            const imageUrl = imageUploadResults ? { 
                url: imageUploadResults.url, 
                fileId: imageUploadResults.fileId 
            } : null; 

            const message = new MessageModel({
                chatId,
                senderId,
                text,
                image: imageUrl,
            }); 
            
            chat.readBy = [];  // Xóa hết những người đã đọc

            chat.messageCount = chat.messageCount + 1;

            await chat.save()

            sendMessage(chat.members, message)
            sendChats(chat.members)

            const result = await message.save();
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json(error);
        }
    },
    deleteMessage : async (req, res) => {
        try {
            const userId = req.user.id;
            const messageId = req.params.messageId;

            const message = await MessageModel.findById(messageId)

            if(message.senderId != userId) {
                return res.status(404).json("bạn ko phải người gửi")
            }

            // Xóa image trên ImageKit
            const imageDeletionPromise = message.image ? imagekit.deleteFile(message.image.fileId)
                : Promise.resolve(null);

            // Chờ xóa tất cả các ảnh 
            await Promise.all([
                imageDeletionPromise
            ]);

            await MessageModel.findByIdAndDelete(messageId)

            return res.status(200).json({ message: "Mess deleted successfully" })
        } catch (error) {
            res.status(500).json(error);
        }
    },
    getMessages: async (req, res) => {
        const { chatId } = req.params;
        const { index, page } = req.query; // Nhận index và page từ query
        const limit = parseInt(index) || 5; // Số phần tử trong một trang, mặc định là 5
        const skip = ((parseInt(page) || 1) - 1) * limit; // Tính toán để bỏ qua số phần tử tương ứng
    
        try {
            // Tìm các tin nhắn theo chatId với giới hạn và phân trang
            const messages = await MessageModel.find({ chatId })
                .populate('senderId', 'username profilePicture')
                .skip(skip) // Bỏ qua số phần tử
                .limit(limit) // Lấy số phần tử nhất định
                .sort({ 
                    createdAt: -1 });
            
            res.status(200).json(messages);
        } catch (error) {
            res.status(500).json(error);
        }
    },

    checkMessages: async (req, res) => {
        try {
            const { chatId } = req.params;
            const userId = req.user.id; // ID của người đang thực hiện hành động
            
            const chat = await ChatModel.findById(chatId);
    
            if (!chat) {
                return res.status(404).json('Not Chat Found');
            }
    
            // Nếu người dùng chưa đánh dấu chat là đã đọc
            if (!chat.readBy.includes(userId)) {
                chat.readBy.push(userId);  // Thêm user vào mảng readBy
            }
    
            // Cập nhật chat mà không thay đổi `updatedAt`
            await chat.save({ timestamps: false });
    
            res.status(200).json({ message: "OK!" });
        } catch (error) {
            res.status(500).json(error);
        }
    }    
        
}

module.exports = messageController