const mongoose = require('mongoose');

const GallerySchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  usageTypes: {
    isPost: {
      type: Boolean,
      default: false
    },
    isCover: {
      type: Boolean,
      default: true
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post'
    }
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Gallery', GallerySchema);
