const express = require('express');
const router = express.Router();
const prisma = require('../services/db.service');
const cors = require('../middleware/cors');
const rateLimit = require('express-rate-limit');
const stream = require('stream');

// Apply CORS specifically for public routes
router.use(cors);

// // Add rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
// });

// router.use(limiter);

// Add cache control middleware
const cacheControl = (duration) => (req, res, next) => {
  res.set('Cache-Control', `public, max-age=${duration}`);
  next();
};

// GET route for fetching menus
router.get('/menu', async (req, res) => {
  try {
    // Fetch menus from the database
    const menus = await prisma.menu.findMany({
      where: { isActive: true }, // Fetch only active menus
    });

    // If no menus found, return an empty array
    if (!menus.length) {
      return res.status(200).json({ success: true, menus: [] });
    }

    // Respond with the menus
    return res.status(200).json({
      success: true,
      menus: menus.map((menu) => ({
        id: menu.id,
        serial: menu.serial,
        titleEn: menu.titleEn,
        titleBn: menu.titleBn,
        slug: menu.slug,
        parentId: menu.parentId,
        isExternalLink: menu.isExternalLink,
        url: menu.url,
        order: menu.order,
        isActive: menu.isActive,
        createdAt: menu.createdAt,
        updatedAt: menu.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching menus:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch menus' });
  }
});

//Get post categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany({});

    // Mapping categories to include type checks for research, articles, and notices
    const CATEGORY_MAPPING = {
      research: ['research', 'publications'],
      articles: ['articles', 'news'],
      notices: ['other'],
    };

    const mappedCategories = categories.map((category) => {
      const type = category.type?.toLowerCase();

      return {
        id: category.id,
        nameEn: category.nameEn,
        nameBn: category.nameBn,
        type: category.type,
        isResearchOrPublication: CATEGORY_MAPPING.research.includes(type),
        isArticleOrNews: CATEGORY_MAPPING.articles.includes(type),
        isNotice: CATEGORY_MAPPING.notices.includes(type),
      };
    });

    res.status(200).json({
      success: true,
      categories: mappedCategories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'An error occurred while fetching categories',
    });
  }
});

// GET route for fetching posts
router.get('/posts/details', async (req, res) => {
  try {
    // Query parameters for filtering
    const { categoryId, type } = req.query;

    const posts = await prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
        ...(categoryId && { categoryId: parseInt(categoryId, 10) }),
      },
      include: {
        pages: true,
        category: true,
        pdfs: true,
        createdBy: {
          select: { role: true },
        },
      },
    });

    if (!posts.length) {
      return res.status(200).json({ success: true, posts: [] });
    }

    // Filter posts by type (e.g., research, news, articles, etc.)
    const CATEGORY_MAPPING = {
      research: ['research', 'publications'],
      articles: ['articles', 'news'],
      notices: ['other'],
    };

    const filteredPosts = posts.filter((post) => {
      const categoryType = post.categoryId?.type?.toLowerCase();
      if (!type) return true; // No filter, return all posts
      return CATEGORY_MAPPING[type]?.includes(categoryType);
    });

    const response = filteredPosts.map((post) => ({
      id: post.id,
      titleEn: post.titleEn,
      titleBn: post.titleBn,
      contentEn: post.contentEn,
      contentBn: post.contentBn,
      coverImage: post.coverImage,
      slug: post.slug,
      status: post.status,
      isFeatured: post.isFeatured,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      userId: post.createdBy,
      categoryId: post.categoryId,
      pdfs: post.pdfs.map((pdf) => ({
        id: pdf.id,
        name: pdf.fileName,
        createdAt: pdf.createdAt,
        updatedAt: pdf.updatedAt,
      })),
      pages: post.pages.map((page) => ({
        id: page.id,
        name: page.name,
        titleEn: page.titleEn,
        titleBn: page.titleBn,
        slug: page.slug,
        templateEn: page.templateEn,
        templateBn: page.templateBn,
        metadata: {
          updatedAt: page.updatedAt,
          lastModifiedBy: page.lastModifiedBy,
        },
        status: page.status,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        createdById: page.createdById,
        layoutId: page.layoutId,
      })),
      category: {
        id: post.category.id,
        nameEn: post.category.nameEn,
        nameBn: post.category.nameBn,
        type: post.category.type,
        userId: post.category.userId,
        isActive: post.category.isActive,
        createdAt: post.category.createdAt,
        updatedAt: post.category.updatedAt,
      },
      createdBy: {
        role: post.createdBy.role,
      },
    }));

    res.status(200).json({ success: true, posts: response });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch posts' });
  }
});

