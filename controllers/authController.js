const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/UserModel");
const BlackListToken = require("../models/BlackListTokenModel");
const nodemailer = require('nodemailer');

const authController = {
    //Phương thức đăng kí
    registerUser: async (req, res) => {
        try {
            // Kiểm tra xem email đã tồn tại chưa
            const existingUser = await UserModel.findOne({ email: req.body.email });
    
            if (existingUser) {
                if (!existingUser.isVerify) { // Kiểm tra xem tài khoản có xác thực chưa
                    // Nếu chưa xác thực, xóa tài khoản cũ
                    await UserModel.deleteOne({ email: req.body.email });
                } else {
                    // Nếu tài khoản đã xác thực, trả về lỗi
                    return res.status(400).json({ message: 'Email này đã được sử dụng!' });
                }
            }
    
            // Tiếp tục tạo tài khoản mới
            const salt = await bcrypt.genSalt(10);
            const hashed = await bcrypt.hash(req.body.password, salt);
    
            const verificationCode = Math.floor(100000 + Math.random() * 900000);
            const expirationTime = new Date(Date.now() + 5 * 60 * 1000);
    
            const newUser = new UserModel({
                email: req.body.email,
                username: req.body.username,
                password: hashed,
                verificationCode: verificationCode,
                verificationCodeExpires: expirationTime
            });
    
            await newUser.save();
    
            // Gửi email
            const transporter = nodemailer.createTransport({
                service: 'Gmail', 
                auth: {
                    user: 'nguyentatminh2k2@gmail.com', 
                    pass: 'owbdkqfurftirtnk'  
                }
            });
    
            const mailOptions = {
                from: 'nguyentatminh2k2@gmail.com', // Email gửi
                to: newUser.email, // Email người nhận
                subject: 'Mã xác thực tài khoản',
                text: `Mã xác thực của bạn là: ${verificationCode}. Mã này có hiệu lực trong 5 phút.`
            };
    
            await transporter.sendMail(mailOptions);
    
            res.status(200).json({ email: newUser.email, message: 'Mã xác thực đã được gửi qua email.' });
        } catch (err) {
            res.status(500).json({ message: 'Có lỗi xảy ra.', error: err.message });
        }
    },    

    //Phương thức lấy mã xác thực
    verifyAccount: async (req, res) => {
        try {
            const { email, verificationCode } = req.body;

            // Tìm người dùng trong cơ sở dữ liệu bằng email
            const user = await UserModel.findOne({ email: email });

            // Kiểm tra nếu không tìm thấy người dùng hoặc mã xác thực không chính xác
            if (!user || user.verificationCode !== verificationCode) {
                return res.status(400).json({ message: 'Invalid verification code.' });
            }

            // Kiểm tra nếu mã xác thực đã hết hạn
            if (user.verificationCodeExpires < Date.now()) {
                return res.status(400).json({ message: 'Verification code has expired.' });
            }

            // Cập nhật trạng thái xác thực cho người dùng và xóa các trường verificationCode và verificationCodeExpires
            user.isVerify = true;
            user.verificationCode = undefined;
            user.verificationCodeExpires = undefined;
            await user.save();

            // Phản hồi thành công
            res.status(200).json({ message: 'Account verified successfully.' });
        } catch (err) {
            res.status(500).json({ message: 'Có lỗi xảy ra.', error: err.message });
        }
    },

    // Phương thức để gửi lại mã xác thực
    resendVerificationCode: async (req, res) => {
        try {
            const { email } = req.body;

            const user = await UserModel.findOne({ email });

            if (!user || !user.verificationCodeExpires) {
                return res.status(404).json({ message: "Không tìm thấy tài khoản hoặc mã xác thực đã hết hạn." });
            }

            // Tạo mã xác thực mới và thời gian hết hạn mới
            const verificationCode = Math.floor(100000 + Math.random() * 900000);
            const expirationTime = new Date(Date.now() + 5 * 60 * 1000); // Thời gian hết hạn sau 5 phút

            // Cập nhật thông tin mã xác thực mới vào người dùng
            user.verificationCode = verificationCode;
            user.verificationCodeExpires = expirationTime;
            await user.save();

            // Gửi email
            const transporter = nodemailer.createTransport({
                service: 'Gmail', 
                auth: {
                    user: 'nguyentatminh2k2@gmail.com', 
                    pass: 'owbdkqfurftirtnk'  
                }
            });
    
            const mailOptions = {
                from: 'nguyentatminh2k2@gmail.com', // Email gửi
                to: user.email, // Email người nhận
                subject: 'Mã xác thực tài khoản',
                text: `Mã xác thực của bạn là: ${verificationCode}. Mã này có hiệu lực trong 5 phút.`
            };
    
            await transporter.sendMail(mailOptions);
    
            res.status(200).json({ email: user.email, message: 'Mã xác thực đã được gửi qua email.' });
        } catch (err) {
            res.status(500).json({ message: 'Có lỗi xảy ra.', error: err.message });
        }
    },

    //Tạo accessToken
    generateAccessToken: (user) => {
        return jwt.sign(
            {
                id: user.id,
                isAdmin: user.isAdmin,
            },
            process.env.JWT_ACCESS_KEY,
            { expiresIn: "30d" }
        );
    },

    //Login
    loginUser: async (req, res) => {
        try {
            const user = await UserModel.findOne({ email: req.body.email });

            if (!user) {
                return res.status(404).json("Incorrect password or email");
            }

            const validPassword = await bcrypt.compare(req.body.password, user.password);

            if (!validPassword) {
                return res.status(404).json("Incorrect password or email");
            }

            if (!user.isVerify) {
                return res.status(404).json("Account Invalid");
            }

            if(user.isBan) {
                return res.status(404).json('Account banned')
            }

            // Generate access token
            const accessToken = authController.generateAccessToken(user);

            const result = {
                userId : user._id,
                username : user.username,
                avatar : user.profilePicture,
                isAdmin: user.isAdmin,
                token : accessToken
            }
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ message: 'Có lỗi xảy ra.', error: error.message });
        }
    },

    //Change password
    changePassword: async (req, res) => {
        try {
            // Lấy thông tin từ request
            const { oldPassword, newPassword } = req.body;

            // Tìm người dùng theo ID
            const user = await UserModel.findById(req.user.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Kiểm tra mật khẩu cũ
            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                return res.status(400).json({ message: 'Incorrect old password' });
            }

            // Tạo mật khẩu mới
            const salt = await bcrypt.genSalt(10);
            const hashedNewPassword = await bcrypt.hash(newPassword, salt);

            // Lưu mật khẩu mới vào cơ sở dữ liệu
            user.password = hashedNewPassword;
            await user.save();

            res.status(200).json({ message: 'Password changed successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Có lỗi xảy ra.', error: err.message });
        }
    },

    logOut: async (req, res) => {
        try {
            const token = req.headers.token;

            // Tìm người dùng theo ID
            const user = await UserModel.findById(req.user.id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            // Thêm token vào cơ sở dữ liệu
            const blacklistedToken = new BlackListToken({ token });
            await blacklistedToken.save();

            res.status(200).json({ message: 'Logged out successfully' });
        } catch (err) {
            res.status(500).json({ message: 'Internal server error', error: err.message });
        }
    },

    // Tạo mật khẩu ngẫu nhiên
    generateRandomPassword: () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 6; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    },

    // Quên mật khẩu
    forgotPassword: async (req, res) => {
        try {
            const { email } = req.body;
            const user = await UserModel.findOne({ email });

            if (!user) {
                return res.status(403).json({ message: 'Email không tồn tại.' });
            }

            if (!user.isVerify) {
                return res.status(403).json("Account Invalid");
            }

            const newPassword = authController.generateRandomPassword();
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            user.password = hashedPassword;
            await user.save();

            res.status(200).json({ email: email, newPassword: newPassword });
        } catch (err) {
            res.status(500).json({ message: 'Có lỗi xảy ra.', error: err.message });
        }
    },
}

module.exports = authController;
