const express = require('express');
const Category = require('../models/category.model'); // Adjust the path to the Category model as needed
const router = express.Router();
const mongoose = require('mongoose');
const xss = require('xss');
// const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

// Add auth middleware
// router.use(auth);

// Add validation middleware
const validateCategory = async (req, res, next) => {
  const { name, type } = req.body;

  if (!name?.en || !name?.bn) {
    return res.status(400).json({
      success: false,
      message: 'Both English and Bangla names are required',
    });
  }

  // Check for existing category
  const existingCategory = await Category.findOne({
    'name.en': name.en.toLowerCase(),
  });

  if (existingCategory) {
    return res.status(400).json({
      success: false,
      message: 'Category already exists',
    });
  }

  next();
};

// Create a new category
router.post(
  '/create-categories',
  validateCategory,
  authorize('admin' || 'superadmin'),
  async (req, res) => {
    try {
      const { name, type, createdBy } = req.body;

      if (!mongoose.Types.ObjectId.isValid(createdBy)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID',
        });
      }

      const sanitizedName = {
        en: xss(name.en.trim()),
        bn: xss(name.bn.trim()),
      };

      const category = new Category({
        name: sanitizedName,
        type,
        createdBy,
      });

      await category.save();
      res.status(201).json({
        success: true,
        category,
      });
    } catch (error) {
      console.error('Category creation error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Error creating category',
      });
    }
  }
);

// Get all categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Category.find().populate(
      'createdBy',
      'name email'
    );
    res.status(200).json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching categories' 
    });
  }
});

// Get a specific category by ID
router.get('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).populate(
      'createdBy',
      'name email'
    );
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(category);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching category' });
  }
});

// Update an existing category
router.put('/categories/:id', async (req, res) => {
  try {
    const { name, createdBy } = req.body;
    const updatedCategory = await Category.findByIdAndUpdate(
      req.params.id,
      { name, createdBy, updatedAt: Date.now() },
      { new: true } // Return the updated document
    );
    if (!updatedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error updating category' });
  }
});

// Delete a category
router.delete('/categories/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error deleting category' });
  }
});

module.exports = router;
