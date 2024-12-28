const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        chatId: {
            type: String,
        },
        senderId: {
            type: mongoose.Schema.Types.ObjectId, ref: 'UserModel'
        },
        text: {
            type: String,
            default: ''
        },
        image: {
            type: Object
        },
    },
    { timestamps: true }
)

module.exports = mongoose.model("MessageModel", messageSchema);