const GroupModel = require("../models/GroupModel");
const NotificationModel = require("../models/NotificationModel");
const ReportGroupModel = require('../models/ReportGroupModel')
const UserModel = require("../models/UserModel");
const { sendNotification } = require("../socket/socket");
const imagekit = require("../utils/imagekitConfig");

function removeVietnameseTones(str) {
    return str
        .normalize('NFD') // Tách các ký tự có dấu
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

const groupController = {
    createGroup : async (req, res) => {
        try {
            const { members, name, type } = req.body;
            const createId = req.user.id;

            if (!members.includes(createId)) {
                members.push(createId);
            }
    
            // Tạo nhóm group mới
            const newGroup = new GroupModel({
                members,
                name,
                createId,
                type
            });

            await newGroup.save();

            const receivers = members.filter(member => member.toString() !== createId)

            const notification = new NotificationModel({
                sender: createId,
                receiver: receivers,
                type: 'invite-members',
                groupId: newGroup._id,
                message: `invited you to join group ${newGroup.name}.`
            })

            await notification.save();

            const populatedNotification = await NotificationModel.findById(notification._id)
            .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
            // .populate('postId', 'description')               // Populate thông tin bài viết
            .populate('commentId', 'content')                // Populate thông tin comment
            .exec();

            sendNotification(receivers, populatedNotification)
    
            return res.status(201).json({ message: "Tạo nhóm thành công", group: newGroup });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },
    getAGroup : async(req, res) => {
        try {
            const groupId = req.params.groupId;

            const group = await GroupModel.findById(groupId)
            if(!group) {
                return res.status(404).json({ message: "Not found group" })
            }

            return res.status(200).json(group)
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    getSuggestGroup : async (req, res) => {
        try {
            const currentUserId = req.user.id;
    
            // Tìm các nhóm mà người dùng hiện tại chưa tham gia
            const suggestedGroups = await GroupModel.find({
                members: { $ne: currentUserId }
            })
    
            return res.status(200).json( suggestedGroups );
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    getUserGroups : async (req, res) => {
        try {
            const currentUserId = req.user.id;
    
            // Tìm các nhóm mà người dùng hiện tại đã tham gia
            const groups = await GroupModel.find({
                members: { $in: [currentUserId] }
            })
    
            return res.status(200).json(groups);
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    getMembers: async (req, res) => {
        try {
          const groupId = req.params.groupId;
          const group = await GroupModel.findById(groupId).select('members'); 
          
          if (!group) {
            return res.status(404).json({ error: 'group not found' });
          }
      
          const memberIds = group.members; 
          const members = await UserModel.find({ _id: { $in: memberIds } }).select('id username profilePicture'); 
      
          res.status(200).json( members );
        } catch (error) {
          res.status(500).json(error);
        }
    },

    addMembers: async (req, res) => {
        try {
            const { groupId } = req.params; 
            const { newMembers } = req.body; 
            const userId = req.user.id; 
    
            // Kiểm tra nếu không có thành viên mới nào được gửi lên
            if (!newMembers || newMembers.length === 0) {
                return res.status(400).json({ message: "Không có thành viên nào để thêm vào nhóm group." });
            }
    
            const group = await GroupModel.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Không tìm thấy nhóm group." });
            }
    
            // Kiểm tra xem người dùng có phải là thành viên của nhóm không
            if (!group.members.includes(userId)) {
                return res.status(403).json({ message: "Bạn không phải là thành viên của nhóm group này." });
            }
            
            if(group.type === false){
                if(group.createId.toString() === userId) {
                    // Thêm thành viên mới nếu chưa có trong danh sách thành viên của nhóm
                    newMembers.forEach(member => {
                        if (!group.members.includes(member)) {
                            group.members.push(member);
                        }
                        const index = group.pendingMembers.indexOf(member);
                        if (index !== -1) {
                            group.pendingMembers.splice(index, 1); // Xóa 1 phần tử tại vị trí index
                        }
                    });  
                    // const receivers = group.members.filter(member => member.toString() !== group.createId)

                    const notification = new NotificationModel({
                        sender: userId,
                        receiver: newMembers,
                        type: 'invite-members',
                        groupId: group._id,
                        message: `invited you to join group ${group.name}.`
                    })
        
                    await notification.save();
        
                    const populatedNotification = await NotificationModel.findById(notification._id)
                    .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
                    // .populate('postId', 'description')               // Populate thông tin bài viết
                    .populate('commentId', 'content')                // Populate thông tin comment
                    .exec();
        
                    sendNotification(newMembers, populatedNotification)              
                }else{
                    newMembers.forEach(member => {
                        if (!group.pendingMembers.includes(member)) {
                            group.pendingMembers.push(member);
                        }
                    });     
                }                
            }
            else{
                newMembers.forEach(member => {
                    if (!group.members.includes(member)) {
                        group.members.push(member);
                    }
                }); 
                const notification = new NotificationModel({
                    sender: userId,
                    receiver: newMembers,
                    type: 'invite-members',
                    groupId: group._id,
                    message: `invited you to join group ${group.name}.`
                })
    
                await notification.save();
    
                const populatedNotification = await NotificationModel.findById(notification._id)
                .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
                // .populate('postId', 'description')               // Populate thông tin bài viết
                .populate('commentId', 'content')                // Populate thông tin comment
                .exec();
    
                sendNotification(newMembers, populatedNotification)                
            }

            // Lưu lại nhóm group
            await group.save();
    
            return res.status(200).json({ message: "Thêm thành viên vào nhóm group thành công" });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },
    removeMember: async (req, res) => {
        try {
            const { groupId } = req.params; 
            const { memberId } = req.body; 
            const userId = req.user.id;
    
           
            const group = await GroupModel.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Không tìm thấy nhóm group." });
            }
    
            // Kiểm tra quyền: chỉ người tạo nhóm group mới có quyền xóa thành viên
            if (group.createId.toString() !== userId) {
                return res.status(403).json({ message: "Bạn không có quyền xóa thành viên khỏi nhóm group này." });
            }
               
            // Kiểm tra nếu thành viên cần xóa có trong nhóm
            if (!group.members.includes(memberId)) {
                return res.status(400).json({ message: "Thành viên không có trong nhóm group." });
            }
    
            // Xóa thành viên khỏi danh sách
            group.members = group.members.filter(member => member.toString() !== memberId);
    
            // Lưu lại nhóm group
            await group.save();
    
            return res.status(200).json({ message: "Xóa thành viên khỏi nhóm group thành công" });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    leaveGroup: async (req, res) => {
        try {
            const { groupId } = req.params; // Lấy ID của nhóm group từ params
            const userId = req.user.id; // ID của người thực hiện yêu cầu
    
            // Tìm nhóm group bằng groupId
            const group = await GroupModel.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Không tìm thấy nhóm group." });
            }
    
            // Kiểm tra nếu người dùng không phải là thành viên của nhóm
            if (!group.members.map(member => member.toString()).includes(userId)) {
                return res.status(400).json({ message: "Bạn không phải là thành viên của nhóm group này." });
            }
    
            if (group.members.length === 1) {
                await GroupModel.findByIdAndDelete(groupId);
                return res.status(200).json({ message: "Rời nhóm thành công và nhóm đã bị xóa vì không còn thành viên nào." });
            }
    
            // Xóa thành viên khỏi danh sách
            group.members = group.members.filter(member => member.toString() !== userId);
    
            // Nếu người dùng rời là nhóm trưởng
            if (group.createId.toString() === userId) {
                // Chuyển quyền nhóm trưởng cho một thành viên ngẫu nhiên còn lại
                if (group.members.length > 0) {
                    group.createId = group.members[Math.floor(Math.random() * group.members.length)];
                }
            }
    
            // Lưu lại nhóm group
            await group.save();
    
            return res.status(200).json({ message: "Rời nhóm group thành công" });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    joinGroup : async (req, res) => {
        try {
            const { groupId } = req.params; // Lấy ID của nhóm từ params
            const userId = req.user.id; // ID của người dùng hiện tại
    
            // Tìm nhóm bằng groupId
            const group = await GroupModel.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Không tìm thấy nhóm." });
            }
    
            // Kiểm tra nếu người dùng đã là thành viên của nhóm
            if (group.members.includes(userId)) {
                return res.status(400).json({ message: "Bạn đã là thành viên của nhóm này." });
            }
    
            // Thêm người dùng vào danh sách thành viên
            if(group.type === true) {
                group.members.push(userId);

                const notification = new NotificationModel({
                    sender: userId,
                    receiver: [group.createId],
                    type: 'join-group',
                    groupId: group._id,
                    message: `has joined your group ${group.name}.`
                })
    
                await notification.save();
    
                const populatedNotification = await NotificationModel.findById(notification._id)
                .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
                // .populate('postId', 'description')               // Populate thông tin bài viết
                .populate('commentId', 'content')                // Populate thông tin comment
                .exec();
    
                sendNotification([group.createId], populatedNotification)
            }else {
                if(!group.pendingMembers.includes(userId)){
                    group.pendingMembers.push(userId) 

                    const notification = new NotificationModel({
                        sender: userId,
                        receiver: [group.createId],
                        type: 'request-group',
                        groupId: group._id,
                        message: `sends a request to join your group ${group.name}.`
                    })
        
                    await notification.save();
        
                    const populatedNotification = await NotificationModel.findById(notification._id)
                    .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
                    // .populate('postId', 'description')               // Populate thông tin bài viết
                    .populate('commentId', 'content')                // Populate thông tin comment
                    .exec();
        
                    sendNotification([group.createId], populatedNotification)
                }  
            }
            
            // Lưu lại nhóm
            await group.save();
    
            return res.status(200).json({ group });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error: error.message });
        }
    },

    cancelJoinGroup: async (req, res) => {
        try {
            const { groupId } = req.params; // Lấy ID của nhóm từ params
            const userId = req.user.id; 

            const group = await GroupModel.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Không tìm thấy nhóm." });
            }

            // Kiểm tra nếu người dùng không phải là thành viên của nhóm
            if (!group.pendingMembers.map(member => member.toString()).includes(userId)) {
                return res.status(400).json({ message: "Bạn không phải là thành viên của nhóm group này." });
            }

            group.pendingMembers = group.pendingMembers.filter(member => member.toString() !== userId);

            await group.save();
    
            return res.status(200).json({ message: "Rời nhóm group thành công" });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    deleteGroup: async (req, res) => {
        try {
            const { groupId } = req.params; // Lấy ID của nhóm group từ params
            const userId = req.user.id; // ID của người thực hiện yêu cầu
    
            // Tìm nhóm group bằng groupId
            const group = await GroupModel.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Không tìm thấy nhóm group." });
            }
    
            // Kiểm tra quyền: chỉ người tạo nhóm mới có quyền xóa nhóm
            if (group.createId.toString() !== userId) {
                return res.status(403).json({ message: "Bạn không có quyền xóa nhóm group này." });
            }
    
            // Xóa nhóm group
            await GroupModel.findByIdAndDelete(groupId);
    
            return res.status(200).json({ message: "Xóa nhóm group thành công." });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    // Admin accept members join
    approveRequest: async (req, res) => {
        const userId = req.user.id;
        const groupId = req.params.groupId;
        try{
            const group = await GroupModel.findById(groupId);
            
            const requestId = req.params.requestId; // ID của yêu cầu cần phê duyệt
            const index = group.pendingMembers.indexOf(requestId);

            if (index === -1) {
                return res.status(404).json("Request not found");
            }

            if(userId !== group.createId.toString()) {
                return res.status(403).json("You're not the admin of this group")
            }

            // Xóa yêu cầu từ danh sách pendingMembers
            group.pendingMembers.splice(index, 1);

            // Thêm thành viên vào danh sách members
            group.members.push(requestId);

            await group.save();

            const notification = new NotificationModel({
                sender: userId,
                receiver: [requestId],
                type: 'accept-group',
                groupId: group._id,
                message: `has approved you for group ${group.name}.`
            })

            await notification.save();

            const populatedNotification = await NotificationModel.findById(notification._id)
            .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
            // .populate('postId', 'description')               // Populate thông tin bài viết
            .populate('commentId', 'content')                // Populate thông tin comment
            .exec();

            sendNotification([requestId], populatedNotification)

            return res.status(200).json("Request approved successfully");
        }
        catch (err) {
            return res.status(500).json(`ERROR: ${err}`);
        }
    },

    refuseRequest: async (req, res) => {
        const userId = req.user.id;
        const groupId = req.params.groupId;
        try{
            const group = await GroupModel.findById(groupId);
            
            const requestId = req.params.requestId; // ID của yêu cầu cần phê duyệt
            const index = group.pendingMembers.indexOf(requestId);

            if (index === -1) {
                return res.status(404).json("Request not found");
            }

            if(userId !== group.createId.toString()) {
                return res.status(403).json("You're not the admin of this group")
            }

            // Xóa yêu cầu từ danh sách pendingMembers
            group.pendingMembers.splice(index, 1);

            await group.save();

            return res.status(200).json("Request refuse successfully");
        }
        catch (err) {
            return res.status(500).json(`ERROR: ${err}`);
        }
    },

    getPendingMembers: async (req, res) => {
        try {
            const groupId = req.params.groupId;
            const group = await GroupModel.findById(groupId).select('pendingMembers'); 
            
            if (!group) {
              return res.status(404).json({ error: 'group not found' });
            }
        
            const memberIds = group.pendingMembers; 
            const members = await UserModel.find({ _id: { $in: memberIds } }).select('id username profilePicture'); 
        
            res.status(200).json( members );
          } catch (error) {
            res.status(500).json(error);
        }
    },

    uploadGroupPicture: async (req, res) => {
        try {
            const userId = req.user.id;

            const group = await GroupModel.findById(req.params.groupId);

            if (!group) {
                return res.status(404).json({ message: 'Group not found' });
            }

            if (group.createId.toString() !== userId) {
                return res.status(404).json({message: 'You are not admin'})
            }

            // Upload ảnh lên ImageKit
            const imageUploadPromises = req.files.image ? imagekit.upload({
                file: req.files.image[0].buffer,
                fileName: req.files.image[0].originalname,
                folder: '/Group' 
            }) : Promise.resolve(null);

            const [imageUploadResults] = await Promise.all([
                imageUploadPromises,
            ]);
    
            const imageUrl = imageUploadResults ? 
                `${imageUploadResults.url}`
             : null; 

            // Lưu URL ảnh vào profile của group
            group.avatar = imageUrl;

            await group.save();
            return res.status(200).json({ message: 'Upload picture successfully.'});

        } catch (error) {
            return res.status(500).json({ message: 'Có lỗi xảy ra.', error: error.message });
        }
    },

    editGroup: async (req, res) => {
        try {
            const userId = req.user.id;
            const {name, type} = req.body;

            const group = await GroupModel.findById(req.params.groupId);

            if (!group) {
                return res.status(404).json({ message: 'Group not found' });
            }

            if (group.createId.toString() !== userId) {
                return res.status(404).json({message: 'You are not admin'})
            }

            group.name = name;
            group.type = type;
            
            await group.save();

            return res.status(201).json({ message: 'update successfully.'})
            
        } catch (error) {
            return res.status(500).json({ message: 'Có lỗi xảy ra.', error: error.message });
        }
    },

    getSuggestionUser: async (req, res) => {
        try {
            const userId = req.user.id;
    
    
            // Tìm người dùng phù hợp với điều kiện
            const suggestedUsers = await UserModel.find(
                { 
                    _id: { $ne: userId },
                    isVerify: true, // Chỉ lấy những người dùng đã xác thực
                    isAdmin: { $ne: true }
                },
                { 
                    _id: 1, 
                    username: 1, 
                    profilePicture: 1, 
                    friends: 1, // Lấy danh sách bạn bè để tính toán bạn chung
                    friendsCount: 1, 
                    isVerify: 1
                }
            ).sort({ 
                createdAt: -1 });;
    
            const suggestedUsersWithMutualFriends = suggestedUsers.map(user => {
                return {
                    _id: user._id,
                    username: user.username,
                    profilePicture: user.profilePicture,
                };
            });
    
            // Giới hạn kết quả trả về tối đa 20 người dùng
            const topSuggestedUsers = suggestedUsersWithMutualFriends.slice(0, 20);
    
            return res.status(200).json(topSuggestedUsers);
        } catch (error) {
            return res.status(500).json({ message: 'Có lỗi xảy ra.', error: error.message });
        }
    },

    searchSuggestionUser: async(req, res) => {
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
                    _id: user._id,
                    username: user.username,
                    profilePicture: user.profilePicture,
                };
            });
            return res.status(200).json(userResults);
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }        
    },

    searchInviteUser: async (req, res) => {
        try {
            const userId = req.user.id;
            const searchInput = req.body.searchInput; // Lấy từ khóa tìm kiếm từ query params

            const groupId = req.params.groupId;
            const group = await GroupModel.findById(groupId).select('members'); 
            
            if (!group) {
              return res.status(404).json({ error: 'group not found' });
            }
            const memberIds = group.members; 
            
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

    reportGroup: async(req, res) => {
        try {
           const userId = req.user.id;
           const groupId = req.params.groupId;
           const {content, type} = req.body;
           
           const group = await GroupModel.findById(groupId)

           if(!group) {
               return res.status(404).json({ error: "Group not found" })
           }

           const newReport = new ReportGroupModel({
                userId: userId,
                groupId: groupId,
                content: content,
                type: type,
           })

           await newReport.save();

           group.isReported = true;

           await group.save();

           return res.status(200).json({message: 'Report success'})
        } catch (error) {
            return res.status(500).json({ error: error.message});
        }
    },
}

module.exports = groupController