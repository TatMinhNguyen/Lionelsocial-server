const PostModel = require("../models/PostModel");
const ReportPostModel = require("../models/ReportPostModel");
const ReportUserModel = require("../models/ReportUserModel");
const ReportGroupModel = require("../models/ReportGroupModel")
const UserModel = require("../models/UserModel");
const imagekit = require("../utils/imagekitConfig");
const GroupModel = require("../models/GroupModel");

const adminController = {
    getPostReported: async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);

            if (!user || !user.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            // Lấy danh sách bài viết bị báo cáo từ ReportPostModel, sắp xếp theo thời gian báo cáo (createdAt)
            const reportedPosts = await ReportPostModel.find().sort({ createdAt: -1 });

            if (!reportedPosts || reportedPosts.length === 0) {
                return res.status(404).json({ message: "Không có bài viết nào bị báo cáo." });
            }

            // Nhóm bài viết theo postId và chỉ giữ báo cáo sớm nhất
            const uniqueReports = {};
            reportedPosts.forEach((report) => {
                if (!uniqueReports[report.postId]) {
                    uniqueReports[report.postId] = report;
                }
            });
            const filteredReports = Object.values(uniqueReports);

            // Tạo mảng promises để lấy thông tin bài viết từ PostModel
            const postPromises = filteredReports.map((report) =>
                PostModel.findOne({ _id: report.postId, isReported: true })
            );
            const posts = await Promise.all(postPromises);

            // Loại bỏ các bài viết không tồn tại hoặc không có isReported === true
            const validPosts = posts.filter((post) => post);

            // Lấy thông tin tác giả từ UserModel
            const userPromises = validPosts.map((post) => UserModel.findById(post.userId));
            const authors = await Promise.all(userPromises);

            // Gộp thông tin bài viết, tác giả, và thông tin báo cáo
            const results = validPosts.map((post, index) => {
                const author = authors[index];
                // const report = reportedPosts.find((report) => report.postId === post._id.toString());
                return {
                    postId: post._id,
                    description: post.description,
                    images: post.images,
                    video: post.video,
                    typeText: post.typeText,
                    createdAt: post?.createdAt, // Thời điểm bị báo cáo
                    author: {
                        authorId: author?._id,
                        authorName: author?.username,
                        authorAvatar: author?.profilePicture,
                    },
                };
            });

            return res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    keepPost : async(req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);

            if (!user || !user.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            const postId = req.params.postId;

            const post = await PostModel.findById(postId)

            if(!post){
                return res.status(404).json({ error: "Post not found" })
            }

            post.isReported = false;

            await post.save();

            return res.status(200).json({message: "Keep"})
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    deletePost: async(req, res) => {
        try {
            const postId = req.params.postId;
            const userId = req.user.id;

            const user = await UserModel.findById(userId);
            if (!user.isAdmin) {
                return res.status(403).json({ error: "You do not have permission to delete this post" });
            }

            // Tìm bài viết
            const post = await PostModel.findById(postId);

            if (!post) {
                return res.status(404).json({ error: "Post not found" });
            }

            // Xóa ảnh trên ImageKit
            const imageDeletionPromises = post.images.map(image => {
                const imageId = image.fileId
                return imagekit.deleteFile(imageId);
            });

            // Xóa video trên ImageKit
            const videoDeletionPromise = post.video ? imagekit.deleteFile(post.video.fileId)
            : Promise.resolve(null);

            // Chờ xóa tất cả các ảnh và video
            await Promise.all([
                ...imageDeletionPromises,
                videoDeletionPromise
            ]);

            // Xóa bài viết khỏi database
            await PostModel.findByIdAndDelete(postId);

            return res.status(200).json({ message: "Post deleted successfully" });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    getContentReport: async(req, res) => {
        try {
            const postId = req.params.postId
            const reports = await ReportPostModel.find({ postId }).sort({ createdAt: -1 });

            // Lấy thông tin tác giả từ UserModel
            const userPromises = reports.map((post) => UserModel.findById(post.userId));
            const authors = await Promise.all(userPromises);

            const results = reports.map((post, index) => {
                const author = authors[index];
                return {
                    _id: post._id,
                    postId: post.postId,
                    content: post.content,
                    type: post.type,
                    createdAt: post?.createdAt, // Thời điểm bị báo cáo
                    author: {
                        authorId: author?._id,
                        authorName: author?.username,
                        authorAvatar: author?.profilePicture,
                    },
                };
            });

            res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    getReportedUsers : async(req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);

            if (!user || !user.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            // Lấy danh sách bài viết bị báo cáo từ ReportPostModel, sắp xếp theo thời gian báo cáo (createdAt)
            const reportedUsers = await ReportUserModel.find().sort({ createdAt: -1 });

            if (!reportedUsers || reportedUsers.length === 0) {
                return res.status(404).json({ message: "Không có user nào bị báo cáo." });
            }

            // Nhóm bài viết theo userId và chỉ giữ báo cáo sớm nhất
            const uniqueUsers = {};
            reportedUsers.forEach((report) => {
                if (!uniqueUsers[report.reportedUserId]) {
                    uniqueUsers[report.reportedUserId] = report;
                }
            });
            const filteredUsers = Object.values(uniqueUsers);

            // Tạo mảng promises để lấy thông tin bài viết từ PostModel
            const userPromises = filteredUsers.map((report) =>
                UserModel.findOne({
                    _id: report.reportedUserId,
                    $or: [
                        { isBan: { $exists: false } }, // Không tồn tại thuộc tính isBan
                        { isBan: false }               // Hoặc isBan có giá trị là false
                    ]
                })
            );            
            const users = await Promise.all(userPromises);

            // Loại bỏ các user không tồn tại 
            const validUsers = users.filter((user) => user);

            const results = validUsers.map((user, index) => {
                // const author = authors[index];
                const report = reportedUsers.find((report) => report.reportedUserId === user._id.toString());
                return {
                    _id: user._id,
                    username: user.username,
                    profilePicture: user.profilePicture,
                    createdAt: report.createdAt
                };
            });

            return res.status(200).json(results)
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    setBan: async(req, res) => {
        try {
            const userId = req.params.userId;

            const admin = await UserModel.findById(req.user.id)

            if (!admin || !admin.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            const user = await UserModel.findById(userId)

            if(!user) {
                return res.status(404).json({message: "User not found"})
            }

            user.isBan = true;

            await user.save();

            return res.status(200).json({message: "Ban success"})
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    unBan: async(req, res) => {
        try {
            const userId = req.params.userId;

            const admin = await UserModel.findById(req.user.id)

            if (!admin || !admin.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            const user = await UserModel.findById(userId)

            if(!user) {
                return res.status(404).json({message: "User not found"})
            }

            user.isBan = false;

            await user.save();

            return res.status(200).json({message: "unBan success"})            
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    getDetailReportUser : async(req, res) => {
        try {
            const reportedUserId = req.params.userId
            const reports = await ReportUserModel.find({ reportedUserId }).sort({ createdAt: -1 });

            // Lấy thông tin tác giả từ UserModel
            const userPromises = reports.map((user) => UserModel.findById(user.reporterUserId));
            const authors = await Promise.all(userPromises);

            const results = reports.map((user, index) => {
                const author = authors[index];
                return {
                    _id: user._id,
                    reportedUserId: user.reportedUserId,
                    content: user.content,
                    type: user.type,
                    createdAt: user?.createdAt, // Thời điểm bị báo cáo
                    author: {
                        authorId: author?._id,
                        authorName: author?.username,
                        authorAvatar: author?.profilePicture,
                    },
                };
            });

            return res.status(200).json(results);            
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    getBannedUser : async(req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);

            if (!user || !user.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            const baners = await UserModel.find({ isBan: true })

            const results = baners.map((user, index) => {
                // const author = authors[index];
                // const report = reportedUsers.find((report) => report.reportedUserId === user._id.toString());
                return {
                    _id: user._id,
                    username: user.username,
                    profilePicture: user.profilePicture,
                    // createdAt: report.createdAt
                };
            });

            return res.status(200).json(results)
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    getReportedGroup : async(req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);

            if (!user || !user.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            // Lấy danh sách bài viết bị báo cáo từ ReportPostModel, sắp xếp theo thời gian báo cáo (createdAt)
            const reportedGroups = await ReportGroupModel.find().sort({ createdAt: -1 });

            if (!reportedGroups || reportedGroups.length === 0) {
                return res.status(404).json({ message: "Không có nhom nào bị báo cáo." });
            }

            // Nhóm bài viết theo userId và chỉ giữ báo cáo sớm nhất
            const uniqueUsers = {};
            reportedGroups.forEach((report) => {
                if (!uniqueUsers[report.groupId]) {
                    uniqueUsers[report.groupId] = report;
                }
            });
            const filteredGroups = Object.values(uniqueUsers);

            // Tạo mảng promises để lấy thông tin bài viết từ PostModel
            const groupPromises = filteredGroups.map((report) =>
                GroupModel.findOne({
                    _id: report.groupId,
                    isReported: true
                })
            );            
            const groups = await Promise.all(groupPromises);

            // Loại bỏ các user không tồn tại 
            const validGroups = groups.filter((group) => group);

            const results = validGroups.map((group, index) => {
                // const author = authors[index];
                const report = reportedGroups.find((report) => report.groupId === group._id.toString());
                return {
                    _id: group._id,
                    name: group.name,
                    avatar: group.avatar,
                    createdAt: report.createdAt
                };
            });

            return res.status(200).json(results)
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    keepGroup : async(req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);

            if (!user || !user.isAdmin) {
                return res.status(403).json({ message: "Bạn không phải admin." });
            }

            const groupId = req.params.groupId;

            const group = await GroupModel.findById(groupId)

            if(!group){
                return res.status(404).json({ error: "group not found" })
            }

            group.isReported = false;

            await group.save();

            return res.status(200).json({message: "Keep"})
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    deleteGroup: async (req, res) => {
        try {
            const { groupId } = req.params; // Lấy ID của nhóm group từ params
            const userId = req.user.id; // ID của người thực hiện yêu cầu
            const user = await UserModel.findById(userId);
    
            // Tìm nhóm group bằng groupId
            const group = await GroupModel.findById(groupId);
            if (!group) {
                return res.status(404).json({ message: "Không tìm thấy nhóm group." });
            }
    
            // Kiểm tra quyền: chỉ người tạo nhóm mới có quyền xóa nhóm
            if (group.createId.toString() !== userId && user.isAdmin === false) {
                return res.status(403).json({ message: "Bạn không có quyền xóa nhóm group này." });
            }
    
            // Xóa nhóm group
            await GroupModel.findByIdAndDelete(groupId);
    
            return res.status(200).json({ message: "Xóa nhóm group thành công." });
        } catch (error) {
            return res.status(500).json({ message: "Lỗi server", error });
        }
    },

    getDetailReportedGroup: async(req, res) => {
        try {
            const groupId = req.params.groupId
            const reports = await ReportGroupModel.find({ groupId }).sort({ createdAt: -1 });

            // Lấy thông tin tác giả từ UserModel
            const userPromises = reports.map((post) => UserModel.findById(post.userId));
            const authors = await Promise.all(userPromises);

            const results = reports.map((post, index) => {
                const author = authors[index];
                return {
                    _id: post._id,
                    groupId: post.groupId,
                    content: post.content,
                    type: post.type,
                    createdAt: post?.createdAt, // Thời điểm bị báo cáo
                    author: {
                        authorId: author?._id,
                        authorName: author?.username,
                        authorAvatar: author?.profilePicture,
                    },
                };
            });

            res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
}

module.exports = adminController