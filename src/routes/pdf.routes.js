const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const Pdf = require('../models/pdf.model');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const stream = require('stream');
const authMiddleware = require('../middleware/auth');
const verifyTokenMiddleware = require('../middleware/tokenVerification');

// Rate limiting
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// Protected routes
// Add auth middleware
router.use(verifyTokenMiddleware);
router.use(authMiddleware);

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Upload PDF endpoint
router.post(
  '/upload',
  uploadLimiter,
  upload.single('pdfFile'),
  async (req, res) => {
    let bucket;
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No PDF file uploaded',
        });
      }

      const metadata = JSON.parse(req.body.metadata);

      // Create GridFS bucket
      bucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: 'pdfs',
      });

      // Create upload stream
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: 'application/pdf',
        metadata: {
          uploadedBy: req.user.userId.toString(),
          originalName: req.file.originalname,
        },
      });

      // Create readable stream from buffer
      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);

      // Pipe buffer to GridFS
      await new Promise((resolve, reject) => {
        bufferStream
          .pipe(uploadStream)
          .on('error', reject)
          .on('finish', resolve);
      });

      // Save reference to database
      const newPdf = await Pdf.create({
        fileId: uploadStream.id,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: 'application/pdf',
        usageTypes: metadata.usageTypes,
        metadata: {
          uploadedBy: req.user.userId,
          lastModifiedBy: req.user.userId,
        },
      });

      res.status(201).json({
        success: true,
        pdf: {
          _id: newPdf._id,
          fileId: newPdf.fileId,
          fileName: newPdf.fileName,
          fileSize: newPdf.fileSize,
          usageTypes: newPdf.usageTypes,
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Upload failed',
        error: error.message,
      });
    }
  }
);

// Download PDF endpoint
router.get('/download/:id', async (req, res) => {
  let bucket;
  try {
    const pdf = await Pdf.findById(req.params.id);
    if (!pdf || pdf.status === 'deleted') {
      return res.status(404).json({
        success: false,
        message: 'PDF not found',
      });
    }

    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'pdfs',
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.fileName}"`
    );

    // Stream the file from GridFS to response
    bucket.openDownloadStream(pdf.fileId).pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed',
      error: error.message,
    });
  }
});

// Delete PDF endpoint
router.delete('/delete/:id', async (req, res) => {
  let bucket;
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PDF ID',
      });
    }

    const pdf = await Pdf.findById(id);
    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found',
      });
    }

    // Delete from GridFS
    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'pdfs',
    });
    await bucket.delete(pdf.fileId);

    // Delete from MongoDB
    await Pdf.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'PDF deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get all active PDFs
router.get('/all', async (req, res) => {
  try {
    const pdfs = await Pdf.find(
      { status: 'active' },
      { __v: 0 } // Exclude version key
    )
      .populate([
        {
          path: 'usageTypes.postId',
          select: 'title -_id',
        },
        {
          path: 'usageTypes.categoryId',
          select: 'name -_id',
        },
        {
          path: 'metadata.uploadedBy',
          select: 'username role -_id',
        },
      ])
      .sort({ 'metadata.createdAt': -1 })
      .lean()
      .limit(100);

    res.status(200).json({ success: true, pdfs });
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch PDFs' });
  }
});

module.exports = router;
