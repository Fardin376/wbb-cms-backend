const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/auth');

// Add auth middleware
router.use(authMiddleware);

// Get all layouts
router.get('/all-layouts', async (req, res) => {
  try {
    const layouts = await prisma.layout.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

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
    
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!name || !identifier || !content) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const layout = await prisma.layout.create({
      data: {
        name,
        identifier,
        content,
        createdById: req.user.id // Use the authenticated user's ID
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      layout,
    });
  } catch (error) {
    console.error('Error creating layout:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Layout identifier must be unique',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error creating layout',
    });
  }
});

// Update layout
router.put('/update/:id', async (req, res) => {
  try {
    const layoutId = parseInt(req.params.id);
    
    if (isNaN(layoutId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout ID',
      });
    }

    const { name, identifier, content, isActive } = req.body;

    const updates = {
      ...(name && { name }),
      ...(identifier && { identifier }),
      ...(content && { content }),
      ...(typeof isActive === 'boolean' && { isActive }),
    };

    const layout = await prisma.layout.update({
      where: { 
        id: layoutId 
      },
      data: updates,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      layout,
    });
  } catch (error) {
    console.error('Error updating layout:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        message: 'Layout identifier must be unique',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error updating layout',
    });
  }
});

// Delete layout
router.delete('/delete/:id', async (req, res) => {
  try {
    const layoutId = parseInt(req.params.id);
    
    if (isNaN(layoutId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout ID',
      });
    }

    const layout = await prisma.layout.delete({
      where: { 
        id: layoutId 
      },
    });

    res.json({
      success: true,
      message: 'Layout deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting layout:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting layout',
    });
  }
});

// Toggle layout status
router.patch('/toggle-status/:id', async (req, res) => {
  try {
    const layoutId = parseInt(req.params.id);
    
    if (isNaN(layoutId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid layout ID',
      });
    }

    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value',
      });
    }

    const layout = await prisma.layout.update({
      where: { 
        id: layoutId 
      },
      data: { isActive },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });

    res.json({
      success: true,
      layout,
    });
  } catch (error) {
    console.error('Error toggling layout status:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Layout not found',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error toggling layout status',
    });
  }
});

module.exports = router;
