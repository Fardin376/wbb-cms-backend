const express = require('express');
const router = express.Router();
const Layout = require('../models/layout.model');
const verifyTokenMiddleware = require('../middleware/tokenVerification');
const authMiddleware = require('../middleware/auth');

// Add auth middleware
router.use(verifyTokenMiddleware);
router.use(authMiddleware);

// Get all layouts
router.get('/all-layouts', async (req, res) => {
  try {
    const layouts = await Layout.find()
      .sort({ createdAt: -1 })
      .populate('createdBy');

    res.status(200).json({
      success: true,
      layouts,
      count: layouts.length,
    });
  } catch (error) {
    console.error('Error fetching layouts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching layouts',
    });
  }
});

// Create new layout
router.post('/create', async (req, res) => {
  try {
    const { name, identifier, content } = req.body;
    const userId = req.user?.userId; 

    // Validate required fields
    if (!name || !identifier || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: User ID is required',
      });
    }

    const layout = await Layout.create({
      name,
      identifier,
      content,
      createdBy: userId, 
    });

    res.status(201).json({
      success: true,
      layout,
    });
  } catch (error) {
    console.error('Error creating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating layout',
    });
  }
});


// Update layout
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, identifier, content, isActive } = req.body;

    // Only allow specific fields to be updated
    const updates = {
      ...(name && { name }),
      ...(identifier && { identifier }),
      ...(content && { content }),
      ...(typeof isActive === 'boolean' && { isActive }),
    };

    const layout = await Layout.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    res.json({
      success: true,
      layout,
    });
  } catch (error) {
    console.error('Error updating layout:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating layout',
    });
  }
});

// Delete layout
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const layout = await Layout.findByIdAndDelete(id);

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    res.json({
      success: true,
      message: 'Layout deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting layout:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting layout',
    });
  }
});

// Toggle layout status
router.patch('/toggle-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value',
      });
    }

    const layout = await Layout.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    );

    if (!layout) {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }

    res.json({
      success: true,
      layout,
    });
  } catch (error) {
    console.error('Error toggling layout status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling layout status',
    });
  }
});

module.exports = router;
