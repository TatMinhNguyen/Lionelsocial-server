const NotificationModel = require("../models/NotificationModel");

const notificationController = {
    getNotification: async(req, res) => {
        try {
            const userId = req.user.id; // ID của người nhận từ token hoặc session

            // Tìm tất cả thông báo của người nhận
            const notifications = await NotificationModel.find({ receiver: userId })
                .populate('sender', 'username profilePicture') // Lấy thêm thông tin của người gửi
                // .populate('postId', 'description') // Nếu có bài viết liên quan, lấy thêm thông tin bài viết
                .populate('commentId', 'content') // Nếu có comment liên quan, lấy thêm nội dung comment
                .sort({ createdAt: -1 }); // Sắp xếp thông báo mới nhất ở trên

            // Loại bỏ trường `receiver` khỏi từng thông báo
            const filteredNotifications = notifications.map(notification => {
                const { receiver, ...otherDetails } = notification._doc;
                return otherDetails;
            });

            // Trả về danh sách thông báo đã loại bỏ trường `receiver`
            return res.status(200).json(filteredNotifications);
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    },
    checkNotification: async(req, res) => {
        try {
            const notificationId = req.params.notificationId;

            const notification = await NotificationModel.findById(notificationId)

            notification.read = true

            await notification.save();

            return res.status(200).json({message: 'Checked Notification'})
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }
}

module.exports = notificationController