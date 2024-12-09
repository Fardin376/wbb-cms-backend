const express = require('express');
const mongoose = require('mongoose');
const Gallery = require('../models/gallery.model');
const router = express.Router();
const auth = require('../middleware/auth');

// Add auth middleware
router.use(auth);

// Validation middleware
const validateImageUpload = (req, res, next) => {
  const { url, fileName, usageTypes, uploadedBy } = req.body;

  if (!url || !fileName || !uploadedBy) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
  }

  if (usageTypes.isPost && !mongoose.Types.ObjectId.isValid(usageTypes.postId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid post ID'
    });
  }

  if (usageTypes.isPage && !mongoose.Types.ObjectId.isValid(usageTypes.pageId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid page ID'
    });
  }

  next();
};

router.post('/upload', validateImageUpload, async (req, res) => {
  try {
    const { url, fileName, usageTypes, uploadedBy } = req.body;

    const newImage = await Gallery.create({
      url,
      fileName,
      usageTypes,
      uploadedBy,
    });

    res.status(201).json({
      success: true,
      image: newImage
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Image upload failed'
    });
  }
});

router.get('/images', async (req, res) => {
  try {
    const images = await Gallery.find()
      .populate({
        path: 'usageTypes.postId',
        select: 'title.en isActive',
        populate: {
          path: 'category',
          select: 'name.en'
        }
      })
      .populate('uploadedBy', 'username role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: images.length,
      images
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch images'
    });
  }
});

// Add cleanup route for orphaned images
router.delete('/cleanup', async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    const Page = mongoose.model('Page');
    
    const orphanedImages = await Gallery.find({
      $or: [
        { 'usageTypes.isPost': true },
        { 'usageTypes.isPage': true }
      ]
    });

    for (const image of orphanedImages) {
      if (image.usageTypes.isPost) {
        const postExists = await Post.findById(image.usageTypes.postId);
        if (!postExists) {
          await Gallery.findByIdAndDelete(image._id);
        }
      }
      if (image.usageTypes.isPage) {
        const pageExists = await Page.findById(image.usageTypes.pageId);
        if (!pageExists) {
          await Gallery.findByIdAndDelete(image._id);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Orphaned images cleaned up successfully'
    });
  } catch (error) {
    console.error('Error cleaning up orphaned images:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to clean up orphaned images'
    });
  }
});

// Add this route
router.delete('/image/:id', async (req, res) => {
  try {
    const image = await Gallery.findByIdAndDelete(req.params.id);
    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    res.status(200).json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete image'
    });
  }
});

module.exports = router;
