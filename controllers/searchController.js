const FeelModel = require("../models/FeelModel");
const PostModel = require("../models/PostModel");
const UserModel = require("../models/UserModel");

function removeVietnameseTones(str) {
    return str
        .normalize('NFD') // Tách các ký tự có dấu
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ các dấu
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}
    
const searchController =  {
    searchPostsAndUsers: async (req, res) => {
        try {
            const userId = req.user.id;
            const searchInput = req.query.q || ""; // Lấy từ khóa tìm kiếm từ query params
    
            // Loại bỏ dấu tiếng Việt khỏi từ khóa tìm kiếm
            const searchKeyword = removeVietnameseTones(searchInput).toLowerCase();
    
            // Lấy tất cả các bài viết, sau đó loại bỏ bài viết từ user bị cấm
            const posts = await PostModel.find()
                .sort({ createdAt: -1 })
                .then(async posts => {
                    const userIds = posts.map(post => post.userId);
                    const bannedUsers = await UserModel.find({ _id: { $in: userIds }, isBan: true }).select('_id');
                    const bannedUserIds = new Set(bannedUsers.map(user => user._id.toString()));
    
                    return posts.filter(post => {
                        const postDescription = removeVietnameseTones(post.description).toLowerCase();
                        return postDescription.includes(searchKeyword) && !bannedUserIds.has(post.userId.toString());
                    });
                });
    
            // Lấy tất cả người dùng hợp lệ
            const users = await UserModel.find(
                { 
                    isVerify: true, 
                    _id: { $nin: userId }, 
                    isAdmin: { $ne: true }, 
                    isBan: false 
                },
                { 
                    _id: 1, 
                    username: 1, 
                    profilePicture: 1, 
                    friends: 1, 
                    friendsCount: 1, 
                    isVerify: 1 
                }
            )
            .sort({ createdAt: -1 })
            .then(users => {
                return users.filter(user => {
                    const username = removeVietnameseTones(user.username).toLowerCase();
                    return username.includes(searchKeyword);
                });
            });
    
            // Lấy danh sách bạn bè của người dùng hiện tại
            const currentUser = await UserModel.findById(userId);
            const friends = currentUser.friends;
    
            // Lấy thông tin người dùng của từng bài viết
            const userIds = posts.map(post => post.userId);
            const postUsers = await UserModel.find({ _id: { $in: userIds }, isBan: false });
    
            // Lấy thông tin cảm xúc của userId đối với từng bài viết
            const feelPromises = posts.map(post => FeelModel.findOne({ userId: userId, postId: post._id }));
            const feels = await Promise.all(feelPromises);
    
            // Kết quả tìm kiếm bài viết
            const postResults = posts.map((post, index) => {
                const user = postUsers.find(u => u._id.equals(post.userId));
                const feel = feels[index];
                return {
                    postId: post._id,
                    description: post.description,
                    images: post.images,
                    video: post.video,
                    comment: post.comment,
                    felt: post.felt,
                    typeText: post.typeText,
                    createdAt: post.createdAt,
                    is_feel: feel ? feel.type : -1,
                    author: {
                        authorId: user._id,
                        authorName: user.username,
                        authorAvatar: user.profilePicture
                    }
                };
            });
    
            // Kết quả tìm kiếm người dùng
            const userResults = users.map(user => {
                const mutualFriends = user.friends.filter(friendId => friends.includes(friendId));
                return {
                    userId: user._id,
                    username: user.username,
                    profilePicture: user.profilePicture,
                    friendsCount: user.friendsCount,
                    mutualFriends: mutualFriends.length
                };
            });
    
            return res.status(200).json({ posts: postResults, users: userResults });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
    
    
}

module.exports = searchController;
