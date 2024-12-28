const ChatModel = require("../models/ChatModel");
const MessageModel = require("../models/MessageModel");
const UserModel = require("../models/UserModel");
const { sendChats, sendMessage } = require("../socket/socket");
const imagekit = require("../utils/imagekitConfig");

function removeVietnameseTones(str) {
    return str
        .normalize('NFD') // Tách các ký tự có dấu
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

const chatController = {
    // create chat 2 people
    createChat : async (req, res) =>{
        const users = await UserModel.findById(req.user.id);
        const memberId1 = users.id;
        const memberId2 = req.params.member;

        // Kiểm tra xem phòng chat với hai thành viên đã tồn tại hay chưa
        const existingChat = await ChatModel.findOne({
            members: { $all: [memberId1, memberId2], $size: 2 } 
        });

        if (existingChat) {
            return res.status(403).json({ error: 'Phòng chat đã tồn tại', chatId: existingChat._id }); 
        }

        else{
            const newChat = new ChatModel({ 
                members: [memberId1, memberId2]
            });
        
            try{
                const resul = await newChat.save();
                return res.status(200).json(resul);
            }catch (error){
                return res.status(500).json({ message: "Lỗi server", error });
            }
        }    
    }, 

    createGroupChat : async (req, res) => {
        try {
            const { members, name } = req.body;
            const createId = req.user.id;

            if (!members.includes(createId)) {
                members.push(createId);
            }
    
            // Kiểm tra số lượng thành viên
            if (!members || members.length < 3) {
                return res.status(400).json({ message: "Nhóm chat phải có ít nhất 3 thành viên." });
            }
    
            // Tạo nhóm chat mới
            const newChat = new ChatModel({
                members,
                name,
                createId,
            });

            sendChats(newChat.members)
    
            await newChat.save();
    
            return res.status(201).json({ message: "Tạo nhóm chat thành công", chat: newChat });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },
    
    // Get chat from user    
    userChats: async (req, res) => {
        try {
            // Lấy danh sách các đoạn chat mà user có tham gia
            let chats = await ChatModel.find({
                members: { $in: [req.user.id] }
            }).sort({ 
                updatedAt: -1 });
    
            // Duyệt qua từng đoạn chat
            const updatedChats = await Promise.all(
                chats.map(async (chat) => {
                    const chatId = chat._id;
                    const firstMessage = await MessageModel.findOne({ chatId })
                        .select('senderId text image')
                        .populate('senderId', 'username profilePicture')
                        .sort({ createdAt: -1 });

                    // Nếu đoạn chat không có tên
                    if (!chat.name) {
                        let chatObject = chat.toObject();
                        delete chatObject.avatar;

                        // Tìm userId còn lại trong đoạn chat
                        const otherUserId = chat.members.find((id) => id.toString() !== req.user.id);
                        
                        // Truy vấn thông tin của user đó từ UserModel
                        const otherUser = await UserModel.findById(otherUserId).select('_id username profilePicture');
                        
                        // Thêm thông tin user vào chat
                        return {
                            ...chatObject,
                            firstMessage,
                            name: otherUser?.username,
                            avatar: otherUser?.profilePicture,
                            userId: otherUser?._id
                        };
                    } else {
                        if (chat.createId) {
                            let chatObject = chat.toObject();
    
                            // Truy vấn thông tin của người tạo từ UserModel
                            const creatorUser = await UserModel.findById(chat.createId).select('_id username profilePicture');
    
                            // Thêm thông tin người tạo vào chat
                            return {
                                ...chatObject,
                                firstMessage,
                                // creatorUsername: creatorUser?.username,
                                // creatorAvatar: creatorUser?.profilePicture,
                            };
                        }
                    }
                    return chat.toObject(); // Giữ nguyên nếu đã có tên
                })
            );
    
            res.status(200).json(updatedChats);
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },
    getAChat: async (req, res) => {
        try {
            const chatId = req.params.chatId;
    
            const chat = await ChatModel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ message: "Chat not found" });
            }
    
            if (!chat.name) {
                let chatObject = chat.toObject();
                delete chatObject.avatar;
    
                // Tìm userId còn lại trong đoạn chat
                const otherUserId = chat.members.find((id) => id.toString() !== req.user.id);
    
                // Truy vấn thông tin của user đó từ UserModel
                const otherUser = await UserModel.findById(otherUserId).select('_id username profilePicture');
    
                // Thêm thông tin user vào chat
                return res.json({
                    ...chatObject,
                    name: otherUser?.username,
                    avatar: otherUser?.profilePicture,
                    userId: otherUser?._id
                });
            }
    
            if (chat.createId) {
                let chatObject = chat.toObject();
    
                // Truy vấn thông tin của người tạo từ UserModel
                const creatorUser = await UserModel.findById(chat.createId).select('_id username profilePicture');
    
                // Thêm thông tin người tạo vào chat
                return res.json({
                    ...chatObject,
                    creatorUsername: creatorUser?.username,
                    creatorAvatar: creatorUser?.profilePicture,
                });
            }
    
            // Trường hợp khác (ví dụ như chat có `name` và không cần thêm gì)
            return res.json(chat);
    
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    getMembers: async (req, res) => {
        try {
          const chatId = req.params.chatId;
          const chat = await ChatModel.findById(chatId).select('members'); 
          
          if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
          }
      
          const memberIds = chat.members; 
          const members = await UserModel.find({ _id: { $in: memberIds } }).select('id username profilePicture'); 
      
          return res.status(200).json( members );
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    searchUsers: async (req, res) => {
        try {
            const userId = req.user.id;
            const searchInput = req.body.searchInput; // Lấy từ khóa tìm kiếm từ query params

            const chatId = req.params.chatId;
            const chat = await ChatModel.findById(chatId).select('members'); 
            
            if (!chat) {
              return res.status(404).json({ error: 'Chat not found' });
            }
            const memberIds = chat.members; 
            
            // Loại bỏ dấu tiếng Việt khỏi từ khóa tìm kiếm
            const searchKeyword = removeVietnameseTones(searchInput).toLowerCase();
            
            // Tìm tất cả người dùng có username khớp với từ khóa tìm kiếm
            const users = await UserModel.find(
                { isVerify: true,  _id: { $nin: [...memberIds, userId] }, isAdmin: { $ne: true }},
                { 
                    _id: 1, 
                    username: 1, 
                    profilePicture: 1, 
                    isVerify: 1
                }
            ).sort({ createdAt: -1 })
            .then(users => {
                return users.filter(user => {
                    const username = removeVietnameseTones(user.username).toLowerCase();
                    return username.includes(searchKeyword);
                });
            });

            // Kết quả tìm kiếm người dùng
            const userResults = users.map(user => {              
                return {
                    userId: user._id,
                    username: user.username,
                    profilePicture: user.profilePicture,
                };
            });
            return res.status(200).json(userResults);
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    searchMembers: async(req, res) => {
        try {
            const userId = req.user.id;
            const searchInput = req.body.searchInput; // Lấy từ khóa tìm kiếm từ query params
            
            // Loại bỏ dấu tiếng Việt khỏi từ khóa tìm kiếm
            const searchKeyword = removeVietnameseTones(searchInput).toLowerCase();
            
            // Tìm tất cả người dùng có username khớp với từ khóa tìm kiếm
            const users = await UserModel.find(
                { isVerify: true,  _id: { $nin: userId }, isAdmin: { $ne: true }},
                { 
                    _id: 1, 
                    username: 1, 
                    profilePicture: 1, 
                    isVerify: 1
                }
            ).sort({ createdAt: -1 })
            .then(users => {
                return users.filter(user => {
                    const username = removeVietnameseTones(user.username).toLowerCase();
                    return username.includes(searchKeyword);
                });
            });

            // Kết quả tìm kiếm người dùng
            const userResults = users.map(user => {              
                return {
                    userId: user._id,
                    username: user.username,
                    profilePicture: user.profilePicture,
                };
            });
            return res.status(200).json(userResults);
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }        
    },

    addMembersToGroupChat: async (req, res) => {
        try {
            const { chatId } = req.params; // Lấy ID của nhóm chat từ params
            const { newMembers } = req.body; // Nhận danh sách các thành viên mới từ body
            const userId = req.user.id; // ID của người thực hiện yêu cầu
    
            // Kiểm tra nếu không có thành viên mới nào được gửi lên
            if (!newMembers || newMembers.length === 0) {
                return res.status(400).json({ message: "Không có thành viên nào để thêm vào nhóm chat." });
            }
    
            // Tìm nhóm chat bằng chatId
            const chat = await ChatModel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ message: "Không tìm thấy nhóm chat." });
            }
    
            // Kiểm tra xem người dùng có phải là thành viên của nhóm không
            if (!chat.members.includes(userId)) {
                return res.status(403).json({ message: "Bạn không phải là thành viên của nhóm chat này." });
            }
    
            // Lọc danh sách thành viên mới chưa có trong nhóm
            const addedMembers = [];
            newMembers.forEach(member => {
                if (!chat.members.includes(member)) {
                    chat.members.push(member);
                    addedMembers.push(member); // Lưu lại những người thực sự được thêm vào
                }
            });
    
            // Nếu không có ai mới được thêm vào, không cần tạo tin nhắn
            if (addedMembers.length === 0) {
                return res.status(200).json({ message: "Tất cả các thành viên đã có trong nhóm." });
            }
    
            // Truy vấn để lấy thông tin username của các thành viên mới
            const users = await UserModel.find({ _id: { $in: addedMembers } }, 'username'); // Chỉ lấy trường username
            const usernames = users.map(user => user.username); // Lấy danh sách username
    
            // Tạo nội dung thông báo ai được thêm vào nhóm
            const addedMembersText = usernames.join(', ');
            const notificationMessage = `${addedMembersText} has been added to the chat group.`;
    
            // Tạo tin nhắn thông báo
            const message = new MessageModel({
                chatId: chat._id,
                senderId: '66fbc2e6e600beb492a84969', // Người gửi là người thực hiện thêm
                text: notificationMessage,
                image: null,
            });

            chat.readBy = [];

            sendMessage(chat.members, message)
            sendChats(chat.members)
    
            // Lưu lại nhóm chat và tin nhắn
            await chat.save();
            await message.save();
    
            return res.status(200).json({ message: "Thêm thành viên vào nhóm chat thành công" });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },
    
    
    removeMemberFromGroupChat: async (req, res) => {
        try {
            const { chatId } = req.params; // Lấy ID của nhóm chat từ params
            const { memberId } = req.body; // Nhận ID của thành viên cần xóa từ body
            const userId = req.user.id; // ID của người thực hiện yêu cầu
    
            // Tìm nhóm chat bằng chatId
            const chat = await ChatModel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ message: "Không tìm thấy nhóm chat." });
            }
    
            // Kiểm tra quyền: chỉ người tạo nhóm chat mới có quyền xóa thành viên
            if (chat.createId.toString() !== userId) {
                return res.status(403).json({ message: "Bạn không có quyền xóa thành viên khỏi nhóm chat này." });
            }
               
            // Kiểm tra nếu thành viên cần xóa có trong nhóm
            if (!chat.members.includes(memberId)) {
                return res.status(400).json({ message: "Thành viên không có trong nhóm chat." });
            }
    
            // Xóa thành viên khỏi danh sách
            chat.members = chat.members.filter(member => member.toString() !== memberId);

            const user = await UserModel.findById(memberId).select("username");
            const username = user.username;

            const notificationMessage = `${username} has been removed from the group chat by the group leader.`;
    
            // Tạo tin nhắn thông báo
            const message = new MessageModel({
                chatId: chat._id,
                senderId: '66fbc2e6e600beb492a84969', // Người gửi là người thực hiện thêm
                text: notificationMessage,
                image: null,
            });

            chat.readBy = [];

            sendMessage(chat.members, message)
            sendChats(chat.members)
    
            // Lưu lại nhóm chat và tin nhắn
            await chat.save();
            await message.save();
    
            return res.status(200).json({ message: "Xóa thành viên khỏi nhóm chat thành công" });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },
    
    leaveGroupChat: async (req, res) => {
        try {
            const { chatId } = req.params; // Lấy ID của nhóm chat từ params
            const userId = req.user.id; // ID của người thực hiện yêu cầu
    
            // Tìm nhóm chat bằng chatId
            const chat = await ChatModel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ message: "Không tìm thấy nhóm chat." });
            }
    
            // Kiểm tra nếu người dùng không phải là thành viên của nhóm
            if (!chat.members.map(member => member.toString()).includes(userId)) {
                return res.status(400).json({ message: "Bạn không phải là thành viên của nhóm chat này." });
            }
    
            // Nếu nhóm chỉ còn 3 người không cho phép rời nhóm
            if (chat.members.length === 3) {
                return res.status(400).json({ message: "Nhóm chat cần ít nhất 3 thành viên. Không thể rời nhóm." });
            }
    
            // Xóa thành viên khỏi danh sách
            chat.members = chat.members.filter(member => member.toString() !== userId);
    
            // Nếu người dùng rời là nhóm trưởng
            if (chat.createId.toString() === userId) {
                // Chuyển quyền nhóm trưởng cho một thành viên ngẫu nhiên còn lại
                if (chat.members.length > 0) {
                    chat.createId = chat.members[Math.floor(Math.random() * chat.members.length)];
                }
            }
    
            const user = await UserModel.findById(userId).select("username");
            const username = user.username;

            const notificationMessage = `${username} has left the group chat.`;
    
            // Tạo tin nhắn thông báo
            const message = new MessageModel({
                chatId: chat._id,
                senderId: '66fbc2e6e600beb492a84969', // Người gửi là người thực hiện thêm
                text: notificationMessage,
                image: null,
            });

            chat.readBy = [];

            sendMessage(chat.members, message)
            sendChats(chat.members)
    
            // Lưu lại nhóm chat và tin nhắn
            await chat.save();
            await message.save();
    
            return res.status(200).json({ message: "Rời nhóm chat thành công" });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    deleteGroupChat: async (req, res) => {
        try {
            const { chatId } = req.params; // Lấy ID của nhóm chat từ params
            const userId = req.user.id; // ID của người thực hiện yêu cầu
    
            // Tìm nhóm chat bằng chatId
            const chat = await ChatModel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ message: "Không tìm thấy nhóm chat." });
            }
    
            // Kiểm tra quyền: chỉ người tạo nhóm mới có quyền xóa nhóm
            if (chat.createId.toString() !== userId) {
                return res.status(403).json({ message: "Bạn không có quyền xóa nhóm chat này." });
            }
    
            // Xóa nhóm chat
            await ChatModel.findByIdAndDelete(chatId);
    
            return res.status(200).json({ message: "Xóa nhóm chat thành công." });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    changeChatPhoto: async (req, res) => {
        try {
            const chatId = req.params.chatId;
            const userId = req.user.id;

            // Tìm nhóm chat bằng chatId
            const chat = await ChatModel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ message: "Không tìm thấy nhóm chat." });
            }

            if (chat.createId.toString() !== userId) {
                return res.status(403).json({ message: "Bạn không có quyền thay đổi ảnh đại diện nhóm chat này." });
            }

            // Upload ảnh lên ImageKit
            const imageUploadPromises = req.files.image ? imagekit.upload({
                file: req.files.image[0].buffer, // buffer video từ multer
                fileName: req.files.image[0].originalname,
                folder: '/Chat' // Thư mục lưu video
            }) : Promise.resolve(null);

            const [imageUploadResults] = await Promise.all([
                imageUploadPromises,
            ]);
    
            const imageUrl = imageUploadResults ? 
                `${imageUploadResults.url}`
            : null; 

            chat.avatar = imageUrl

            const user = await UserModel.findById(userId).select("username");
            const username = user.username;

            const notificationMessage = `${username} has changed the group chat's profile picture.`;
    
            // Tạo tin nhắn thông báo
            const message = new MessageModel({
                chatId: chat._id,
                senderId: '66fbc2e6e600beb492a84969', // Người gửi là người thực hiện thêm
                text: notificationMessage,
                image: null,
            });

            chat.readBy = [];

            sendMessage(chat.members, message)
            sendChats(chat.members)
    
            // Lưu lại nhóm chat và tin nhắn
            await chat.save();
            await message.save();

            return res.status(200).json({ message: 'Upload successfully.'});
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },
    changeChatName : async (req, res) => {
        try {
            const chatId = req.params.chatId;
            const userId = req.user.id;
            const newName = req.body.newName;

            // Tìm nhóm chat bằng chatId
            const chat = await ChatModel.findById(chatId);
            if (!chat) {
                return res.status(404).json({ message: "Không tìm thấy nhóm chat." });
            }

            if (chat.createId.toString() !== userId) {
                return res.status(403).json({ message: "Bạn không có quyền thay đổi tên nhóm chat này." });
            }  
            
            chat.name = newName;

            const user = await UserModel.findById(userId).select("username");
            const username = user.username;

            const notificationMessage = `${username} changed the chat group name to ${newName}.`;
    
            // Tạo tin nhắn thông báo
            const message = new MessageModel({
                chatId: chat._id,
                senderId: '66fbc2e6e600beb492a84969', // Người gửi là người thực hiện thêm
                text: notificationMessage,
                image: null,
            });

            chat.readBy = [];

            sendMessage(chat.members, message)
            sendChats(chat.members)
    
            // Lưu lại nhóm chat và tin nhắn
            await chat.save();
            await message.save();

            return res.status(200).json({ message: 'Upload successfully.'});            
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    }
    
}  

module.exports = chatController;
