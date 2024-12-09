const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const corsMiddleware = require('./src/middleware/cors');
const path = require('path');
const ensureUploadDir = require('./src/utils/ensureUploadDir');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Move this before any other middleware
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Add logging middleware for debugging
app.use('/uploads', (req, res, next) => {
  console.log('Static file request:', {
    url: req.url,
    fullPath: path.join(__dirname, 'public/uploads', req.url)
  });
  next();
});

// Then add your other middleware and routes
app.use(corsMiddleware);

// Then rate limiter with more lenient settings for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Higher limit for development
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for development environment and public routes
    return (
      process.env.NODE_ENV === 'development' ||
      req.path.startsWith('/api/public')
    );
  },
});

app.use(limiter);

// Rest of your middleware...
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 50000,
  })
);

// Set timeout
app.use((req, res, next) => {
  res.setTimeout(120000, () => {
    console.log('Request has timed out.');
    res.status(408).send('Request has timed out.');
  });
  next();
});

// CSRF protection middleware
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  },
});

const publicRoutes = require('./src/routes/public.routes');
const userRoutes = require('./src/routes/auth.user.routes');
const menuRoutes = require('./src/routes/menu.routes');
const pageRoutes = require('./src/routes/page.routes');
const layoutRoutes = require('./src/routes/layout.routes');
const categoryRoutes = require('./src/routes/category.routes');
const postRoutes = require('./src/routes/posts.routes');
const galleryRoutes = require('./src/routes/gallery.routes');
const pdfRoutes = require('./src/routes/pdf.routes');

// Public routes (before CSRF and auth middleware)
app.use('/api/public', publicRoutes);

// Then add your CSRF and other middleware
app.use(csrfProtection);

// Protected routes
app.use('/api/auth', userRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/layouts', layoutRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/pdfs', pdfRoutes);

// CSRF Token endpoint (now csrfToken function will be available)
app.get('/api/csrf-token', (req, res) => {
  try {
    const token = req.csrfToken();
    res.json({ csrfToken: token });
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    res.status(500).json({
      error: 'Failed to generate CSRF token',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Error handling middleware
const errorHandler = require('./src/middleware/errorHandler');
app.use(errorHandler);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully');
    
    // Ensure upload directory exists
    await ensureUploadDir();
    
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });
