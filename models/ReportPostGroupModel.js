const mongoose = require("mongoose");

const reportPostGroupSchema = new mongoose.Schema(
    {
        postId: {
            type: String,
            required: true
        },
        groupId:{
            type: String,
        },
        userId: {
            type: String,
            required: true
        },
        content: {
            type: String,
            default: ""
        },
        type: {
            type: Number,
        }
    },
    { timestamps: true }
)

module.exports = mongoose.model("ReportPostGroupModel", reportPostGroupSchema);