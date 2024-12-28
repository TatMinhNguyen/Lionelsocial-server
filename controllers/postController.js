const FeelModel = require("../models/FeelModel");
const NotificationModel = require("../models/NotificationModel");
const PostModel = require("../models/PostModel");
const ReportPostModel = require("../models/ReportPostModel");
const UserModel = require("../models/UserModel");
const { sendNotification } = require("../socket/socket");
const imagekit = require("../utils/imagekitConfig");

const postController = {
    //Create a post
    createPost : async (req, res) => {
        try {
            const userId = req.user.id;
            const user = await UserModel.findById(userId);
    
            if (!user) {
                return res.status(404).json({ error: "User not found" });
            }
    
            // Upload ảnh lên ImageKit
            const imageUploadPromises = req.files.images ? req.files.images.map(image => {
                return imagekit.upload({
                    file: image.buffer, // buffer ảnh từ multer
                    fileName: image.originalname,
                    folder: '/images' // Thư mục lưu ảnh
                });
            }) : [];
            
            //Upload video lên ImageKit
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
    
            const newPost = new PostModel({
                userId: user._id,
                description: req.body.description,
                images: imageUrls,
                video: videoUrl,
                typeText: req.body.typeText
            });
    
            await newPost.save();

            const notification = new NotificationModel({
                sender: userId,
                receiver: user.friends,
                type: 'create_post',
                postId: newPost._id,
                message: `posted a new article.`
            })

            await notification.save();

            const populatedNotification = await NotificationModel.findById(notification._id)
            .populate('sender', 'username profilePicture')  // Populate thông tin người gửi
            // .populate('postId', 'description')               // Populate thông tin bài viết
            .populate('commentId', 'content')                // Populate thông tin comment
            .exec();

            sendNotification(user.friends, populatedNotification)

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

    //Update a post
    updatePost: async(req, res) => {
        try {
            const postId = req.params.postId;
            const userId = req.user.id;
            const {description, imageIds, videoId, typeText} = req.body;

            // Kiểm tra nếu imageIds không phải là mảng thì chuyển nó thành mảng, nếu không tồn tại thì gán mảng rỗng
            const imageIdsArray = Array.isArray(imageIds) ? imageIds : (imageIds ? [imageIds] : []);

            const post = await PostModel.findById(postId)

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

            const videoUploadPromise = req.files.video ? imagekit.upload({
                file: req.files.video[0].buffer, // buffer video từ multer
                fileName: req.files.video[0].originalname,
                folder: '/videos' // Thư mục lưu video
            }) : Promise.resolve(null);

            // Upload ảnh lên ImageKit
            const imageUploadPromises = req.files.images ? req.files.images.map(image => {
                return imagekit.upload({
                    file: image.buffer, // buffer ảnh từ multer
                    fileName: image.originalname,
                    folder: '/images' // Thư mục lưu ảnh
                });
            }) : [];

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

    //Delete a post
    deletePost: async (req, res) => {
        try {
            const postId = req.params.postId;
            const userId = req.user.id;

            const user = await UserModel.findById(userId);

            // Tìm bài viết
            const post = await PostModel.findById(postId);

            if (!post) {
                return res.status(404).json({ error: "Post not found" });
            }

            // Kiểm tra xem người dùng có phải là người tạo bài viết không
            if (post.userId.toString() !== userId && !user.isAdmin) {
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
            await PostModel.findByIdAndDelete(postId);

            return res.status(200).json({ message: "Post deleted successfully" });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },

    // Get all post
    getPosts: async (req, res) => {
        try {
            const userId = req.user.id;

            // Tìm tất cả các bài viết
            const posts = res.paginatedResults.results;

            // Tạo một mảng các lời hứa (promises) để lấy thông tin người dùng tương ứng với mỗi bài viết
            const userPromises = posts.map(post =>
                UserModel.findById(post.userId)
            );

            // Chờ tất cả các lời hứa hoàn thành
            const users = await Promise.all(userPromises);

            // Loại bỏ bài viết của user bị cấm
            const filteredPosts = posts.filter((post, index) => {
                const user = users[index];
                return user && !user.isBan; // Loại bỏ nếu user bị ban
            });

            // Lấy thông tin cảm xúc của userId đối với từng bài viết sau khi đã lọc
            const feelPromises = filteredPosts.map(post =>
                FeelModel.findOne({ userId: userId, postId: post._id })
            );

            // Chờ tất cả các lời hứa hoàn thành
            const feels = await Promise.all(feelPromises);

            // Tạo kết quả cuối cùng
            const results = filteredPosts.map((post, index) => {
                const user = users.find(u => u && u._id.equals(post.userId)); // Tìm user tương ứng
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

            return res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },


    // GET A POST
    getAPost: async(req, res) => {
        try {
            const postId = req.params.postId
            const post = await PostModel.findById(postId)

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

    //Get All Posts from a User
    getUserPost: async(req, res) => {
        try {
            const userId = req.params.userId;
            
            const postPromises = res.paginatedResults.results;

            const posts = postPromises.filter(post => post.userId == userId)

            if(!posts) {
                return res.status(404).json({ error: "Post not found" })
            }

            // Tạo một mảng các lời hứa (promises) để lấy thông tin người dùng tương ứng với mỗi bài viết
            const userPromises = posts.map(post => UserModel.findById(post.userId));
            
            // Chờ tất cả các lời hứa hoàn thành
            const users = await Promise.all(userPromises);

            // Tạo một mảng các lời hứa để lấy thông tin cảm xúc của userId đối với từng post
            const feelPromises = posts.map(post => FeelModel.findOne({ userId: req.user.id, postId: post._id }));

            // Chờ tất cả các lời hứa hoàn thành
            const feels = await Promise.all(feelPromises);
            
            const results = posts.map((post, index) => {
                const user = users[index];
                const feel = feels[index];
                return {
                    postId: post._id,
                    description: post.description,
                    images: post.images,
                    video: post.video,
                    comment: post.comment,
                    felt: post.felt,
                    typeText: post.typeText,
                    is_feel: feel ? feel.type : -1,
                    createdAt: post.createdAt,
                    author: {
                        authorId: user._id,
                        authorName: user.username,
                        authorAvatar: user.profilePicture
                    }
                };
            });

            return res.status(200).json(results)
        } catch (error) {
            return res.status(500).json({ error: error.message});
        }
    },

    reportPost: async(req, res) => {
        try {
           const userId = req.user.id;
           const postId = req.params.postId;
           const {content, type} = req.body;
           
           const post = await PostModel.findById(postId)

           if(!post) {
               return res.status(404).json({ error: "Post not found" })
           }

           const newReport = new ReportPostModel({
                userId: userId,
                postId: postId,
                content: content,
                type: type,
           })

           await newReport.save();

           post.isReported = true;

           await post.save();

           return res.status(200).json({message: 'Report success'})
        } catch (error) {
            return res.status(500).json({ error: error.message});
        }
    },

    getFriendPosts: async (req, res) => {
        try {
            const userId = req.user.id;
    
            // 1. Tìm danh sách bạn bè của user
            const user = await UserModel.findById(userId).populate("friends");
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }
    
            const friendIds = user.friends;
    
            // 2. Lấy tất cả bài viết từ những người trong danh sách bạn bè
            const posts = res.paginatedResults.results.filter(post =>
                friendIds.some(friendId => friendId.toString() === post.userId.toString())
            );            
    
            // 3. Tạo một mảng các lời hứa để lấy thông tin người dùng
            const userPromises = posts.map(post =>
                UserModel.findById(post.userId)
            );
    
            // Chờ tất cả các lời hứa hoàn thành
            const users = await Promise.all(userPromises);
    
            // 4. Loại bỏ bài viết của user bị cấm
            const filteredPosts = posts.filter((post, index) => {
                const user = users[index];
                return user && !user.isBan; // Loại bỏ nếu user bị ban
            });
    
            // 5. Lấy thông tin cảm xúc của userId đối với từng bài viết sau khi đã lọc
            const feelPromises = filteredPosts.map(post =>
                FeelModel.findOne({ userId: userId, postId: post._id })
            );
    
            const feels = await Promise.all(feelPromises);
    
            // 6. Tạo kết quả cuối cùng
            const results = filteredPosts.map((post, index) => {
                const user = users.find(u => u && u._id.equals(post.userId)); // Tìm user tương ứng
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
    
            return res.status(200).json(results);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    
}
module.exports = postController
