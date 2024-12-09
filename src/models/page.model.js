const mongoose = require('mongoose');
const sanitizeHtml = require('sanitize-html');
const { JSDOM } = require('jsdom');

const templateSchema = {
  content: {
    type: String,
    set: function(content) {
      if (!content) {
        return JSON.stringify({
          html: '',
          css: '',
          js: '',
          assets: []
        });
      }

      try {
        const parsed = typeof content === 'string' ? JSON.parse(content) : content;
        
        // Ensure assets are properly handled
        const assets = Array.isArray(parsed.assets) ? parsed.assets
          .filter(asset => asset && asset.src) // Filter out invalid assets
          .map(asset => ({
            src: asset.src,
            type: asset.type || 'image',
            name: asset.name || asset.src.split('/').pop()
          })) : [];

        console.log('Processing template assets in model:', {
          receivedAssets: parsed.assets,
          processedAssets: assets
        });

        // Extract image sources from HTML using JSDOM
        const dom = new JSDOM(parsed.html || '');
        const imgElements = dom.window.document.getElementsByTagName('img');
        const htmlAssets = Array.from(imgElements)
          .map(img => ({
            src: img.getAttribute('src'),
            type: 'image',
            name: img.getAttribute('alt') || img.getAttribute('src').split('/').pop()
          }))
          .filter(asset => asset && asset.src);

        console.log('Found HTML assets:', htmlAssets);

        // Combine and deduplicate assets
        const allAssets = [...assets, ...htmlAssets];
        const uniqueAssets = Array.from(new Set(allAssets.map(a => a.src)))
          .map(src => allAssets.find(a => a.src === src))
          .filter(asset => asset && asset.src);

        console.log('Final unique assets:', uniqueAssets);

        const sanitizedHtml = sanitizeHtml(parsed.html || '', {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'style', 'link', 'div', 'span', 'section', 'article',
            'header', 'footer', 'nav', 'main', 'aside', 'img'
          ]),
          allowedAttributes: {
            ...sanitizeHtml.defaults.allowedAttributes,
            '*': ['class', 'id', 'style', 'data-*'],
            'link': ['href', 'rel', 'type'],
            'style': ['type'],
            'img': ['src', 'alt', 'title', 'width', 'height', 'loading', 'style', 'data-gjs-type', 'draggable']
          },
          allowedStyles: {
            '*': {
              'color': [/.*/],
              'background-color': [/.*/],
              'text-align': [/.*/],
              'margin': [/.*/],
              'padding': [/.*/],
              'background-image': [/.*/],
              'width': [/.*/],
              'height': [/.*/],
              'max-width': [/.*/],
              'max-height': [/.*/],
              'object-fit': [/.*/],
              'display': [/.*/]
            }
          }
        });

        const template = {
          html: sanitizedHtml,
          css: parsed.css || '',
          js: parsed.js || '',
          assets: uniqueAssets
        };

        console.log('Saving template with assets count:', uniqueAssets.length);
        return JSON.stringify(template);
      } catch (e) {
        console.error('Error parsing template content:', e);
        return JSON.stringify({
          html: '',
          css: '',
          js: '',
          assets: []
        });
      }
    }
  },
  lastModified: Date
};

const PageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-/]+$/, 'Invalid slug format'],
    validate: {
      validator: function(v) {
        // Allow nested paths but ensure they're properly formatted
        return /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(v.replace(/^\/+|\/+$/g, ''));
      },
      message: props => `${props.value} is not a valid slug format!`
    }
  },
  layout: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Layout',
    required: true,
  },
  template: {
    en: templateSchema,
    bn: templateSchema
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
  },
  metadata: {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedAt: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Add index for faster queries
PageSchema.index({ slug: 1, isActive: 1 });

// Add validation to ensure slug matches menu slug
PageSchema.pre('save', async function(next) {
  try {
    const Menu = mongoose.model('Menu');
    const menuExists = await Menu.findOne({ slug: this.slug });
    
    if (!menuExists) {
      throw new Error('Page slug must match an existing menu slug');
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Modify the pre-save middleware
PageSchema.pre('save', function(next) {
  // Initialize template objects if they don't exist
  if (!this.template) {
    this.template = {
      en: {
        content: JSON.stringify({
          html: '',
          css: '',
          js: '',
          assets: []
        }),
        lastModified: new Date()
      },
      bn: {
        content: JSON.stringify({
          html: '',
          css: '',
          js: '',
          assets: []
        }),
        lastModified: new Date()
      }
    };
  }

  // Ensure both language templates exist with at least empty content
  if (!this.template.en) {
    this.template.en = {
      content: JSON.stringify({
        html: '',
        css: '',
        js: '',
        assets: []
      }),
      lastModified: new Date()
    };
  }

  if (!this.template.bn) {
    this.template.bn = {
      content: JSON.stringify({
        html: '',
        css: '',
        js: '',
        assets: []
      }),
      lastModified: new Date()
    };
  }

  next();
});

// Add this method to the schema
PageSchema.methods.toJSON = function() {
  const obj = this.toObject();
  // Ensure template structure in JSON response
  if (obj.template) {
    obj.template = {
      en: obj.template.en || null,
      bn: obj.template.bn || null
    };
  }
  return obj;
};

const Page = mongoose.model('Page', PageSchema);

module.exports = Page;
