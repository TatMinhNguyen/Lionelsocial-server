const mongoose = require("mongoose");

const reportGroupSchema = new mongoose.Schema(
    {
        groupId: {
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

module.exports = mongoose.model("ReportGroupModel", reportGroupSchema);