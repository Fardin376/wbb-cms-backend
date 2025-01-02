const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');

// Add rate limiting middleware
const createPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Add auth middleware
router.use(authMiddleware);

// Create a new post
router.post('/create', createPostLimiter, async (req, res) => {
  try {
    const { titleEn, titleBn, contentEn, contentBn, pageIds, categoryId, status, isFeatured } = req.body;

    if (!titleEn || !titleBn || !contentEn || !contentBn || !pageIds?.length || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const post = await prisma.post.create({
      data: {
        titleEn,
        titleBn,
        contentEn,
        contentBn,
        slug: `${titleEn.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
        status: status || 'DRAFT',
        isFeatured: Boolean(isFeatured),
        userId: req.user.userId,
        categoryId: parseInt(categoryId),
        pages: {
          connect: pageIds.map((id) => ({ id: parseInt(id) })),
        },
      },
      include: {
        category: true,
        pages: true,
      },
    });

    res.status(201).json({ success: true, post });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, message: 'Error creating post' });
  }
});


// Get all posts
router.get('/all-posts', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * parseInt(limit);

    const where = {};
    if (status) where.status = status;

    const [posts, count] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          pages: true,
          category: true,
          createdBy: {
            select: { role: true },
          },
        },
        skip,
        take: parseInt(limit),
      }),
      prisma.post.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      posts,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ success: false, message: 'Error fetching posts' });
  }
});

// Get a single post by ID
router.get('/:id', async (req, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        pages: true,
        category: true,
      },
    });

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });
    }

    res.status(200).json({ success: true, post });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ success: false, message: 'Error fetching post' });
  }
});

// Get posts by category
router.get('/by-category/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;

    const posts = await prisma.post.findMany({
      where: { categoryId: parseInt(categoryId) },
      include: {
        pages: true,
        category: true,
        createdBy: {
          select: { role: true },
        },
      },
    });

    if (!posts.length) {
      return res.status(404).json({
        success: false,
        message: 'No posts found for this category',
      });
    }

    res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error('Error fetching posts by category:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posts by category',
    });
  }
});

// Update a post by ID
router.put('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { titleEn, titleBn, contentEn, contentBn, pageIds, categoryId, status, isFeatured } = req.body;

    if (!titleEn || !titleBn || !contentEn || !contentBn || !pageIds?.length || !categoryId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        details: { titleEn, titleBn, contentEn, contentBn, pageIds, categoryId }
      });
    }

    // // Handle image cleanup if necessary
    // const oldPost = await prisma.post.findUnique({ where: { id: parseInt(id) } });
    // if (oldPost.contentEn !== contentEn || oldPost.contentBn !== contentBn) {
    //   // Extract image URLs from old content and new content
    //   const oldImages = extractImageUrls(oldPost.contentEn).concat(extractImageUrls(oldPost.contentBn));
    //   const newImages = extractImageUrls(contentEn).concat(extractImageUrls(contentBn));

    //   // Find images to delete
    //   const imagesToDelete = oldImages.filter(url => !newImages.includes(url));
    //   await Promise.all(imagesToDelete.map(url => deletePostImage(url)));
    // }

    const post = await prisma.post.update({
      where: { id: parseInt(id) },
      data: {
        titleEn,
        titleBn,
        contentEn,
        contentBn,
        categoryId: parseInt(categoryId),
        status: status || 'DRAFT',
        isFeatured: Boolean(isFeatured),
        pages: {
          set: pageIds.map(id => ({ id: parseInt(id) })),
        },
      },
      include: {
        pages: true,
        category: true,
      },
    });

    res.json({ success: true, post });
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating post',
    });
  }
});

// Delete a post by ID
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const postId = parseInt(id);

    // First get all images associated with this post
    const associatedImages = await prisma.gallery.findMany({
      where: {
        postId: postId
      }
    });

    // Delete all associated images from the gallery table
    await prisma.gallery.deleteMany({
      where: {
        postId: postId
      }
    });

    // Delete the post
    const post = await prisma.post.delete({
      where: { id: postId },
      include: {
        pages: true,
        category: true,
      },
    });

    // Delete the folder from Firebase
    await deletePostFolder(postId);

    // Return both the post and image URLs for frontend cleanup
    res.status(200).json({
      success: true,
      message: 'Post and associated images deleted successfully',
      post,
      imageUrls: associatedImages.map(img => img.url)
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting post and associated images'
    });
  }
});

// Update status toggle endpoint
router.patch('/update-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const post = await prisma.post.update({
      where: { id: parseInt(id) },
      data: { status },
    });

    res.json({
      success: true,
      message: 'Post status updated successfully',
      post,
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
    });
  }
});

// Get posts by page
router.get('/by-page/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    const { category } = req.query;

    const where = {
      pages: { some: { id: parseInt(pageId) } },
      isActive: true,
    };

    if (category) {
      where.categoryId = parseInt(category);
    }

    const posts = await prisma.post.findMany({
      where,
      include: {
        category: true,
        createdBy: {
          select: { username: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      posts,
      count: posts.length,
    });
  } catch (error) {
    console.error('Error fetching page posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page posts',
    });
  }
});

// Toggle featured status
router.patch('/toggle-featured/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isFeatured } = req.body;

    const post = await prisma.post.update({
      where: { id: parseInt(id) },
      data: {
        isFeatured,
        updatedAt: new Date(),
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    res.json({
      success: true,
      message: 'Featured status updated successfully',
      post,
    });
  } catch (error) {
    console.error('Error updating featured status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating featured status',
    });
  }
});

router.patch('/:id/set-cover-image', async (req, res) => {
  const { id } = req.params;
  const { coverImage } = req.body;

  try {
    const updatedPost = await prisma.post.update({
      where: { id: parseInt(id, 10) },
      data: { coverImage },
    });

    res.json({ success: true, post: updatedPost });
  } catch (error) {
    console.error('Error updating cover image:', error);
    res
      .status(500)
      .json({ success: false, message: 'Failed to update cover image' });
  }
});



// Update the public featured posts route
router.get('/public/featured', async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: {
        isActive: true,
        isFeatured: true,
      },
      include: {
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
    });
  }
});

module.exports = router;
