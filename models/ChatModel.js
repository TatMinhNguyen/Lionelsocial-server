const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
    {
        members: 
            [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserModel', required: true }],
        name:{
            type: String
        },
        avatar:{
            type: String,
            default: "https://ik.imagekit.io/minhnt204587/Chat/chat-group.png"
        },
        createId:{
            type: mongoose.Schema.Types.ObjectId, ref: 'UserModel'
            // required: true
        },
        messageCount:{
            type:Number,
            default:0
        },
        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UserModel' }],
        read: { type: Boolean, default: false }
    },
    { timestamps: true }
)

module.exports = mongoose.model("ChatModels", chatSchema);