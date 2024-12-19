const mongoose = require('mongoose');

const FooterLinkSchema = new mongoose.Schema(
  {
    position: {
      type: String,
      required: true,
      enum: ['Left', 'Right', 'Center'], // Add more positions if needed
    },
    name: {
      en: { type: String, required: true },
      bn: { type: String, required: true },
    },
    url: {
      type: String,
      required: true,
    },
    serial: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['Published', 'Unpublished'], // Only allows these two statuses
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FooterLink', FooterLinkSchema);
