const mongoose = require('mongoose');

const PdfSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    fileSize: Number,
    mimeType: String,
    usageTypes: {
      isPublication: {
        type: Boolean,
        default: false,
      },
      isResearch: {
        type: Boolean,
        default: false,
      },
      postId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
      },
      categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    metadata: {
      title: String,
      description: String,
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Pdf', PdfSchema);
