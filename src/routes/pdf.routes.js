const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const stream = require('stream');
const authMiddleware = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Initialize Prisma
const prisma = new PrismaClient();

// Rate limiting configuration
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// Protected routes
router.use(authMiddleware);

// Multer configuration
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
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No PDF file uploaded',
        });
      }

      const metadata = JSON.parse(req.body.metadata || '{}');
      const { postId, categoryId, isPublication, isResearch } = metadata;

      console.log('Post ID:', postId); // Debugging
      console.log('Category ID:', categoryId); // Debugging

      const fileData = req.file.buffer.toString('base64');

      // Generate a unique fileId
      const fileId = uuidv4();

      // Save metadata in PostgreSQL
      const newPdf = await prisma.pdf.create({
        data: {
          fileName: req.file.originalname,
          fileId: fileId,
          fileSize: req.file.size,
          fileData: fileData,
          mimeType: req.file.mimetype,
          status: 'ACTIVE',
          isPublication: Boolean(isPublication),
          isResearch: Boolean(isResearch),
          ...(postId && { post: { connect: { id: parseInt(postId) } } }),
          ...(categoryId && {
            category: { connect: { id: parseInt(categoryId) } },
          }),
        },
      });

      res.status(201).json({
        success: true,
        pdf: newPdf,
      });
    } catch (error) {
      console.error('Upload error:', error);

      if (error.code === 'P2002') {
        return res.status(400).json({
          success: false,
          message: 'File with the same ID already exists',
        });
      }

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
  try {
    const pdf = await prisma.pdf.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!pdf || pdf.status === 'INACTIVE') {
      return res.status(404).json({
        success: false,
        message: 'PDF not found',
      });
    }

    if (!pdf.fileData) {
      return res.status(404).json({
        success: false,
        message: 'File content not found',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${pdf.fileName}"`
    );

    const downloadStream = new stream.PassThrough();
    downloadStream.end(Buffer.from(pdf.fileData, 'base64'));
    downloadStream.pipe(res);
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
  try {
    const id = parseInt(req.params.id);
    const pdf = await prisma.pdf.findUnique({
      where: { id },
    });

    if (!pdf) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found',
      });
    }

    // Delete from PostgreSQL
    await prisma.pdf.delete({
      where: { id },
    });

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
    const pdfs = await prisma.pdf.findMany({
      where: { status: 'ACTIVE' },
      include: {
        post: {
          select: {
            titleEn: true,
            titleBn: true,
          },
        },
        category: {
          select: {
            nameEn: true,
            nameBn: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    });

    res.status(200).json({ success: true, pdfs });
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch PDFs' });
  }
});

module.exports = router;
