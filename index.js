const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
// const Pusher = require("pusher");
const http = require('http');  
const { socketConfig } = require('./socket/socket');
// const router = express.Router();

const app = express();
dotenv.config();

const authRoute = require("./routes/auth");
const userRoute = require("./routes/user");
const friendRoute = require("./routes/friend");
const postRoute = require('./routes/post');
const commentRoute = require("./routes/comment"); 
const searchRoute = require('./routes/search');
const chatRoute = require('./routes/chat')
const notificationRoute = require('./routes/notification')
const groupRoute = require('./routes/group')
const adminRoute = require('./routes/admin')

const path = require("path");
const imagekit = require("./utils/imagekitConfig");

// Tạo HTTP server từ Express
const server = http.createServer(app);


// const pusher = new Pusher({
//   appId: process.env.PUSHER_APP_ID,
//   key: process.env.PUSHER_KEY,
//   secret: process.env.PUSHER_SECRET,
//   cluster: process.env.PUSHER_CLUSTER,
//   useTLS: true,
// });

mongoose.connect(process.env.MONGODB_URL)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB', err);
  });

app.use(cors());
app.use(cookieParser());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/authentication', (req, res) => {
  const result = imagekit.getAuthenticationParameters();
  res.send(result);
});

// ROUTES
app.use("/api/auth", authRoute);
app.use("/api/user", userRoute);
app.use("/api/friend", friendRoute);
app.use("/api/post", postRoute);
app.use("/api/comment", commentRoute)
app.use('/api/search', searchRoute)
app.use('/api/chat', chatRoute)
app.use('/api/notification', notificationRoute)
app.use('/api/group', groupRoute)
app.use('/api/admin', adminRoute)

// Cấu hình Socket.IO
socketConfig(server);  // Gọi hàm cấu hình Socket.IO từ file socket.js

// Chạy server trên cổng 8000
server.listen(process.env.PORT || 8000, () => {
  console.log("Server is running");
});
