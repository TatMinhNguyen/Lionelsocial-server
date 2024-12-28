const mongoose = require("mongoose");

const reportPostSchema = new mongoose.Schema(
    {
        postId: {
            type: String,
            required: true
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

module.exports = mongoose.model("ReportPostModel", reportPostSchema);