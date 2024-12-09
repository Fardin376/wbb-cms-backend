const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema(
  {
    name: {
      en: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
        minLength: 2,
        validate: {
          validator: function (v) {
            return /^[a-zA-Z0-9\s-_]+$/.test(v);
          },
          message:
            'English name can only contain letters, numbers, spaces, hyphens and underscores',
        },
      },
      bn: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100,
        minLength: 2,
      },
    },
    type: {
      type: String,
      enum: {
        values: ['research', 'publications', 'news', 'articles', 'other'],
        message:
          '{VALUE} is not supported. Type must be one of: research, publications, news, articles, other',
      },
      required: [true, 'Category type is required'],
      default: 'other',
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
  {
    timestamps: true,
  }
);

// Add unique index for category names
CategorySchema.index({ 'name.en': 1 }, { unique: true });
CategorySchema.index({ 'name.bn': 1 }, { unique: true });

const Category = mongoose.model('Category', CategorySchema);
module.exports = Category;
