const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Duplicate URL check middleware
const checkDuplicateUrl = async (req, res, next) => {
  try {
    const { url } = req.body;
    const existingFooterLink = await prisma.footerLink.findFirst({
      where: { url },
    });

    if (
      existingFooterLink &&
      existingFooterLink.id !== parseInt(req.params.id)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Footer link with this URL already exists',
      });
    }
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking for duplicate footer link URL',
    });
  }
};

router.post('/create-footer-links', checkDuplicateUrl, async (req, res) => {
  try {
    const { position, nameEn, nameBn, url, serial, status } = req.body;

    const footerLink = await prisma.footerLink.create({
      data: {
        position,
        nameEn,
        nameBn,
        url,
        serial,
        status: status || 'UNPUBLISHED',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Footer link created successfully',
      data: footerLink,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error creating footer link',
      error: error.message,
    });
  }
});

router.get('/all-footer-links', async (req, res) => {
  try {
    const footerLinks = await prisma.footerLink.findMany({
      orderBy: { serial: 'asc' },
    });

    res.status(200).json({
      success: true,
      message: 'Footer links fetched successfully',
      data: footerLinks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching footer links',
      error: error.message,
    });
  }
});

router.get('/footer-links/:id', async (req, res) => {
  try {
    const footerLink = await prisma.footerLink.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!footerLink) {
      return res.status(404).json({ message: 'Footer link not found' });
    }

    res.status(200).json(footerLink);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching footer link',
      error: error.message,
    });
  }
});

router.patch('/footer-links/:id', checkDuplicateUrl, async (req, res) => {
  try {
    const { position, name, url, serial, status } = req.body;

    const updatedFooterLink = await prisma.footerLink.update({
      where: { id: parseInt(req.params.id) },
      data: {
        position,
        name,
        url,
        serial,
        status,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Footer link updated successfully',
      data: updatedFooterLink,
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Footer link not found',
      });
    }
    res.status(400).json({
      success: false,
      message: 'Error updating footer link',
      error: error.message,
    });
  }
});

router.delete('/footer-links/:id', async (req, res) => {
  try {
    await prisma.footerLink.delete({
      where: { id: parseInt(req.params.id) },
    });

    res.status(200).json({
      success: true,
      message: 'Footer link deleted successfully',
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Footer link not found',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Error deleting footer link',
      error: error.message,
    });
  }
});

module.exports = router;
