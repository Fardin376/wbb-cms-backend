const mongoose = require('mongoose');
const slugify = require('slugify'); // To create URL-friendly slugs

const MenuSchema = new mongoose.Schema({
  title: {
    en: { 
      type: String, 
      required: true,
      trim: true,
      maxLength: 200 
    },
    bn: { 
      type: String, 
      required: true,
      trim: true,
      maxLength: 200 
    },
  },
  slug: {
    type: String,
    unique: true,
    maxLength: 300,
    lowercase: true,
    trim: true,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Menu',
    default: null,
    validate: {
      validator: async function(v) {
        if (!v) return true;
        
        // Check if parent exists
        const parent = await this.constructor.findById(v);
        if (!parent) return false;
        
        // Prevent self-reference
        if (this._id && this._id.equals(v)) return false;
        
        // Check for circular reference
        let currentParent = parent;
        while (currentParent) {
          if (currentParent._id.equals(this._id)) return false;
          currentParent = await this.constructor.findById(currentParent.parentId);
        }
        
        return true;
      },
      message: 'Invalid parent menu: Cannot create circular reference'
    }
  },
  isExternalLink: {
    type: Boolean,
    default: false,
  },
  url: {
    type: String,
    default: null,
    validate: {
      validator: function(v) {
        if (!v) return true;
        const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
        return urlPattern.test(v);
      },
      message: 'Invalid URL format'
    }
  },
  order: {
    type: Number,
    default: 0,
    min: 0,
    max: 999999
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

MenuSchema.pre('save', async function (next) {
  // Skip for external links
  if (this.isExternalLink || this.url) {
    next();
    return;
  }

  // Always generate slug from title
  let baseSlug = slugify(this.title.en, { lower: true, strict: true });
    
  // Add parent slug prefix if exists
  if (this.parentId) {
    const parentMenu = await this.model('Menu').findById(this.parentId);
    if (parentMenu) {
      baseSlug = `${parentMenu.slug}/${baseSlug}`;
    }
  }

  // Ensure slug starts with forward slash
  this.slug = baseSlug.startsWith('/') ? baseSlug : `/${baseSlug}`;

  // Prevent self-referential parent
  if (this.parentId && this.parentId.equals(this._id)) {
    throw new Error('Menu item cannot be its own parent');
  }

  this.updatedAt = new Date();
  next();
});

MenuSchema.index({ slug: 1 }, { unique: true });
MenuSchema.index({ parentId: 1 });
MenuSchema.index({ isActive: 1 });
MenuSchema.index({ order: 1 });
MenuSchema.index({ 'title.en': 'text', 'title.bn': 'text' });
MenuSchema.index({ 'title.en': 1 }, { unique: true });
MenuSchema.index({ 'title.bn': 1 }, { unique: true });

const Menu = mongoose.model('Menu', MenuSchema);

module.exports = Menu;
