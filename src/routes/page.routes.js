const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const prisma = require('../services/db.service');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const fs = require('fs').promises;

const createPageValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('titleEn').trim().isLength({ min: 2, max: 100 }),
  body('titleBn').trim().isLength({ min: 2, max: 100 }),
  body('slug')
    .trim()
    .matches(/^[a-z0-9-/]+$/),
  body('layoutId').isInt().optional(),
  body('layout').isInt().optional(),
];

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});


// Protected routes below
// Add auth middleware
router.use(authMiddleware);

// Create a new page
router.post('/create', limiter, createPageValidation, async (req, res) => {
  try {
    const { name, titleEn, titleBn, slug, layout } = req.body;
    
    // Get user ID from req.user
    const userId = req.user.id || req.user.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const layoutDoc = await prisma.layout.findUnique({ 
      where: { id: parseInt(layout) }
    });

    if (!layoutDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout selected'
      });
    }

    const page = await prisma.page.create({
      data: {
        name,
        titleEn,
        titleBn,
        slug,
        layout: { 
          connect: { id: parseInt(layout) }
        },
        createdBy: {
          connect: { id: userId }
        }
      },
      include: {
        layout: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Page created successfully',
      page,
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
    const pages = await prisma.page.findMany({
      include: {
        layout: true,
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
        posts: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      success: true,
      pages,
      count: pages.length,
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pages',
    });
  }
});

// Get a single page by ID
router.get('/:id', async (req, res) => {
  try {
    const page = await prisma.page.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { layout: true },
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
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
router.put('/update-template/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { template, language } = req.body;

    // Validate template content
    if (!template || !template.html) {
      return res.status(400).json({
        success: false,
        message: 'Template content is required'
      });
    }

    // Validate language
    if (!['en', 'bn'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language specified'
      });
    }

    const templateField = language === 'en' ? 'templateEn' : 'templateBn';

    const updatedPage = await prisma.page.update({
      where: { id: parseInt(id) },
      data: {
        [templateField]: {
          content: template,
          lastModified: new Date()
        },
        metadata: {
          lastModifiedBy: req.user.id,
          updatedAt: new Date()
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      page: updatedPage
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
router.get('/template/:id/:language', async (req, res) => {
  try {
    const { id, language } = req.params;

    if (!['en', 'bn'].includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language specified'
      });
    }

    const templateField = language === 'en' ? 'templateEn' : 'templateBn';

    const page = await prisma.page.findUnique({
      where: { id: parseInt(id) },
      select: { [templateField]: true }
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found'
      });
    }

    res.status(200).json({
      success: true,
      template: page[templateField]
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
    const deletedPage = await prisma.page.delete({
      where: { id: parseInt(req.params.id) },
    });

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

// Update a page
router.put('/update/:id', createPageValidation, async (req, res) => {
  try {
    const { id } = req.params;
    const { titleEn, titleBn, slug, layout } = req.body;

    // Check if page exists
    const existingPage = await prisma.page.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existingPage) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    // Check if layout exists
    const layoutDoc = await prisma.layout.findUnique({ where: { id: layout } });
    if (!layoutDoc) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout selected',
      });
    }

    // Update the page
    const updatedPage = await prisma.page.update({
      where: { id: parseInt(id) },
      data: {
        titleEn,
        titleBn,
        slug,
        layout: { connect: { id: layout } },
        metadata: {
          update: {
            lastModifiedBy: req.user._id,
            updatedAt: new Date(),
          },
        },
      },
      include: { layout: true },
    });

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
router.put(
  '/update-template/:id/chunk',

  async (req, res) => {
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

        const updatedPage = await prisma.page.update({
          where: { id: parseInt(id) },
          data: updateData,
        });

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
  }
);

router.patch('/update-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const page = await prisma.page.update({
      where: { id: parseInt(id) },
      data: {
        status: status.toUpperCase(),
        metadata: {
          lastModifiedBy: req.user.id,
          updatedAt: new Date()
        }
      }
    });

    res.json({
      success: true,
      message: 'Status updated successfully',
      page
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status'
    });
  }
});

module.exports = router;