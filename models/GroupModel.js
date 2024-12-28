const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
    {
        members: 
            [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }],
        name:{
            type: String,
            required: true
        },
        avatar:{
            type: String,
            default: "https://ik.imagekit.io/minhnt204587/Group/hinh-nen-lam-viec-nhom_053605680.jpg"
        },
        createId:{
            type: mongoose.Schema.Types.ObjectId, ref: 'UserModel',
            required: true
        },
        type: {
            type: Boolean,
            default: true //true: public
        },
        pendingMembers: {
            type: Array
        },
        pendingPosts: {
            type: Array
        },
        postsReported: {
            type: Array
        },
        isVerify: {
            type: Boolean,
            default: true
        },
        isReported: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("GroupModels", groupSchema);