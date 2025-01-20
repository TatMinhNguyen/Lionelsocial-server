const mongoose = require("mongoose");

const reportUserSchema = new mongoose.Schema(
    {
        reportedUserId: { // ID của người dùng bị báo cáo
            type: String,
            required: true
        },
        reporterUserId: { // ID của người báo cáo
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

module.exports = mongoose.model("ReportUserModel", reportUserSchema);