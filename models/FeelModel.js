const mongoose = require("mongoose");

const feelSchema = new mongoose.Schema(
    {
        postId: {
            type: String,
        },
        userId: {
            type: String,
            required: true
        },
        type: {
            type: String,
            default: '-1'
        },
    },
    { timestamps: true }
)

module.exports = mongoose.model("FeelModel", feelSchema);