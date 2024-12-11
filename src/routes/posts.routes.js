const express = require('express');
const Post = require('../models/posts.model'); // Adjust the path to your Post model
const Page = require('../models/page.model');
const router = express.Router();
// const auth = require('../middleware/auth');
const isAdmin = require('../middleware/isAdmin');
const mongoose = require('mongoose');
const Gallery = require('../models/gallery.model');
const rateLimit = require('express-rate-limit');
const Pdf = require('../models/pdf.model');

// Apply auth middleware first, then role-based middleware
// router.use(auth);
router.use(isAdmin);

// Add rate limiting middleware
const createPostLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

// Create a new post
router.post('/create', createPostLimiter, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { title, content, pages, category, createdBy } = req.body;

    // Validate required fields
    if (
      !title?.en ||
      !title?.bn ||
      !content?.en ||
      !content?.bn ||
      !pages?.length ||
      !category ||
      !createdBy
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        details: {
          title:
            !title?.en || !title?.bn
              ? 'Title is required in both languages'
              : null,
          content:
            !content?.en || !content?.bn
              ? 'Content is required in both languages'
              : null,
          pages: !pages?.length ? 'At least one page is required' : null,
          category: !category ? 'Category is required' : null,
          createdBy: !createdBy ? 'Creator ID is required' : null,
        },
      });
    }

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(category) ||
      !mongoose.Types.ObjectId.isValid(createdBy)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID format for category or creator',
      });
    }

    // Convert pages to array if it's not already
    const pagesArray = Array.isArray(pages) ? pages : [pages];

    const postData = {
      title,
      content,
      pages: pagesArray,
      category,
      createdBy,
      isActive: true,
      slug: `${title.en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    };

    // Create the post
    const newPost = await Post.create([postData], { session });

    // Update pages with new post reference
    await Page.updateMany(
      { _id: { $in: pages } },
      { $push: { posts: newPost[0]._id } },
      { session }
    );

    await session.commitTransaction();
    res.status(201).json({
      success: true,
      post: newPost[0],
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating post:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating post',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error : null,
    });
  } finally {
    session.endSession();
  }
});

// Get all posts
router.get('/all-posts', async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    let query = {};

    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    const posts = await Post.find(query)
      .populate('pages', 'name')
      .populate('category', 'name')
      .populate('createdBy', 'role')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Post.countDocuments(query);

    res.status(200).json({
      success: true,
      posts,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ success: false, message: 'Error fetching posts' });
  }
});

// Get a single post by ID
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('pages')
      .populate('category');
    if (!post)
      return res
        .status(404)
        .json({ success: false, message: 'Post not found' });

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

    // Fetch posts that match the category ID
    const posts = await Post.find({ category: categoryId })
      .populate('layout')
      .populate('pages')
      .populate('category')
      .populate('createdBy', 'role');

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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { title, content, pages, category, createdBy } = req.body;

    // Validate required fields
    if (
      !title?.en ||
      !title?.bn ||
      !content?.en ||
      !content?.bn ||
      !pages?.length ||
      !category
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    // Find existing post
    const existingPost = await Post.findById(id);
    if (!existingPost) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Remove post reference from old pages
    await Page.updateMany(
      { _id: { $in: existingPost.pages } },
      { $pull: { posts: existingPost._id } },
      { session }
    );

    // Add post reference to new pages
    await Page.updateMany(
      { _id: { $in: pages } },
      { $push: { posts: existingPost._id } },
      { session }
    );

    // Update the post
    const updatedPost = await Post.findByIdAndUpdate(
      id,
      {
        title,
        content,
        pages,
        category,
        updatedAt: Date.now(),
      },
      { new: true, session }
    );

    await session.commitTransaction();
    res.json({
      success: true,
      post: updatedPost,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating post:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating post',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
});

// Delete a post by ID
router.delete('/delete/:id', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID format',
      });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Remove post reference from pages
    await Page.updateMany(
      { _id: { $in: post.pages } },
      { $pull: { posts: post._id } },
      { session }
    );

    // Delete associated gallery items
    await Gallery.deleteMany(
      {
        'usageTypes.isPost': true,
        'usageTypes.postId': post._id,
      },
      { session }
    );

    // Find and delete associated PDFs
    const pdfs = await Pdf.find({
      'usageTypes.postId': post._id,
    });

    // Delete PDF files from GridFS and their references
    if (pdfs.length > 0) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'pdfs',
      });

      // Delete each PDF file from GridFS and its reference in MongoDB
      await Promise.all(
        pdfs.map(async (pdf) => {
          try {
            // Delete from GridFS
            await bucket.delete(pdf.fileId);
            // Delete PDF reference from MongoDB
            await Pdf.findByIdAndDelete(pdf._id, { session });
          } catch (error) {
            console.error(`Error deleting PDF ${pdf._id}:`, error);
            // Continue with other deletions even if one fails
          }
        })
      );
    }

    // Delete the post
    await Post.findByIdAndDelete(post._id, { session });

    await session.commitTransaction();
    res.status(200).json({
      success: true,
      message: 'Post and associated data (including PDFs) deleted successfully',
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error deleting post:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting post',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    session.endSession();
  }
});

// Update status toggle endpoint
router.patch('/toggle-status/:id', async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Update post status
    const post = await Post.findByIdAndUpdate(id, { isActive }, { new: true });

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    // Update associated gallery images status
    await Gallery.updateMany(
      {
        'usageTypes.isPost': true,
        'usageTypes.postId': post._id,
      },
      {
        status: isActive ? 'active' : 'inactive',
      },
      { session }
    );

    await session.commitTransaction();
    res.json({
      success: true,
      message: 'Post and associated images status updated successfully',
      post,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating status',
    });
  } finally {
    session.endSession();
  }
});

// Get posts by page
router.get('/by-page/:pageId', async (req, res) => {
  try {
    const { pageId } = req.params;
    const { category } = req.query;

    if (!mongoose.Types.ObjectId.isValid(pageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page ID format',
      });
    }

    let query = {
      pages: pageId,
      isActive: true,
    };

    // Add category filter if provided
    if (category && mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    }

    const posts = await Post.find(query)
      .populate('category')
      .populate('createdBy', 'username role')
      .sort({ createdAt: -1 });

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
router.patch('/toggle-featured/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { isFeatured } = req.body;

    const post = await Post.findByIdAndUpdate(
      id,
      {
        isFeatured,
        updatedAt: Date.now(),
      },
      { new: true }
    );

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

// Update the public featured posts route
router.get('/public/featured', async (req, res) => {
  try {
    const posts = await Post.find({
      isActive: true,
      isFeatured: true,
    })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .lean();

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
