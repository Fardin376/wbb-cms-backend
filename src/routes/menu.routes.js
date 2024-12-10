const express = require('express');
const Menu = require('../models/menu.model');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const sanitize = require('mongo-sanitize');
const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const verifyToken = require('../middleware/tokenVerification');

const router = express.Router();

router.get('/public/get-menu-items', async (req, res) => {
  try {
    const menuItems = await Menu.find({ isActive: true }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: menuItems,
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve menu items.',
    });
  }
});

router.use(auth);
router.use(isAdmin);
router.use(verifyToken);

// Rate limiting
const createMenuLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Validation middleware
const validateMenuInput = [
  body('title.en').trim().isLength({ min: 1, max: 200 }),
  body('title.bn').trim().isLength({ min: 1, max: 200 }),
  body('url').optional().isURL(),
  body('order').optional().isInt({ min: 0, max: 999999 }),
  body('parentId').optional().isMongoId(),
];

// Add this validation middleware
const checkDuplicateTitle = async (req, res, next) => {
  try {
    const { title } = req.body;
    const existingMenuEn = await Menu.findOne({ 'title.en': title.en });
    const existingMenuBn = await Menu.findOne({ 'title.bn': title.bn });

    // If updating, exclude current menu item from check
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

router.post(
  '/create-menu',
  createMenuLimiter,
  validateMenuInput,
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
        message: 'Menu Item created successfully!',
        menu: newMenu,
      });
    } catch (error) {
      console.error('Error creating menu:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating menu',
        error:
          process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  }
);

router.get('/get-all-menu-items', async (req, res) => {
  try {
    const menuItems = await Menu.find({ isActive: true }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: menuItems,
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve menu items.',
    });
  }
});
router.get('/get-all-active-menu-items', isAdmin, async (req, res) => {
  try {
    const isActive = req.query.isActive === 'true'; // Convert to boolean
    const menuItems = await Menu.find({ isActive }).sort({ order: 1 });

    res.status(200).json({
      success: true,
      data: menuItems,
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve menu items.',
    });
  }
});

router.get('/get-sub-menus/:id', async (req, res) => {
  try {
    const subMenus = await Menu.find({ parentId: req.params.id });
    res.json({ success: true, data: subMenus });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: 'Error fetching sub-menus.' });
  }
});

router.patch(
  '/update-menu/:id',
  validateMenuInput,
  checkDuplicateTitle,
  async (req, res) => {
    try {
      const menuId = req.params.id;
      const updatedMenu = await Menu.findByIdAndUpdate(
        menuId,
        { ...req.body },
        {
          new: true,
        }
      );

      await updatedMenu.save();
      if (!updatedMenu) {
        return res.status(500).send({ message: 'Menu Item not updated!' });
      }
      res.status(200).send({
        message: 'Menu Item updated successfully!',
        item: updatedMenu,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Error updating menu' });
    }
  }
);

router.patch('/update-menu-order', isAdmin, async (req, res) => {
  const { order } = req.body;

  try {
    const updatePromises = order.map((menuId, index) => {
      return Menu.findByIdAndUpdate(menuId, { order: index }, { new: true });
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    res.status(200).send({ message: 'Menu order updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating menu' });
  }
});

router.delete('/delete-menu-item/:id', isAdmin, async (req, res) => {
  try {
    const menuItemId = req.params.id;

    // Find the menu item to delete
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
      .send({ message: 'Error deleting menu item and updating children.' });
  }
});

router.get('/get-menu/:id', isAdmin, async (req, res) => {
  try {
    const menuItem = await Menu.findById(req.params.id);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
    }
    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve menu item',
    });
  }
});

router.get('/check-title', isAdmin, async (req, res) => {
  try {
    const { title, lang, excludeId } = req.query;
    const query = { [`title.${lang}`]: title };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existingMenu = await Menu.findOne(query);
    res.status(200).json({ isUnique: !existingMenu });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: 'Error checking title uniqueness' });
  }
});

module.exports = router;
