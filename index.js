require('events').EventEmitter.defaultMaxListeners = 15;

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const { corsMiddleware, cookieSettings } = require('./src/middleware/cors');
const path = require('path');
const ensureUploadDir = require('./src/utils/ensureUploadDir');
const publicRoutes = require('./src/routes/public.routes');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Basic middleware
app.use(cookieParser());
app.use(corsMiddleware);

app.use((req, res, next) => {
  res.cookie = res.cookie.bind(res);
  const originalCookie = res.cookie;
  res.cookie = function (name, value, options = {}) {
    return originalCookie.call(this, name, value, {
      ...cookieSettings,
      ...options,
    });
  };
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(
  bodyParser.urlencoded({
    limit: '50mb',
    extended: true,
    parameterLimit: 50000,
  })
);

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'development' ||
    req.path.startsWith('/api/public'),
});

app.use(limiter);

// Initialize CSRF protection with updated configuration
const csrfMiddleware = csrf({
  cookie: {
    key: 'XSRF-TOKEN',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  },
  value: (req) => {
    const token = req.headers['x-xsrf-token'] || req.cookies['XSRF-TOKEN'];

    if (process.env.NODE_ENV === 'development') {
      console.log('CSRF Token from request:', {
        header: req.headers['x-xsrf-token'],
        cookie: req.cookies['XSRF-TOKEN'],
        using: token,
      });
    }

    return token;
  },
});

// Routes that don't need CSRF
app.use('/api/public', publicRoutes);

// CSRF token endpoint
app.get('/api/csrf-token', csrfMiddleware, (req, res) => {
  try {
    const token = req.csrfToken();
    res.cookie('XSRF-TOKEN', token, {
      secure: process.env.NODE_ENV === 'production',
      // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      httpOnly: false,
      path: '/',
    });
    res.json({ csrfToken: token });
  } catch (error) {
    console.error('CSRF Token Generation Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate CSRF token',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Auth routes with conditional CSRF
app.use(
  '/api/auth',
  (req, res, next) => {
    if (req.path === '/login') {
      next();
    } else {
      csrfMiddleware(req, res, next);
    }
  },
  require('./src/routes/auth.user.routes')
);

// Protected routes with CSRF
app.use('/api/menu', csrfMiddleware, require('./src/routes/menu.routes'));
app.use('/api/pages', csrfMiddleware, require('./src/routes/page.routes'));
app.use('/api/layouts', csrfMiddleware, require('./src/routes/layout.routes'));
app.use(
  '/api/categories',
  csrfMiddleware,
  require('./src/routes/category.routes')
);
app.use('/api/posts', csrfMiddleware, require('./src/routes/posts.routes'));
app.use('/api/gallery', csrfMiddleware, require('./src/routes/gallery.routes'));
app.use('/api/pdfs', csrfMiddleware, require('./src/routes/pdf.routes'));

// Error handler for CSRF
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    console.error('CSRF Error:', {
      path: req.path,
      headers: req.headers,
      cookies: req.cookies,
      error: err.message,
    });
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
  next(err);
});

// General error handler
app.use(require('./src/middleware/errorHandler'));

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB successfully');
    await ensureUploadDir();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });

    app.get('/', (req, res) => {
      res.send('Welcome to the WBB CMS Backend!');
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  });

module.exports = app;
