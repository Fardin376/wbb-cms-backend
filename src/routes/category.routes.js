const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const xss = require('xss');
const authMiddleware = require('../middleware/auth');

// Add auth middleware
router.use(authMiddleware);

// Add validation middleware
const validateCategory = async (req, res, next) => {
  const { nameEn, nameBn, type } = req.body;

  if (!nameEn || !nameBn || !type) {
    return res.status(400).json({
      success: false,
      message: 'Category name (English & Bangla) and type are required',
    });
  }

  // Check for existing category
  const existingCategory = await prisma.category.findFirst({
    where: {
      OR: [
        { nameEn },
        { nameBn }
      ],
    },
  });

  if (existingCategory) {
    return res.status(400).json({
      success: false,
      message: 'Category already exists with this name',
    });
  }

  next();
};

// Create a new category
router.post(
  '/create-categories',
  validateCategory,
  async (req, res) => {
    try {
      const { nameEn, nameBn, type } = req.body;
      const userId = req.user.id; // Assuming user ID is set by auth middleware

      const sanitizedData = {
        nameEn: xss(nameEn.trim()),
        nameBn: xss(nameBn.trim()),
        type: type,
        userId,
      };

      const category = await prisma.category.create({
        data: sanitizedData,
        include: {
          createdBy: {
            select: {
              id: true,
              username: true,
              role: true,
            },
          },
        },
      });

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
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
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
      categories,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error fetching categories',
    });
  }
});

// Get a specific category by ID
router.get('/categories/:id', async (req, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: {
        id: parseInt(req.params.id),
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
router.put(
  '/categories/:id',
  async (req, res) => {
    try {
      const { nameEn, nameBn, type, isActive } = req.body;
      const userId = req.user.id;

      const updatedCategory = await prisma.category.update({
        where: {
          id: parseInt(req.params.id),
        },
        data: {
          nameEn: nameEn ? xss(nameEn.trim()) : undefined,
          nameBn: nameBn ? xss(nameBn.trim()) : undefined,
          type: type || undefined,
          isActive: isActive === undefined ? undefined : isActive,
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

      res.status(200).json(updatedCategory);
    } catch (error) {
      console.error(error);
      if (error.code === 'P2002') {
        return res
          .status(400)
          .json({ message: 'Category name already exists' });
      }
      res.status(500).json({ message: 'Error updating category' });
    }
  }
);

// Delete a category (soft delete)
router.delete(
  '/categories/:id',
  async (req, res) => {
    try {
      const category = await prisma.category.update({
        where: {
          id: parseInt(req.params.id),
        },
        data: {
          isActive: false,
        },
      });

      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Error deleting category' });
    }
  }
);

module.exports = router;
