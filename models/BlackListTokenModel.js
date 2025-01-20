const mongoose = require('mongoose');

const BlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: { expires: '30d' } // TTL index sẽ tự động xóa tài liệu sau 7 ngày
  }
     
  },
    { timestamps: true }
);

module.exports = mongoose.model('BlackListToken', BlacklistSchema);
