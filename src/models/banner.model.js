const mongoose = require('mongoose');

const BannerSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['published', 'unpublished'],
      default: 'unpublished',
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      default: '', // Optional banner title
    },
    description: {
      type: String,
      default: '', // Optional description for the banner
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Banner', BannerSchema);
