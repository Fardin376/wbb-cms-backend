const express = require('express');
const Menu = require('../models/menu.model');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const sanitize = require('mongo-sanitize');
const authMiddleware = require('../middleware/auth'); // Ensures user is authenticated
const authorize = require('../middleware/authorize'); // Role-based access control
const verifyTokenMiddleware = require('../middleware/tokenVerification'); // Token validation

const router = express.Router();

// Public route: Fetch all active menu items
router.get('/public/get-menu-items', async (req, res) => {
  try {
    const menuItems = await Menu.find({ isActive: true }).sort({ order: 1 });
    res.status(200).json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve menu items.' });
  }
});

// Middleware to authenticate and verify token
router.use(verifyTokenMiddleware); // Validate JWT token
router.use(authMiddleware); // Add user to req.user

// Role-based middleware: Allow only admin and superadmin to access protected routes
const adminAccess = authorize('admin', 'superadmin');

// Rate limiting for menu creation
const createMenuLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Validation middleware for menu input
const validateMenuInput = [
  body('title.en').trim().isLength({ min: 1, max: 200 }),
  body('title.bn').trim().isLength({ min: 1, max: 200 }),
  body('url').optional().isURL(),
  body('order').optional().isInt({ min: 0, max: 999999 }),
  body('parentId').optional().isMongoId(),
];

// Duplicate title check middleware
const checkDuplicateTitle = async (req, res, next) => {
  try {
    const { title } = req.body;
    const existingMenuEn = await Menu.findOne({ 'title.en': title.en });
    const existingMenuBn = await Menu.findOne({ 'title.bn': title.bn });

    // If updating, exclude current menu item from duplicate check
    if (req.params.id) {
      if (
        (existingMenuEn && existingMenuEn._id.toString() !== req.params.id) ||
        (existingMenuBn && existingMenuBn._id.toString() !== req.params.id)
      ) {
        return res.status(400).json({
          success: false,
          message: 'Menu item with this title already exists',
        });
      }
    } else if (existingMenuEn || existingMenuBn) {
      return res.status(400).json({
        success: false,
        message: 'Menu item with this title already exists',
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking for duplicate menu items',
    });
  }
};

// Protected route: Create a new menu
router.post(
  '/create-menu',
  createMenuLimiter,
  validateMenuInput,
  adminAccess, // Only admin and superadmin can access
  checkDuplicateTitle,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Sanitize input
      const sanitizedInput = sanitize(req.body);

      const newMenu = new Menu(sanitizedInput);
      await newMenu.save();

      res.status(201).json({
        success: true,
        message: 'Menu item created successfully!',
        menu: newMenu,
      });
    } catch (error) {
      console.error('Error creating menu:', error);
      res.status(500).json({ success: false, message: 'Error creating menu' });
    }
  }
);

// Protected route: Get all active menu items
router.get('/get-all-menu-items', adminAccess, async (req, res) => {
  try {
    const menuItems = await Menu.find({ isActive: true }).sort({ order: 1 });
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

    const menuItems = await Menu.find({ isActive }).sort({ order: 1 });
    res.status(200).json({ success: true, data: menuItems });
  } catch (error) {
    console.error('Error fetching active menu items:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to retrieve menu items.' });
  }
});

// Protected route: Update menu
router.patch(
  '/update-menu/:id',
  validateMenuInput,
  adminAccess, // Only admin and superadmin
  checkDuplicateTitle,
  async (req, res) => {
    try {
      const menuId = req.params.id;
      const updatedMenu = await Menu.findByIdAndUpdate(
        menuId,
        { ...req.body },
        { new: true }
      );

      if (!updatedMenu) {
        return res.status(500).send({ message: 'Menu item not updated!' });
      }

      res.status(200).json({
        message: 'Menu item updated successfully!',
        menu: updatedMenu,
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Error updating menu' });
    }
  }
);

// Protected route: Delete menu
router.delete('/delete-menu-item/:id', adminAccess, async (req, res) => {
  try {
    const menuItemId = req.params.id;

    // Delete menu item logic
    const menuItem = await Menu.findById(menuItemId);
    if (!menuItem) {
      return res.status(404).send({ message: 'Error: Menu item not found!' });
    }

    const parentMenuId = menuItem.parentId; // Get the grandparent's ID if it exists
    const parentSlug = menuItem.slug; // Store the deleted menu item’s slug

    // Delete the menu item
    await menuItem.deleteOne();

    // Find all child items of the deleted menu item
    const childItems = await Menu.find({ parentId: menuItemId });

    if (childItems.length === 0) {
      return res.status(200).send({
        message: 'Menu item deleted successfully and no children to update!',
      });
    }

    // Update each child item
    const childUpdates = childItems.map(async (child) => {
      // If there is no grandparent (i.e., root menu item is being deleted), make child a root item
      if (!parentMenuId) {
        child.parentId = null; // Make it a new root item
      } else {
        // Reattach child to the grandparent if a grandparent exists
        child.parentId = parentMenuId;

        // Update the slug if it starts with the deleted menu item's slug
        if (child.slug.startsWith(parentSlug)) {
          const grandparentSlug =
            (await Menu.findById(parentMenuId)).slug || '';
          child.slug = child.slug.replace(parentSlug, grandparentSlug);
        }
      }
      return child.save(); // Save each updated child item
    });

    // Wait for all child updates to complete
    await Promise.all(childUpdates);

    res.status(200).send({
      message:
        'Menu item deleted successfully, and children updated accordingly!',
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res
      .status(500)
      .json({ success: false, message: 'Error deleting menu item' });
  }
});

module.exports = router;
