const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const Page = require('../models/page.model');
const Layout = require('../models/layout.model');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// const auth = require('../middleware/auth');

const createPageValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('slug')
    .trim()
    .matches(/^[a-z0-9-/]+$/),
  body('layoutId').isMongoId().optional(),
  body('layout').isMongoId().optional(),
];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'pages');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      console.log('Created upload directory:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log('Generated filename:', filename);
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|svg|webp/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    console.log('File upload attempt:', {
      // Debug log
      filename: file.originalname,
      mimetype: file.mimetype,
      validExt: extname,
      validMime: mimetype,
    });

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
});

// Public routes
router.get('/public/by-slug/:slug', async (req, res) => {
  try {
    const page = await Page.findOne({
      slug: req.params.slug,
      isActive: true,
      status: 'published', // Only get published pages
    })
      .populate({
        path: 'layout',
        select: 'name content',
      })
      .lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Ensure layout content is properly parsed
    if (page.layout && page.layout.content) {
      try {
        if (typeof page.layout.content === 'string') {
          page.layout.content = JSON.parse(page.layout.content);
        }
      } catch (parseError) {
        console.error('Error parsing layout content:', parseError);
        page.layout.content = { html: '', css: '' };
      }
    }

    res.status(200).json({
      success: true,
      page,
    });
  } catch (error) {
    console.error('Error fetching page by slug:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: error.message,
    });
  }
});

// Protected routes below
// router.use(auth);

// Create a new page
router.post('/create', limiter, createPageValidation, async (req, res) => {
  try {
    const { name, slug, layout } = req.body;

    const layoutDoc = await Layout.findById(layout);
    if (!layoutDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout selected',
      });
    }

    const page = new Page({
      name,
      slug,
      layout,
      metadata: {
        createdBy: req.user._id,
        lastModifiedBy: req.user._id,
      },
    });

    await page.save();

    const populatedPage = await Page.findById(page._id).populate('layout');

    res.status(201).json({
      success: true,
      message: 'Page created successfully',
      page: populatedPage,
    });
  } catch (error) {
    console.error('Error creating page:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating page',
      error: error.message,
    });
  }
});

// Get all pages
router.get('/all-pages', async (req, res) => {
  try {
    const pages = await Page.find()
      .populate({
        path: 'layout',
        select: 'name content',
      })
      .populate({
        path: 'metadata.createdBy',
        select: 'username role',
      })
      .populate({
        path: 'metadata.lastModifiedBy',
        select: 'username role',
      })
      .lean();

    res.status(200).json({
      success: true,
      pages,
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pages',
      error: error.message,
    });
  }
});

// Get a single page by ID
router.get('/:id', async (req, res) => {
  try {
    const page = await Page.findById(req.params.id)
      .populate({
        path: 'layout',
        select: 'name content',
      })
      .lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Ensure layout content is properly parsed
    if (page.layout && page.layout.content) {
      try {
        if (typeof page.layout.content === 'string') {
          page.layout.content = JSON.parse(page.layout.content);
        }
      } catch (parseError) {
        console.error('Error parsing layout content:', parseError);
        page.layout.content = { html: '', css: '' };
      }
    }

    res.status(200).json({
      success: true,
      page,
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: error.message,
    });
  }
});

// Update template endpoint
router.put('/update-template/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { template, language } = req.body;

    // Validate template content
    if (!template || !template.html) {
      return res.status(400).json({
        success: false,
        message: 'Template content is required',
      });
    }

    // Validate language
    if (!['en', 'bn'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language specified',
      });
    }

    // First, get the existing page
    const page = await Page.findById(id);
    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Initialize template structure if it doesn't exist
    if (!page.template) {
      page.template = {
        en: { content: null, lastModified: new Date() },
        bn: { content: null, lastModified: new Date() }
      };
    }

    // Update the template content
    page.template[language] = {
      content: template,
      lastModified: new Date()
    };

    // Update metadata
    page.metadata = {
      ...page.metadata,
      lastModifiedBy: req.user._id,
      updatedAt: new Date()
    };

    // Save the updated page
    const updatedPage = await page.save();

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      page: updatedPage,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating template',
      error: error.message,
    });
  }
});

