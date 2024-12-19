const express = require('express');
const router = express.Router();
const FooterLink = require('../models/footerLinks.model');

// Duplicate URL check middleware
const checkDuplicateUrl = async (req, res, next) => {
  try {
    const { url } = req.body;
    const existingFooterLink = await FooterLink.findOne({ url });

    // If updating, exclude the current footer link from the duplicate check
    if (req.params.id) {
      if (
        existingFooterLink &&
        existingFooterLink._id.toString() !== req.params.id
      ) {
        return res.status(400).json({
          success: false,
          message: 'Footer link with this URL already exists',
        });
      }
    } else if (existingFooterLink) {
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
    const { position, name, url, serial, status } = req.body;
    const newFooterLink = new FooterLink({
      position,
      name,
      url,
      serial,
      status,
    });
    const savedFooterLink = await newFooterLink.save();
    res.status(201).json({
      success: true,
      message: 'Footer link created successfully',
      data: savedFooterLink,
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
    const footerLinks = await FooterLink.find().sort({ serial: 1 }); // Sort by serial for ordering
    res.status(201).json({
      success: true,
      message: 'Footer link fetched successfully',
      footers: footerLinks,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching footer links', error });
  }
});

router.get('/footer-links/:id', async (req, res) => {
  try {
    const footerLink = await FooterLink.findById(req.params.id);
    if (!footerLink) {
      return res.status(404).json({ message: 'Footer link not found' });
    }
    res.status(200).json(footerLink);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching footer link', error });
  }
});

router.patch('/footer-links/:id', checkDuplicateUrl, async (req, res) => {
  try {
    const { position, name, url, serial, status } = req.body;
    const updatedFooterLink = await FooterLink.findByIdAndUpdate(
      req.params.id,
      { position, name, url, serial, status },
      { new: true, runValidators: true }
    );
    if (!updatedFooterLink) {
      return res.status(404).json({
        success: false,
        message: 'Footer link not found',
      });
    }
    res.status(200).json({
      success: true,
      message: 'Footer link updated successfully',
      data: updatedFooterLink,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Error updating footer link',
      error: error.message,
    });
  }
});

router.delete('/footer-links/:id', async (req, res) => {
  try {
    const deletedFooterLink = await FooterLink.findByIdAndDelete(req.params.id);
    if (!deletedFooterLink) {
      return res.status(404).json({ message: 'Footer link not found' });
    }
    res.status(200).json({ message: 'Footer link deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting footer link', error });
  }
});

module.exports = router;
