const { Server } = require('socket.io');

let io;
const userSocketMap = {}; // Lưu trữ ánh xạ giữa userId và danh sách socketId

const socketConfig = (server) => {
  // Khởi tạo một instance của Socket.IO
  io = new Server(server, {
    cors: {
      origin: "*", // Có thể giới hạn origin sau này
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: false,
    },
  });

  // Sự kiện kết nối
  io.on('connection', (socket) => {
    console.log(`User connected with socket ID: ${socket.id}`);

    // Đăng ký userId và ánh xạ với danh sách socketId
    socket.on('register', (userId) => {
      if (!userId) return; // Validate userId

      // Gán userId vào socket để xử lý disconnect dễ dàng hơn
      socket.userId = userId;

      if (!userSocketMap[userId]) {
        userSocketMap[userId] = [];
      }

      userSocketMap[userId].push(socket.id); // Thêm socketId vào danh sách

      console.log(`User ${userId} is mapped to socket IDs: ${userSocketMap[userId]}`);
    });

    // Lắng nghe sự kiện logout
    socket.on('logout', () => {
      if (socket.userId) {
        console.log(`User ${socket.userId} logged out`);
        removeSocketId(socket.userId, socket.id);
        emitOnlineUsers();
      }
    });

    socket.on('online', () => {
      emitOnlineUsers();
    });

    socket.on('create-room', (roomId, members) => {
      console.log(`Room created with ID: ${roomId}`);
      console.log(`Members:`, members);

      // Phát sự kiện thông báo đến các thành viên
      members.forEach((member) => {
        const socketIds = userSocketMap[member] || [];
        socketIds.forEach((socketId) => {
          io.to(socketId).emit('room-invitation', roomId);
        });
      });
    });

    // Tham gia vào một phòng cụ thể
    socket.on('join-room', ({ roomId, peerId }) => {
      console.log(`User ${peerId} joined room ${roomId}`);
      socket.join(roomId);
      socket.broadcast.to(roomId).emit('user-connected', peerId);
    });

    socket.on('leave-room', ({ roomId, peerId }) => {
      console.log(`User ${peerId} left room ${roomId}`);

      // Broadcast cho các user khác trong room biết
      socket.to(roomId).emit('user-disconnected', peerId);

      // Rời khỏi room
      socket.leave(roomId);
    });

    socket.on('end-call', ({ roomId }) => {
      console.log(`Call ended in room: ${roomId}`);
      socket.to(roomId).emit('end-call'); // Gửi sự kiện cho tất cả user trong room
    });

    // Xử lý ngắt kết nối
    socket.on('disconnect', () => {
      if (socket.userId) {
        removeSocketId(socket.userId, socket.id);
        console.log(`User ${socket.userId} disconnected, socket ID ${socket.id} removed`);
        emitOnlineUsers();
      }
    });
  });

  // Phát danh sách online hiện tại
  const emitOnlineUsers = () => {
    const onlineUsers = Object.keys(userSocketMap).filter(
      (userId) => userSocketMap[userId].length > 0
    );
    io.emit('onlineUsers', onlineUsers);
  };

  // Xóa socketId khỏi userSocketMap
  const removeSocketId = (userId, socketId) => {
    if (userSocketMap[userId]) {
      userSocketMap[userId] = userSocketMap[userId].filter((id) => id !== socketId);

      // Nếu không còn socketId nào, xóa luôn userId khỏi map
      if (userSocketMap[userId].length === 0) {
        delete userSocketMap[userId];
      }
    }
  };
};

const sendNotification = (receiverIds, notification) => {
  emitToUsers(receiverIds, 'notification', notification);
};

const sendMessage = (receiverIds, message) => {
  emitToUsers(receiverIds, 'send-message', message);
};

const sendChats = (receiverIds) => {
  emitToUsers(receiverIds, 'send-chat');
};

// Hàm chung để gửi dữ liệu đến một hoặc nhiều user
const emitToUsers = (receiverIds, eventName, data = null) => {
  receiverIds.forEach((userId) => {
    const socketIds = userSocketMap[userId] || [];
    socketIds.forEach((socketId) => {
      io.to(socketId).emit(eventName, data);
      console.log(`Event '${eventName}' sent to userId ${userId} with socket ID ${socketId}`);
    });
  });
};

module.exports = { socketConfig, sendNotification, sendMessage, sendChats };
