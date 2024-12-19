const express = require('express');
const mongoose = require('mongoose');
const Banner = require('../models/banner.model');
const verifyTokenMiddleware = require('../middleware/tokenVerification');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Add auth middleware
router.use(verifyTokenMiddleware);
router.use(authMiddleware);

// Validation middleware
const validateBannerUpload = (req, res, next) => {
  const { url, fileName, uploadedBy } = req.body;

  if (!url || !fileName || !uploadedBy) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: url, fileName, or uploadedBy',
    });
  }

  next();
};

// Route to upload a new banner
router.post('/upload', validateBannerUpload, async (req, res) => {
  try {
    const { url, fileName, title, description } = req.body;

    const newBanner = await Banner.create({
      url,
      fileName,
      title,
      description,
      uploadedBy: req.user.userId,
    });

    res.status(201).json({
      success: true,
      banner: newBanner,
    });
  } catch (error) {
    console.error('Error uploading banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Banner upload failed',
    });
  }
});

// Route to fetch all banners
router.get('/all-banners', async (req, res) => {
  try {
    const banners = await Banner.find()
      .populate('uploadedBy', 'username role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      banners,
    });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch banners',
    });
  }
});

// Route to delete a banner by ID
router.delete('/banner/:id', async (req, res) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete banner',
    });
  }
});

// Route to clean up orphaned banners (if additional references like Page exist)
router.delete('/cleanup', async (req, res) => {
  try {
    const Page = mongoose.model('Page');

    const banners = await Banner.find();

    for (const banner of banners) {
      if (banner.usageTypes?.pageId) {
        const pageExists = await Page.findById(banner.usageTypes.pageId);
        if (!pageExists) {
          await Banner.findByIdAndDelete(banner._id);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Orphaned banners cleaned up successfully',
    });
  } catch (error) {
    console.error('Error cleaning up banners:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clean up orphaned banners',
    });
  }
});

router.patch('/toggle-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Expect "published" or "unpublished"

    console.log('Toggle Status Route Hit:', req.params.id, req.body.status);

    if (!['published', 'unpublished'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    // Update banner status
    const banner = await Banner.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found',
      });
    }

    res.json({
      success: true,
      message: 'Banner status updated successfully',
      banner,
    });
  } catch (error) {
    console.error('Error updating banner status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating banner status',
    });
  }
});

module.exports = router;
