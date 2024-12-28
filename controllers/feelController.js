const CommentModel = require("../models/CommentModel");
const FeelModel = require("../models/FeelModel");
const NotificationModel = require("../models/NotificationModel");
const PostGroupModel = require("../models/PostGroupModel");
const PostModel = require("../models/PostModel");
const UserModel = require("../models/UserModel");
const { sendNotification } = require("../socket/socket");

const feelController = {
    //Set feel
    setFell: async (req, res) => {
        try {
            const userId = req.user.id;
            const { postId, type } = req.body;

            const user = await UserModel.findById(userId);

            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            const post = await PostModel.findById(postId);
            const postGroup = await PostGroupModel.findById(postId)

            if(!post && !postGroup){
                return res.status(404).json({ error: "Post not found" });
            }
            
            const newFelt = new FeelModel({
                userId: userId,
                postId: postId,
                type: type
            })

            if(post){
                post.felt = post.felt + 1;
                await post.save();

                if(userId !== post.userId) {
                    const notification = new NotificationModel({
                        sender: userId,
                        receiver: post.userId,
                        type: 'set_feel',
                        postId: post._id,
                        type_felt: newFelt.type,
                        message: `expressed his feelings about your post.`
                    })
    
                    await notification.save();   
                    
                    const populatedNotification = await NotificationModel.findById(notification._id)
                    .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
                    // .populate('postId', 'description')               // Populate thông tin bài viết
                    .populate('commentId', 'content')                // Populate thông tin comment
                    .exec();
        
                    // Gửi thông báo realtime qua socket
                    sendNotification([post.userId], populatedNotification); 
                }
            }
            
            if(postGroup){
                postGroup.felt += 1;
                await postGroup.save();
            }
            await newFelt.save();

            return res.status(200).json({message: 'Success!'});
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    unFelt: async(req, res) => {
        try {
            const userId = req.user.id;
            const { postId } = req.params;
    
            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
    
            const post = await PostModel.findById(postId);
            const postGroup = await PostGroupModel.findById(postId)

            if(!post && !postGroup){
                return res.status(404).json({ error: "Post not found" });
            }
    
            // Tìm xem người dùng đã like bài viết này chưa
            const felt = await FeelModel.findOne({ userId: userId, postId: postId });
            if (!felt) {
                return res.status(400).json({ error: "You haven't liked this post yet" });
            }
    
            // Xóa lượt like và cập nhật số lượng likes của bài viết
            await FeelModel.deleteOne({ _id: felt._id });


            if(post){
                post.felt = post.felt - 1;
        
                await post.save();                
            }


            if(postGroup){
                postGroup.felt -= 1;
                await postGroup.save();
            }
    
            return res.status(200).json({ message: 'Post unliked successfully!' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    updateFelt: async(req, res) =>{
        try {
            const userId = req.user.id;
            const { postId } = req.params; // Lấy postId từ params
            const { type } = req.body; // Lấy type mới từ body
    
            const user = await UserModel.findById(userId);
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
    
            const post = await PostModel.findById(postId);
            const postGroup = await PostGroupModel.findById(postId)

            if(!post && !postGroup){
                return res.status(404).json({ error: "Post not found" });
            }
    
            // Tìm xem lượt feel đã tồn tại chưa
            const felt = await FeelModel.findOne({ userId: userId, postId: postId });
            if (!felt) {
                return res.status(400).json({ error: "You haven't felt this post yet" });
            }
    
            // Cập nhật type cho feel
            felt.type = type;
    
            await felt.save(); // Lưu lại cảm xúc đã cập nhật

            if(post){
                if(userId !== post.userId) {
                    const notification = new NotificationModel({
                        sender: userId,
                        receiver: post.userId,
                        type: 'update_feel',
                        postId: post._id,
                        type_felt: felt.type,
                        message: `updated his feelings about your post.`
                    })

                    await notification.save();   
                    
                    const populatedNotification = await NotificationModel.findById(notification._id)
                    .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
                    // .populate('postId', 'description')               // Populate thông tin bài viết
                    .populate('commentId', 'content')                // Populate thông tin comment
                    .exec();
        
                    // Gửi thông báo realtime qua socket
                    sendNotification([post.userId], populatedNotification); 
                }                
            }
    
            return res.status(200).json({ message: 'Feel updated successfully!' });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    getFelt: async(req, res) => {
        try {
            const postId = req.params.postId;
            const currentUserId = req.user.id; 
    
            const feels = await FeelModel.find({ postId: postId }).sort({ createdAt: -1 });;
    
            if(!feels) {
                return res.status(404).json({ error: "Feel not found" });
            }
    
            // Lấy danh sách bạn bè của người dùng hiện tại
            const currentUser = await UserModel.findById(currentUserId).select('friends');
            if (!currentUser) {
                return res.status(404).json({ error: "Current user not found" });
            }
            
            const currentUserFriendIds = currentUser.friends.map(friendId => friendId.toString()); // Chuyển đổi thành chuỗi
    
            // Lấy thông tin người dùng tham gia reaction
            const userPromises = feels.map(feel => UserModel.findById(feel.userId).select('username profilePicture friends'));
            const users = await Promise.all(userPromises);
    
            const results = await Promise.all(feels.map(async (feel, index) => {
                const user = users[index];
    
                // Lấy danh sách bạn bè của người dùng tham gia reaction
                const userFriendIds = user.friends.map(friendId => friendId.toString()); // Chuyển thành mảng chuỗi
    
                // Tính số lượng bạn chung
                const mutualFriendsCount = userFriendIds.filter(friendId => currentUserFriendIds.includes(friendId)).length;
                // console.log('currentUserFriendIds', currentUserFriendIds);
                // console.log('userFriendIds', userFriendIds);
                // console.log('mutualFriendsCount', mutualFriendsCount);
    
                return {
                    feelId: feel._id,
                    postId: feel.postId,
                    type: feel.type,
                    createdAt: feel.createdAt,
                    author: {
                        authorId: user._id,
                        authorName: user.username,
                        authorAvatar: user.profilePicture,
                    },
                    mutualFriendsCount: mutualFriendsCount,  // Trả về số lượng bạn chung
                };
            }));
    
            return res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    
}

module.exports = feelController