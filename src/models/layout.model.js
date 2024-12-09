const mongoose = require('mongoose');

const layoutSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    identifier: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9-]+$/, 'Identifier format is invalid'],
    },
    content: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Remove any pre-save hooks that might be handling slug generation
layoutSchema.pre('save', function(next) {
  // Only validation, no slug generation
  next();
});

const Layout = mongoose.model('Layout', layoutSchema);
module.exports = Layout;
