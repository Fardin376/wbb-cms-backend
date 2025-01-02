const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

router.use(authMiddleware);

const validateBannerUpload = (req, res, next) => {
  const { url, fileName } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      message: 'Missing required field: url',
    });
  }

  if (!fileName) {
    req.body.fileName = 'External File'; // Assign a default file name if missing
  }

  next();
};

router.post('/upload', validateBannerUpload, async (req, res) => {
  try {
    const {
      url,
      fileName,
      titleEn,
      titleBn,
      descriptionEn,
      descriptionBn,
      status,
    } = req.body;

    const banner = await prisma.banner.create({
      data: {
        url,
        fileName,
        titleEn,
        titleBn,
        descriptionEn,
        descriptionBn,
        status,
        userId: req.user.userId, // Ensure req.user is populated correctly
      },
      include: {
        uploadedBy: {
          select: {
            username: true,
            role: true,
          },
        },
      },
    });

    res.status(201).json({ success: true, banner });
  } catch (error) {
    console.error('Error uploading banner:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Banner upload failed',
    });
  }
});

router.get('/all-banners', async (req, res) => {
  try {
    const banners = await prisma.banner.findMany({
      include: {
        uploadedBy: {
          select: {
            username: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

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

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.banner.delete({
      where: {
        id: parseInt(id),
      },
    });

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

router.patch('/toggle-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['PUBLISHED', 'UNPUBLISHED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value',
      });
    }

    const banner = await prisma.banner.update({
      where: {
        id: parseInt(id),
      },
      data: {
        status,
      },
      include: {
        uploadedBy: {
          select: {
            username: true,
            role: true,
          },
        },
      },
    });

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
