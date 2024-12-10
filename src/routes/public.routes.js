const express = require('express');
const router = express.Router();
const { corsMiddleware } = require('../middleware/cors');
const Page = require('../models/page.model');
const Menu = require('../models/menu.model');
const Post = require('../models/posts.model');
const Gallery = require('../models/gallery.model');
const Pdf = require('../models/pdf.model');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

// Apply CORS specifically for public routes
router.use(corsMiddleware);

// Add rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

router.use(limiter);

// Add cache control middleware
const cacheControl = (duration) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${duration}`);
  next();
};

// Get all public pages
router.get('/pages', async (req, res) => {
  try {
    const pages = await Page.find({
      isActive: true,
      status: 'published',
    })
      .select('name slug template layout')
      .populate('layout')
      .lean();

    // Transform pages before sending
    const transformedPages = pages.map((page) => ({
      ...page,
      template: {
        en: page.template?.en || null,
        bn: page.template?.bn || null,
      },
    }));

    console.log(
      'Sending pages:',
      transformedPages.map((p) => ({
        id: p._id,
        name: p.name,
        slug: p.slug,
        hasTemplate: !!p.template,
      }))
    );

    res.status(200).json({
      success: true,
      pages: transformedPages,
    });
  } catch (error) {
    console.error('Error fetching public pages:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pages',
    });
  }
});

// Get public page by slug
router.get('/pages/:slug(*)', async (req, res) => {
  try {
    const normalizedSlug = req.params.slug
      .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
      .replace(/\/+/g, '/'); // Replace multiple slashes with single slash

    console.log('Looking for page with normalized slug:', normalizedSlug);

    // Find the page with various slug formats
    let page = await Page.findOne({
      $or: [
        { slug: normalizedSlug },
        { slug: `/${normalizedSlug}` },
        { slug: `${normalizedSlug}/` },
        { slug: { $regex: new RegExp(`^/?${normalizedSlug}/?$`) } },
      ],
      isActive: true,
      status: 'published',
    })
      .populate('layout')
      .lean();

    if (!page) {
      console.log('No page found for slug:', normalizedSlug);
      return res.status(404).json({
        success: false,
        message: 'Page not found',
        slug: normalizedSlug,
      });
    }

    // Transform the page data
    const transformedPage = {
      ...page,
      slug: page.slug.replace(/^\/+|\/+$/g, ''),
      template: {
        en: page.template?.en || null,
        bn: page.template?.bn || null,
      },
      hasTemplate: !!page.template,
      layout: page.layout || null,
    };

    res.json({
      success: true,
      page: transformedPage,
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching page',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get public menu items with page validation
router.get('/menu', async (req, res) => {
  try {
    const [menuItems, pages] = await Promise.all([
      Menu.find({
        isActive: true,
        parentId: null,
      })
        .sort({ order: 1 })
        .lean(),
      Page.find({
        isActive: true,
        status: 'published',
      })
        .select('slug')
        .lean(),
    ]);

    // Create a set of valid page slugs for quick lookup
    const validSlugs = new Set(pages.map((page) => page.slug));

    // Function to validate and process menu items recursively
    const processMenuItems = (items) => {
      return items.map((item) => ({
        ...item,
        // Set href to '/' if the slug doesn't match any page
        href: validSlugs.has(item.slug) ? `/pages/${item.slug}` : '/',
        // Add isExternal flag for external links
        isExternal: item.href?.startsWith('http') || false,
      }));
    };

    // Function to get children recursively
    const getChildren = async (parentId) => {
      const children = await Menu.find({
        isActive: true,
        parentId,
      })
        .sort({ order: 1 })
        .lean();

      const processedChildren = processMenuItems(children);

      for (let child of processedChildren) {
        child.children = await getChildren(child._id);
      }

      return processedChildren;
    };

    // Process root menu items
    const processedMenuItems = processMenuItems(menuItems);

    // Get children for each root menu
    for (let menu of processedMenuItems) {
      menu.children = await getChildren(menu._id);
    }

    res.status(200).json({
      success: true,
      menus: processedMenuItems,
    });
  } catch (error) {
    console.error('Error fetching public menu items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching menu items',
    });
  }
});

// Get all posts route
router.get('/posts', cacheControl(300), async (req, res) => {
  try {
    const { featured } = req.query;
    const query = {
      isActive: true,
      ...(featured === 'true' && { isFeatured: true }),
    };

    // 1. Fetch all posts
    const posts = await Post.find(query)
      .populate({
        path: 'category',
        select: '_id name type',
      })
      .populate('pages', 'name slug')
      .select('title slug category content isFeatured createdAt pages')
      .sort({ createdAt: -1 })
      .lean();

    // 2. Get all post IDs
    const postIds = posts.map((post) => post._id);

    // 3. Fetch all images and PDFs in parallel
    const [allImages, allPdfs] = await Promise.all([
      Gallery.find({
        'usageTypes.postId': { $in: postIds },
        status: 'active',
      })
        .select('url fileName usageTypes')
        .lean(),

      // Fetch PDFs with both post and category references
      Pdf.find({
        $or: [
          { 'usageTypes.postId': { $in: postIds } },
          {
            'usageTypes.categoryId': { $in: postIds },
            $or: [
              { 'usageTypes.isResearch': true },
              { 'usageTypes.isPublications': true },
            ],
          },
        ],
        status: 'active',
      })
        .select('_id fileName fileId fileSize mimeType usageTypes')
        .lean(),
    ]);

    console.log('Found PDFs:', allPdfs.length);

    // 4. Organize assets by post ID
    const imagesByPostId = {};
    const pdfsByPostId = {};

    // Organize images
    allImages.forEach((img) => {
      const postId = img.usageTypes.postId.toString();
      if (!imagesByPostId[postId]) {
        imagesByPostId[postId] = [];
      }
      imagesByPostId[postId].push(img);
    });

    // Organize PDFs by both post ID and category ID
    allPdfs.forEach((pdf) => {
      let postId = pdf.usageTypes.postId?.toString();
      const categoryId = pdf.usageTypes.categoryId?.toString();

      if (postId) {
        if (!pdfsByPostId[postId]) {
          pdfsByPostId[postId] = [];
        }
        pdfsByPostId[postId].push(pdf);
      }

      if (categoryId) {
        if (!pdfsByPostId[categoryId]) {
          pdfsByPostId[categoryId] = [];
        }
        pdfsByPostId[categoryId].push(pdf);
      }
    });

    // 5. Transform posts with their assets
    const transformedPosts = posts.map((post) => {
      const postId = post._id.toString();
      const postImages = imagesByPostId[postId] || [];
      const postPdfs = pdfsByPostId[postId] || [];

      const isResearchOrPublication =
        post.category?.type === 'research' ||
        post.category?.type === 'publications';

      return {
        ...post,
        coverImg:
          postImages.find((img) => img.usageTypes.isCover)?.url ||
          postImages[0]?.url ||
          null,
        galleryImages: postImages
          .filter((img) => !img.usageTypes.isCover)
          .map((img) => ({
            imageUrl: img.url,
            caption: img.fileName,
          })),
        pdfs: isResearchOrPublication
          ? postPdfs.map((pdf) => ({
              id: pdf._id,
              fileName: pdf.fileName,
              url: `/api/public/download/pdf/${pdf._id}`,
              title: pdf.fileName,
              fileSize: pdf.fileSize,
              mimeType: pdf.mimeType,
            }))
          : [],
      };
    });

    // Add debug logging
    transformedPosts.forEach((post) => {
      if (
        post.category?.type === 'publications' ||
        post.category?.type === 'research'
      ) {
        console.log(`Post ${post._id} (${post.category.type}):`, {
          title: post.title.en,
          pdfCount: post.pdfs.length,
          pdfs: post.pdfs,
        });
      }
    });

    res.json({
      success: true,
      posts: transformedPosts,
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching posts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update the PDF fetching helper function
const fetchPDFsForPost = async (postId, categoryType) => {
  if (!['research', 'publications'].includes(categoryType)) {
    return [];
  }

  try {
    // First try to find PDFs directly linked to the post
    let pdfs = await Pdf.find({
      'usageTypes.postId': postId,
      status: 'active',
    })
      .select('_id fileName fileId fileSize mimeType usageTypes')
      .lean();

    // If no PDFs found, try to find PDFs by category
    if (!pdfs.length) {
      pdfs = await Pdf.find({
        'usageTypes.categoryId': postId,
        [`usageTypes.is${categoryType}`]: true,
        status: 'active',
      })
        .select('_id fileName fileId fileSize mimeType usageTypes')
        .lean();
    }

    console.log(
      `Found ${pdfs.length} PDFs for post ${postId}, category: ${categoryType}`
    );
    return pdfs;
  } catch (error) {
    console.error('Error fetching PDFs:', error);
    return [];
  }
};

// Update the single post route
router.get('/posts/:slug', cacheControl(300), async (req, res) => {
  try {
    if (!req.params.slug) {
      return res.status(400).json({
        success: false,
        message: 'Slug parameter is required',
      });
    }

    // 1. Find the post
    const post = await Post.findOne({
      slug: req.params.slug,
      isActive: true,
    })
      .populate({
        path: 'category',
        select: '_id name type',
      })
      .populate('pages', 'name slug')
      .select('title slug category content createdAt pages isFeatured')
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found or inactive',
      });
    }

    // 2. Fetch images and PDFs in parallel
    const [images, pdfs] = await Promise.all([
      Gallery.find({
        'usageTypes.postId': post._id,
        status: 'active',
      })
        .select('url fileName usageTypes')
        .lean(),
      fetchPDFsForPost(post._id, post.category?.type),
    ]);

    console.log('Post category type:', post.category?.type);
    console.log('Found PDFs:', pdfs);

    // 3. Transform the post with its assets
    const transformedPost = {
      ...post,
      coverImg:
        images.find((img) => img.usageTypes.isCover)?.url ||
        images[0]?.url ||
        null,
      galleryImages: images
        .filter((img) => !img.usageTypes.isCover)
        .map((img) => ({
          imageUrl: img.url,
          caption: img.fileName,
        })),
      pdfs: pdfs.map((pdf) => ({
        id: pdf._id,
        fileName: pdf.fileName,
        url: `/api/public/download/pdf/${pdf._id}`,
        title: pdf.fileName, // Use fileName as title since title isn't in the schema
        fileSize: pdf.fileSize,
        mimeType: pdf.mimeType,
      })),
    };

    console.log('Transformed PDFs:', transformedPost.pdfs);

    res.json({
      success: true,
      post: transformedPost,
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Update the PDF download route
router.get('/download/pdf/:id', async (req, res) => {
  try {
    const pdf = await Pdf.findById(req.params.id);
    if (!pdf || pdf.status !== 'active') {
      return res.status(404).json({ success: false, message: 'PDF not found' });
    }

    // Get GridFS bucket
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'pdfs',
    });

    // Set proper headers for PDF download
    res.setHeader('Content-Type', pdf.mimeType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(pdf.fileName)}"`
    );

    // Stream the file from GridFS to response
    const downloadStream = bucket.openDownloadStream(pdf.fileId);

    downloadStream.on('error', (error) => {
      console.error('Error streaming PDF:', error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming PDF',
        });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('Error downloading PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to download PDF',
      });
    }
  }
});

// Add this debug route temporarily
router.get('/debug/pdfs/:postId', async (req, res) => {
  try {
    const pdfs = await Pdf.find({
      'usageTypes.postId': req.params.postId,
      status: 'active',
    }).lean();

    res.json({
      success: true,
      count: pdfs.length,
      pdfs: pdfs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
