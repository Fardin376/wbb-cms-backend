const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  title: {
    en: { type: String, required: true, trim: true, maxLength: 500 },
    bn: { type: String, required: true, trim: true, maxLength: 500 },
  },
  content: {
    en: { type: String, required: true, trim: true, maxLength: 500000 },
    bn: { type: String, required: true, trim: true, maxLength: 500000 },
  },
  pages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
    },
  ],
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  },
  slug: {
    type: String,
    unique: true,
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
    index: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PostSchema.index({ pages: 1, category: 1 });
PostSchema.index({ isActive: 1, isFeatured: 1 });
PostSchema.index({ isActive: 1, category: 1 });

PostSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = `${this.title.en
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;
  }
  next();
});

const Post = mongoose.model('Post', PostSchema);

module.exports = Post;