router.get('/posts/:slug', async (req, res) => {
  const slug = req.params.slug;
  // Fetch the post by slug from the database
  const post = await prisma.post.findUnique({
    where: { slug },
    include: { pdfs: true, category: true },
  });
  if (!post) {
    return res.status(404).send('Post not found');
  }
  res.status(200).json({
    success: true,
    post: post,
  });
});

// Get all public pages
router.get('/pages', async (req, res) => {
  try {
    // Fetch pages from the database
    const pages = await prisma.page.findMany({
      where: {
        status: 'PUBLISHED', // Fetch only published pages
      },
    });

    // If no pages found, return an empty array
    if (!pages.length) {
      return res.status(200).json({ success: true, pages: [] });
    }

    // Respond with transformed pages
    return res.status(200).json({
      success: true,
      pages: pages.map((page) => ({
        name: page.name,
        titleEn: page.titleEn,
        titleBn: page.titleBn,
        slug: page.slug,
        layout: page.layoutId,
        template: {
          en: page.templateEn || null,
          bn: page.templateBn || null,
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching pages:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch pages' });
  }
});

// GET route for fetching a public page by slug
router.get('/pages/:slug(*)', async (req, res) => {
  try {
    // Fetch page by slug from the database
    const page = await prisma.page.findUnique({
      where: { slug: req.params.slug },
      include: { layout: true }, // Include layout information
    });

    // If the page is not found, return a 404 error
    if (!page) {
      return res
        .status(404)
        .json({ success: false, message: 'Page not found' });
    }

    // Respond with the page details
    return res.status(200).json({
      success: true,
      page: {
        id: page.id,
        name: page.name,
        titleEn: page.titleEn,
        titleBn: page.titleBn,
        slug: page.slug,
        layout: page.layout,
        template: {
          en: page.templateEn || null,
          bn: page.templateBn || null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching page by slug:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch page' });
  }
});

// GET route for fetching footer links
router.get('/footer-links', async (req, res) => {
  try {
    // Fetch footer links from the database
    const footerLinks = await prisma.footerLink.findMany({
      where: { status: 'PUBLISHED' }, // Fetch only published footer links
    });

    // If no footer links found, return an empty array
    if (!footerLinks.length) {
      return res.status(200).json({ success: true, footerLinks: [] });
    }

    // Respond with the footer links
    return res.status(200).json({
      success: true,
      footerLinks: footerLinks.map((link) => ({
        id: link.id,
        position: link.position,
        nameEn: link.nameEn,
        nameBn: link.nameBn,
        url: link.url,
        serial: link.serial,
        status: link.status,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching footer links:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch footer links' });
  }
});

// GET route for fetching social links
router.get('/social-links', async (req, res) => {
  try {
    // Fetch footer links from the database
    const socialLinks = await prisma.socialLink.findMany({
      where: { status: 'PUBLISHED' }, // Fetch only published footer links
    });

    // If no footer links found, return an empty array
    if (!socialLinks.length) {
      return res.status(200).json({ success: true, socialLinks: [] });
    }

    // Respond with the footer links
    return res.status(200).json({
      success: true,
      socialLinks: socialLinks.map((link) => ({
        id: link.id,
        nameEn: link.nameEn,
        nameBn: link.nameBn,
        url: link.url,
        status: link.status,
        createdAt: link.createdAt,
        updatedAt: link.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching footer links:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch footer links' });
  }
});

// GET route for fetching banners
router.get('/banners', async (req, res) => {
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

//Download PDF
router.get('/download/pdf/:id', async (req, res) => {
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

//GET route for gallery
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

module.exports = router;
