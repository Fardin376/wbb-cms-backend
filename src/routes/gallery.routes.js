const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const validateImageUpload = (req, res, next) => {
  const { url, fileName } = req.body;

  console.log('Received upload request:', req.body);

  if (!url || !fileName) {
    console.log('Missing required fields:', { url, fileName });
    return res.status(400).json({
      success: false,
      message: 'Missing required fields',
      details: { url, fileName },
    });
  }

  next();
};

router.post('/upload', validateImageUpload, async (req, res) => {
  try {
    const {
      url,
      fileName,
      fileType = 'image',
      isPost = false,
      isCover = false,
      status = 'ACTIVE',
    } = req.body;

    const userId = req.user.userId;

    const gallery = await prisma.gallery.create({
      data: {
        url,
        fileName,
        fileType,
        isPost,
        isCover,
        status,
        uploadedBy: { connect: { id: userId } },
      },
      include: {
        uploadedBy: {
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
      gallery,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: 'Related post not found',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload image',
    });
  }
});

router.get('/images', async (req, res) => {
  try {
    const images = await prisma.gallery.findMany({
      where: {
        isPost: false, // Filter images with isPost set to false
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Order images by createdAt in descending order
      },
    });

    res.status(200).json({
      success: true,
      count: images.length,
      images,
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch images',
    });
  }
});

// Change endpoint path to match the frontend request
router.get('/by-url', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL parameter is required',
      });
    }

    // Function to normalize URLs for comparison
    const normalizeUrl = (url) => {
      try {
        // Decode URL and remove any leading/trailing spaces
        let normalized = decodeURIComponent(url).trim();
        // Remove any double spaces
        normalized = normalized.replace(/\s+/g, ' ');
        return normalized;
      } catch (e) {
        return url;
      }
    };

    const searchUrl = normalizeUrl(url);
    console.log('Normalized search URL:', searchUrl);

    const images = await prisma.gallery.findMany();

    // Find matching image by comparing normalized URLs
    const image = images.find((img) => normalizeUrl(img.url) === searchUrl);

    if (!image) {
      console.log('No image found for normalized URL:', searchUrl);
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    console.log('Found image:', image);
    res.json({
      success: true,
      image,
    });
  } catch (error) {
    console.error('Error finding image by URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find image',
      details: error.message,
    });
  }
});

// Add new endpoint for deleting by URL
router.delete('/by-url', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL parameter is required',
      });
    }

    // Try to find the image
    const image = await prisma.gallery.findFirst({
      where: {
        url: {
          equals: decodeURIComponent(url),
          mode: 'insensitive', // Case insensitive comparison
        },
      },
    });

    if (!image) {
      // If image not found in DB, still return success
      // as the frontend already removed it from content
      return res.status(200).json({
        success: true,
        message: 'Image record not found or already deleted',
      });
    }

    // Delete the image
    await prisma.gallery.delete({
      where: { id: image.id },
    });

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting image by URL:', error);
    // Still return success to frontend as the image is already removed from content
    res.status(200).json({
      success: true,
      message: 'Image removed from content',
    });
  }
});

router.delete('/image/:id', async (req, res) => {
  try {
    // First check if image exists
    const image = await prisma.gallery.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    // Allow deletion if:
    // 1. Image is not attached to a post (postId is null) OR
    // 2. Request header indicates deletion is from rich text editor
    const isFromEditor = req.headers['x-delete-from-editor'] === 'true';

    if (image.postId && !isFromEditor) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete media attached to a post',
      });
    }

    // If checks pass, delete the image
    await prisma.gallery.delete({
      where: {
        id: parseInt(req.params.id),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Media deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete media',
    });
  }
});

router.patch('/image/:id/set-cover', async (req, res) => {
  try {
    const { postId } = req.body;
    const imageId = parseInt(req.params.id);

    // First, remove cover flag from any existing cover image for this post
    await prisma.gallery.updateMany({
      where: {
        post: { id: parseInt(postId) },
        isCover: true,
      },
      data: {
        isCover: false,
      },
    });

    // Set the new cover image
    const updatedImage = await prisma.gallery.update({
      where: { id: imageId },
      data: {
        isCover: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Cover image updated successfully',
      image: updatedImage,
    });
  } catch (error) {
    console.error('Error updating cover image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cover image',
    });
  }
});

router.patch('/update-post/:postId', async (req, res) => {
  try {
    const { url } = req.body;
    const postId = parseInt(req.params.postId);

    // First find the image by URL
    const image = await prisma.gallery.findFirst({
      where: { url },
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        message: 'Image not found',
      });
    }

    // Then update it with the new post information
    const updatedImage = await prisma.gallery.update({
      where: { id: image.id },
      data: {
        isPost: true,
        post: {
          connect: { id: postId },
        },
      },
      include: {
        post: true,
      },
    });

    res.json({
      success: true,
      message: 'Image updated successfully',
      image: updatedImage,
    });
  } catch (error) {
    console.error('Error updating image post:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update image',
      details: error.message,
    });
  }
});

module.exports = router;
