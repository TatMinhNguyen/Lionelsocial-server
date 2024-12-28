const mongoose = require("mongoose");
const validator = require('validator');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,  
      maxlength: 50,   
      unique: true,    
      validate: {
        validator: function(value) {
          return validator.isEmail(value);  
        },
        message: props => `${props.value} is not a valid email!`  
      }
    },
    username: {
      type: String,
      required: true,  
      minlength: 5,
      maxlength: 50, 
    },    
    password: {
      type: String,
      required: true,  
      minlength: 6,    
    },
    profilePicture: {
      type: String,
      default: "https://ik.imagekit.io/minhnt204587/Avatar/user.png",
    },
    coverPicture: {
      type: String,
      default: "https://ik.imagekit.io/minhnt204587/Avatar/hinh-anh-thien-nhien-dep-3d-002.jpg"
    },
    address:{
      type: String,
      default: ""
    },
    work:{
      type: String,
      default: ""
    },  
    blocked: {
      type: Array,
      default: []
    },
    blocking: {
      type: Array,
      default: []
    },
    friendRequested: [
      { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'UserModel', 
        default: []
      }
    ],
    friendRequesting: {
      type: Array,
      default: []
    },
    friends: {
      type: Array,
      default: []
    },
    friendsCount: {
      type: Number,
      default: 0
    },
    verificationCode: {
      type: String,
      default: null 
    },
    verificationCodeExpires: {
      type: Date,
      default: null  
    },
    isVerify: {
      type: Boolean,
      default: false
    },
    isBan: {
      type: Boolean,
      default: false
    },
    isAdmin : {type : Boolean, default: false}
  },
  { timestamps: true }  
);

module.exports = mongoose.model("UserModel", userSchema);