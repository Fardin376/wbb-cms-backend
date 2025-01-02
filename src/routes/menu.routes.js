const express = require('express');
const { PrismaClient } = require('@prisma/client');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// Public route: Fetch all active menu items
router.get('/public/get-menu-items', async (req, res) => {
  try {
    const menuItems = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });
    res.status(200).json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve menu items.' });
  }
});

// Middleware to authenticate and verify token
router.use(authMiddleware); // Add user to req.user

// Rate limiting for menu creation
const createMenuLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Update validation middleware for menu input
const validateMenuInput = [
  body('titleEn')
    .trim()
    .notEmpty()
    .withMessage('English title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be at most 200 characters'),
  body('titleBn')
    .trim()
    .notEmpty()
    .withMessage('Bengali title is required')
    .isLength({ max: 200 })
    .withMessage('Title must be at most 200 characters'),
  body('url')
    .optional({ nullable: true })
    .isURL()
    .withMessage('Must be a valid URL'),
  body('order')
    .optional()
    .isInt({ min: 0, max: 999999 })
    .withMessage('Order must be between 0 and 999999'),
  body('parentId')
    .optional({ nullable: true })
    .isInt()
    .withMessage('Parent ID must be an integer'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  body('isExternalLink')
    .optional()
    .isBoolean()
    .withMessage('isExternalLink must be a boolean')
];

// Update duplicate title check middleware
const checkDuplicateTitle = async (req, res, next) => {
  try {
    const { titleEn, titleBn } = req.body;
    const existingMenu = await prisma.menu.findFirst({
      where: {
        OR: [
          { titleEn },
          { titleBn }
        ]
      }
    });

    if (req.params.id) {
      const id = parseInt(req.params.id);
      if (existingMenu && existingMenu.id !== id) {
        return res.status(400).json({
          success: false,
          message: 'Menu item with this title already exists'
        });
      }
    } else if (existingMenu) {
      return res.status(400).json({
        success: false,
        message: 'Menu item with this title already exists'
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking for duplicate menu items'
    });
  }
};

// Protected route: Create a new menu
router.post('/create-menu', createMenuLimiter, validateMenuInput, checkDuplicateTitle, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // Create menu item with validated data
    const newMenu = await prisma.menu.create({
      data: {
        titleEn: req.body.titleEn,
        titleBn: req.body.titleBn,
        slug: req.body.slug,
        parentId: req.body.parentId,
        isExternalLink: req.body.isExternalLink,
        url: req.body.url,
        isActive: req.body.isActive,
        order: req.body.order
      }
    });

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully!',
      menu: newMenu
    });
  } catch (error) {
    console.error('Error creating menu:', error);
    res.status(500).json({ success: false, message: 'Error creating menu' });
  }
});

// Protected route: Get all active menu items
router.get('/get-all-menu-items',  async (req, res) => {
  try {
    const menuItems = await prisma.menu.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' }
    });
    res.status(200).json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve menu items.' });
  }
});

// Protected route: Get all active menu items based on query parameter
router.get('/get-all-active-menu-items', async (req, res) => {
  try {
    // Check if `isActive` is provided in the query
    const isActive = req.query.isActive === 'true'; // Convert query string to boolean

    const menuItems = await prisma.menu.findMany({
      where: { isActive },
      orderBy: { order: 'asc' }
    });
    res.status(200).json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Error fetching active menu items:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve menu items.' });
  }
});

// Protected route: Get single menu item
router.get('/get-menu/:id', async (req, res) => {
  try {
    const menuId = parseInt(req.params.id);
    const menuItem = await prisma.menu.findUnique({
      where: { id: menuId }
    });

    if (!menuItem) {
      return res.status(404).json({ 
        success: false, 
        message: 'Menu item not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: menuItem 
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve menu item' 
    });
  }
});

// Protected route: Update menu
router.patch('/update-menu/:id', validateMenuInput, checkDuplicateTitle, async (req, res) => {
  try {
    const menuId = parseInt(req.params.id);
    const updatedMenu = await prisma.menu.update({
      where: { id: menuId },
      data: req.body
    });

    res.status(200).json({
      message: 'Menu item updated successfully!',
      menu: updatedMenu
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating menu' });
  }
});

// Protected route: Delete menu
router.delete('/delete-menu-item/:id', async (req, res) => {
  try {
    const menuId = parseInt(req.params.id);
    
    const menuItem = await prisma.menu.findUnique({
      where: { id: menuId },
      include: { children: true }
    });

    if (!menuItem) {
      return res.status(404).send({ message: 'Error: Menu item not found!' });
    }

    // Update children if any exist
    if (menuItem.children.length > 0) {
      await prisma.menu.updateMany({
        where: { parentId: menuId },
        data: { parentId: menuItem.parentId }
      });
    }

    // Delete the menu item
    await prisma.menu.delete({
      where: { id: menuId }
    });

    res.status(200).send({
      message: 'Menu item deleted successfully, and children updated accordingly!'
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error deleting menu item' });
  }
});

module.exports = router;
