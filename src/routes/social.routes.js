const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Duplicate URL check middleware for SocialLink
const checkDuplicateUrl = async (req, res, next) => {
  try {
    const { url } = req.body;
    const existingSocialLink = await prisma.socialLink.findFirst({
      where: { url },
    });

    if (
      existingSocialLink &&
      existingSocialLink.id !== parseInt(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Social link with this URL already exists',
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking for duplicate social link URL',
    });
  }
};

// Create a new SocialLink
router.post('/create-social-links', checkDuplicateUrl, async (req, res) => {
  try {
    const { nameEn, nameBn, url, status } = req.body;

    const socialLink = await prisma.socialLink.create({
      data: {
        nameEn,
        nameBn,
        url,
        status: status || 'UNPUBLISHED',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Social link created successfully',
      data: socialLink,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating social link',
      error: error.message,
    });
  }
});

// Fetch all SocialLinks
router.get('/all-social-links', async (req, res) => {
  try {
    const socialLinks = await prisma.socialLink.findMany({
      orderBy: { createdAt: 'asc' },
    });

    res.status(200).json({
      success: true,
      message: 'Social links fetched successfully',
      data: socialLinks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching social links',
      error: error.message,
    });
  }
});

// Fetch a single SocialLink by ID
router.get('/:id', async (req, res) => {
  try {
    const socialLink = await prisma.socialLink.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!socialLink) {
      return res.status(404).json({ message: 'Social link not found' });
    }

    res.status(200).json(socialLink);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching social link',
      error: error.message,
    });
  }
});

// Update a SocialLink by ID
router.patch('/:id', checkDuplicateUrl, async (req, res) => {
  try {
    const { nameEn, nameBn, url, status } = req.body;

    const updatedSocialLink = await prisma.socialLink.update({
      where: { id: parseInt(req.params.id) },
      data: {
        nameEn,
        nameBn,
        url,
        status,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Social link updated successfully',
      data: updatedSocialLink,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Social link not found',
      });
    }
    res.status(400).json({
      success: false,
      message: 'Error updating social link',
      error: error.message,
    });
  }
});

// Delete a SocialLink by ID
router.delete('/:id', async (req, res) => {
  try {
    await prisma.socialLink.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.status(200).json({
      success: true,
      message: 'Social link deleted successfully',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Social link not found',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting social link',
      error: error.message,
    });
  }
});

module.exports = router;