// Add template retrieval endpoint
router.get('/template/:id/:language', auth, async (req, res) => {
  try {
    const { id, language } = req.params;

    if (!['en', 'bn'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language specified',
      });
    }

    const page = await Page.findById(id).select(`template.${language}`).lean();

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    res.status(200).json({
      success: true,
      template: page.template[language],
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching template',
      error: error.message,
    });
  }
});

// Delete a page by ID
router.delete('/delete/:id', async (req, res) => {
  try {
    const deletedPage = await Page.findByIdAndDelete(req.params.id);
    if (!deletedPage)
      return res
        .status(404)
        .json({ success: false, message: 'Page not found' });

    res
      .status(200)
      .json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ success: false, message: 'Error deleting page' });
  }
});

// Add status toggle endpoint for pages
router.patch('/toggle-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const page = await Page.findByIdAndUpdate(id, { isActive }, { new: true });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      page,
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
    });
  }
});

router.patch('/update-status/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const page = await Page.findByIdAndUpdate(
      id,
      {
        status,
        'metadata.lastModifiedBy': req.user._id,
        'metadata.updatedAt': new Date(),
      },
      { new: true }
    );

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      page,
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
    });
  }
});

// Update a page
router.put('/update/:id', createPageValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, layout } = req.body;

    // Check if page exists
    const existingPage = await Page.findById(id);
    if (!existingPage) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Check if layout exists
    const layoutDoc = await Layout.findById(layout);
    if (!layoutDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout selected',
      });
    }

    // Update the page
    const updatedPage = await Page.findByIdAndUpdate(
      id,
      {
        name,
        slug,
        layout,
        'metadata.lastModifiedBy': req.user._id,
        'metadata.updatedAt': new Date(),
      },
      { new: true }
    ).populate('layout');

    res.status(200).json({
      success: true,
      message: 'Page updated successfully',
      page: updatedPage,
    });
  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating page',
      error: error.message,
    });
  }
});

// Add chunked template update endpoint
router.put('/update-template/:id/chunk', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { chunk, index, total, language } = req.body;

    // Store chunk in memory or temporary storage
    if (!global.templateChunks) {
      global.templateChunks = {};
    }
    if (!global.templateChunks[id]) {
      global.templateChunks[id] = [];
    }

    global.templateChunks[id][index] = chunk;

    // Check if all chunks received
    if (
      global.templateChunks[id].length === total &&
      !global.templateChunks[id].includes(undefined)
    ) {
      // Combine chunks
      const completeTemplate = JSON.parse(global.templateChunks[id].join(''));

      // Update the page with complete template
      const updateData = {
        [`template.${language}.content`]: completeTemplate,
        [`template.${language}.lastModified`]: new Date(),
        'metadata.lastModifiedBy': req.user._id,
        'metadata.updatedAt': new Date(),
      };

      const updatedPage = await Page.findByIdAndUpdate(
        id,
        { $set: updateData },
        {
          new: true,
          runValidators: true,
        }
      );

      // Cleanup chunks
      delete global.templateChunks[id];

      res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        page: updatedPage,
      });
    } else {
      res.status(200).json({
        success: true,
        message: `Chunk ${index + 1} of ${total} received`,
      });
    }
  } catch (error) {
    console.error('Error handling template chunk:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating template chunk',
      error: error.message,
    });
  }
});

// Add this route to handle asset uploads
router.post('/upload-asset', auth, upload.array('files'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const urls = req.files.map((file) => ({
      url: `/uploads/pages/${file.filename}`,
      name: file.originalname,
      type: file.mimetype,
      size: file.size,
    }));

    console.log('Generated URLs:', urls);

    res.json({
      success: true,
      urls,
      message: 'Files uploaded successfully',
    });
  } catch (error) {
    console.error('Error uploading assets:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading files',
      error: error.message,
    });
  }
});

module.exports = router;
