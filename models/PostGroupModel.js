const mongoose = require("mongoose");

const postGroupSchema = new mongoose.Schema(
    {
        groupId: {
            type: String,
            required: true
        },
        userId:{
            type: String,
            required: true
        },
        description:{
            type: String,
            // required: true  
            default: ""          
        },
        images:{
            type: Array,
            default: []
        },
        video:{
            type: Object
        },
        comment:{
            type: Number,
            default: 0
        },
        felt:{
            type: Number,
            default: 0
        },
        typeText: {
            type: Boolean,
            default: true
        },
        reported:{
            type: Number,
            default: 0          
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


module.exports = mongoose.model("PostGroupModel", postGroupSchema);