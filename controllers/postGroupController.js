const UserModel = require("../models/UserModel");
const GroupModel = require("../models/GroupModel");
const PostGroupModel = require("../models/PostGroupModel");
const imagekit = require("../utils/imagekitConfig");
const FeelModel = require("../models/FeelModel");
const ReportPostGroupModel = require("../models/ReportPostGroupModel");
const NotificationModel = require("../models/NotificationModel");
const { sendNotification } = require("../socket/socket");

const postGroupController = {
    //Create a post
    createPost : async (req, res) => {
        try {
            const userId = req.user.id;
            const groupId = req.params.groupId

            const user = await UserModel.findById(userId);
    
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }

            const group = await GroupModel.findById(groupId);
    
            if (!group) {
                return res.status(404).json({ error: "User not found" });
            }

            // Kiểm tra nếu người dùng không phải là thành viên của nhóm
            if (!group.members.map(member => member.toString()).includes(userId)) {
                return res.status(400).json({ message: "Bạn không phải là thành viên của nhóm group này." });
            }
    
            // Upload ảnh lên ImageKit
            const imageUploadPromises = req.files.images ? req.files.images.map(image => {
                return imagekit.upload({
                    file: image.buffer, // buffer ảnh từ multer
                    fileName: image.originalname,
                    folder: '/images' // Thư mục lưu ảnh
                });
            }) : [];
    
            const videoUploadPromise = req.files.video ? imagekit.upload({
                file: req.files.video[0].buffer, // buffer video từ multer
                fileName: req.files.video[0].originalname,
                folder: '/videos' // Thư mục lưu video
            }) : Promise.resolve(null);
    
            const [imageUploadResults, videoUploadResult] = await Promise.all([
                Promise.all(imageUploadPromises),
                videoUploadPromise
            ]);
    
            const imageUrls = imageUploadResults.map(uploadResult => ({
                url: uploadResult.url,
                fileId: uploadResult.fileId
            }));
            
            const videoUrl = videoUploadResult ? { 
                url: videoUploadResult.url, 
                fileId: videoUploadResult.fileId 
            } : null;
    
            const newPost = new PostGroupModel({
                groupId: group._id,
                userId: user._id,
                description: req.body.description,
                images: imageUrls,
                video: videoUrl,
                typeText: req.body.typeText
            });
    
            await newPost.save();

            // if(group.type === false) {
            //     if(group.createId.toString() !== userId){
            //         group.pendingPosts.push(newPost._id)
            //     }    
            // }

            await group.save();

            const receivers = group.members.filter(member => member.toString() !== userId)

            const notification = new NotificationModel({
                sender: userId,
                receiver: receivers,
                type: 'create_post',
                postId: newPost._id,
                message: `posted a new article in the ${group.name} group.`
            })

            await notification.save();

            const populatedNotification = await NotificationModel.findById(notification._id)
            .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
            // .populate('postId', 'description')               // Populate thông tin bài viết
            .populate('commentId', 'content')                // Populate thông tin comment
            .exec();

            sendNotification(receivers, populatedNotification)

            const result = {
                author: {
                    authorId: user.id,
                    authorName: user.username,
                    authorAvatar: user.profilePicture
                },
                newPost
            }
    
            return res.status(201).json(result);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    updatePost: async(req, res) => {
        try {
            const postId = req.params.postId;
            const userId = req.user.id;
            const {description, imageIds, videoId, typeText} = req.body;

            // Kiểm tra nếu imageIds không phải là mảng thì chuyển nó thành mảng, nếu không tồn tại thì gán mảng rỗng
            const imageIdsArray = Array.isArray(imageIds) ? imageIds : (imageIds ? [imageIds] : []);

            const post = await PostGroupModel.findById(postId)

            if(!post) {
                return res.status(404).json({ error: "Post not found" })
            }

            if(userId != post.userId){
                return res.status(403).json({ error: "You are not the author of this post" })
            }

            if(description){
                post.description = description;
            }

            if(typeText) {
                post.typeText = typeText;
            }

            // Upload ảnh lên ImageKit
            const imageUploadPromises = req.files.images ? req.files.images.map(image => {
                return imagekit.upload({
                    file: image.buffer, // buffer ảnh từ multer
                    fileName: image.originalname,
                    folder: '/images' // Thư mục lưu ảnh
                });
            }) : [];

            const videoUploadPromise = req.files.video ? imagekit.upload({
                file: req.files.video[0].buffer, // buffer video từ multer
                fileName: req.files.video[0].originalname,
                folder: '/videos' // Thư mục lưu video
            }) : Promise.resolve(null);

            const [imageUploadResults, videoUploadResult] = await Promise.all([
                Promise.all(imageUploadPromises),
                videoUploadPromise
            ]);
    
            const imageUrls = imageUploadResults.map(uploadResult => ({
                url: uploadResult.url,
                fileId: uploadResult.fileId
            }));

            const videoUrl = videoUploadResult ? { 
                url: videoUploadResult.url, 
                fileId: videoUploadResult.fileId 
            } : null;

            if(videoUrl || videoId){               
                let removeVideo = null;

                if(videoUrl && post.video){
                    removeVideo = post.video.fileId;
                }

                if(videoId){
                    removeVideo = videoId;
                }

                if(removeVideo){
                    // Xóa video trên ImageKit
                    const videoDeletionPromise = post.video ? imagekit.deleteFile(removeVideo)
                    : Promise.resolve(null);

                    // const videoDeletionPromise = removeVideo ? imagekit.deleteFile(removeVideo) : Promise.resolve(null);

                    // Chờ xóa tất cả các ảnh và video
                    await Promise.all([
                        // ...imageDeletionPromises,
                        videoDeletionPromise
                    ]);                    
                }


                //update DB
                if(videoUrl){
                    post.video = videoUrl
                }else{
                    post.video = null;
                }
            }


            if (imageUrls.length > 0 || imageIdsArray.length > 0) {
                if (imageIdsArray.length > 0) {
                    // Xóa ảnh trên ImageKit
                    const imageDeletionPromises = imageIdsArray.map(imageId => {
                        return imagekit.deleteFile(imageId);
                    });
    
                    await Promise.all(imageDeletionPromises);
    
                    // Update DB
                    post.images = post.images.filter(image => !imageIdsArray.includes(image.fileId));
                }
    
                // Thêm URL mới vào DB
                post.images.push(...imageUrls);
            }

            await post.save();

            return res.status(200).json("Update Success")

        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    deletePost: async (req, res) => {
        try {
            const postId = req.params.postId;
            const groupId = req.params.groupId;
            const userId = req.user.id;

            // Tìm bài viết
            const post = await PostGroupModel.findById(postId);

            if (!post) {
                return res.status(404).json({ error: "Post not found" });
            }

            const group = await GroupModel.findById(groupId);
    
            if (!group) {
                return res.status(404).json({ error: "User not found" });
            }

            // Kiểm tra xem người dùng có phải là người tạo bài viết không
            if (post.userId.toString() !== userId && group.createId.toString() !== userId) {
                return res.status(403).json({ error: "You do not have permission to delete this post" });
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
            await PostGroupModel.findByIdAndDelete(postId);

            return res.status(200).json({ message: "Post deleted successfully" });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    //Get all post
    getPosts: async (req, res) => {
        try {
            const userId = req.user.id;
            const groupId = req.params.groupId;
    
            // Tìm group dựa trên groupId
            const group = await GroupModel.findById(groupId);
    
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }
    
            // Lấy tất cả các bài viết từ kết quả phân trang
            let posts = res.paginatedResults.results.filter(post => post.groupId == groupId);
    
            // Loại bỏ các bài viết có ID nằm trong group.pendingPosts
            const pendingPostIds = new Set(group.pendingPosts.map(postId => postId.toString()));
            posts = posts.filter(post => !pendingPostIds.has(post._id.toString()));
    
            // if (!posts.length) {
            //     return res.status(404).json({ error: "No posts found in this group" });
            // }
    
            // Lấy thông tin người dùng của từng bài viết
            const userPromises = posts.map(post => UserModel.findById(post.userId));
            const users = await Promise.all(userPromises);
    
            // Loại bỏ các bài viết từ user bị cấm
            const validPosts = [];
            const validUsers = [];
            posts.forEach((post, index) => {
                const user = users[index];
                if (user && !user.isBan) {
                    validPosts.push(post);
                    validUsers.push(user);
                }
            });
    
            // if (!validPosts.length) {
            //     return res.status(404).json({ error: "No valid posts found in this group" });
            // }
    
            // Lấy thông tin cảm xúc của userId đối với từng bài viết hợp lệ
            const feelPromises = validPosts.map(post =>
                FeelModel.findOne({ userId: userId, postId: post._id })
            );
            const feels = await Promise.all(feelPromises);
    
            // Tạo kết quả trả về
            const results = validPosts.map((post, index) => {
                const user = validUsers[index];
                const feel = feels[index];
                return {
                    postId: post._id,
                    groupId: post.groupId,
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
    
            return res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    
    getAPost: async(req, res) => {
        try {
            const postId = req.params.postId
            const post = await PostGroupModel.findById(postId)

            if(!post){
                return res.status(404).json({ error: "Post not found" })
            }

            const user = await UserModel.findById(post.userId)

            const feel = await FeelModel.findOne({ userId: req.user.id, postId: post._id })

            const result = {
                author: {
                    authorId: user.id,
                    authorName: user.username,
                    authorAvatar: user.profilePicture
                },
                post,
                is_feel: feel ? feel.type : -1,
            }
    
            return res.status(201).json(result);

        } catch (error) {
            return res.status(500).json({ error: error.message});
        }
    },

    getPendingPost: async(req, res) => {
        try {
            const groupId = req.params.groupId;

            // Tìm nhóm dựa trên groupId
            const group = await GroupModel.findById(groupId);
    
            if (!group) {
                return res.status(404).json({ error: "Group not found" });
            }
    
            // Lấy danh sách các bài viết trong pendingPosts
            const postIds = group.pendingPosts;
    
            // Tìm chi tiết các bài viết dựa trên danh sách pendingPosts
            const posts = await PostGroupModel.find({ _id: { $in: postIds } });
    
            // Tạo một mảng các lời hứa để lấy thông tin tác giả của mỗi bài viết
            const userPromises = posts.map(post => UserModel.findById(post.userId));
            const users = await Promise.all(userPromises);

            // Tạo một mảng các lời hứa để lấy thông tin cảm xúc của userId đối với từng post
            const feelPromises = posts.map(post => FeelModel.findOne({ userId: req.user.id, postId: post._id }));

            // Chờ tất cả các lời hứa hoàn thành
            const feels = await Promise.all(feelPromises);
    
            // Chuẩn bị kết quả để trả về
            const results = posts.map((post, index) => {
                const user = users[index];
                const feel = feels[index];
                return {
                    postId: post._id,
                    groupId: group._id,
                    description: post.description,
                    images: post.images,
                    video: post.video,
                    comment: post.comment,
                    felt: post.felt,
                    is_feel: feel ? feel.type : -1,
                    typeText: post.typeText,
                    createdAt: post.createdAt,
                    author: {
                        authorId: user._id,
                        authorName: user.username,
                        authorAvatar: user.profilePicture
                    }
                };
            });
    
            return res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message});
        }
    },

    reportPost: async(req, res) => {
        try {
            const userId = req.user.id;
            const postId = req.params.postId;
            const {content, type} = req.body;
            
            const post = await PostGroupModel.findById(postId)

            if(!post) {
                return res.status(404).json({ error: "Post not found" })
            }

            const group = await GroupModel.findById(post.groupId)

            const newReport = new ReportPostGroupModel({
                    userId: userId,
                    postId: postId,
                    groupId: post.groupId,
                    content: content,
                    type: type,
            })

            await newReport.save();

            post.isReported = true;

            await post.save();

            const notification = new NotificationModel({
                sender: userId,
                receiver: [group.createId],
                type: 'report-post',
                groupId: group._id,
                message: `reported a violation about a post in your group ${group.name}.`
                })

            await notification.save();

            const populatedNotification = await NotificationModel.findById(notification._id)
            .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
            // .populate('postId', 'description')               // Populate thông tin bài viết
            .populate('commentId', 'content')                // Populate thông tin comment
            .exec();

            sendNotification([group.createId], populatedNotification)

           return res.status(200).json({message: 'Report success'})
        } catch (error) {
            return res.status(500).json({ error: error.message});
        }
    },

    getPostReported: async (req, res) => {
        try {
            const groupId = req.params.groupId;

            // Lấy danh sách bài viết bị báo cáo từ ReportPostModel, sắp xếp theo thời gian báo cáo (createdAt)
            const reportedPosts = await ReportPostGroupModel.find({ groupId: groupId }).sort({ createdAt: -1 });

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
                PostGroupModel.findOne({ _id: report.postId, isReported: true })
            );
            const posts = await Promise.all(postPromises);

            // Loại bỏ các bài viết không tồn tại hoặc không có isReported === true
            const validPosts = posts.filter((post) => post);

            if (!validPosts || validPosts.length === 0) {
                return res.status(404).json({ message: "Không có bài viết hợp lệ." });
            }

            // Lấy thông tin tác giả từ UserModel
            const userPromises = validPosts.map((post) => UserModel.findById(post.userId));
            const authors = await Promise.all(userPromises);

            // Gộp thông tin bài viết, tác giả, và thông tin báo cáo
            const results = validPosts.map((post, index) => {
                const author = authors[index];
                // const report = reportedPosts.find((report) => report.postId === post._id.toString());
                return {
                    postId: post._id,
                    groupId: post.groupId,
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

    getContentReport: async(req, res) => {
        try {
            const postId = req.params.postId
            const reports = await ReportPostGroupModel.find({ postId }).sort({ createdAt: -1 });

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

    keepPost : async(req, res) => {
        try {
            const postId = req.params.postId;

            const post = await PostGroupModel.findById(postId)

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

}

module.exports = postGroupController