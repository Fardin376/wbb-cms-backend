require('events').EventEmitter.defaultMaxListeners = 15;

const express = require('express');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const cors = require('./src/middleware/cors');
const path = require('path');
const compression = require('compression');
const ensureUploadDir = require('./src/utils/ensureUploadDir');
const publicRoutes = require('./src/routes/public.routes');
const prisma = require('./src/services/db.service');

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

// Basic middleware
app.use(cors);
app.use(cookieParser());
app.use(compression());

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
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'public/uploads')),
  require('./src/routes/page.routes')
);

// Routes that don't need CSRF
app.use('/api/public', publicRoutes);

// Auth routes with conditional CSRF
app.use('/api/auth', require('./src/routes/auth.user.routes'));

// Protected routes with CSRF
app.use('/api/menu', require('./src/routes/menu.routes'));
app.use('/api/pages', require('./src/routes/page.routes'));
app.use('/api/layouts', require('./src/routes/layout.routes'));
app.use('/api/categories', require('./src/routes/category.routes'));
app.use('/api/posts', require('./src/routes/posts.routes'));
app.use('/api/gallery', require('./src/routes/gallery.routes'));
app.use('/api/banners', require('./src/routes/banner.routes'));
app.use('/api/pdfs', require('./src/routes/pdf.routes'));
app.use('/api/links', require('./src/routes/footer.routes'));
app.use('/api/socials', require('./src/routes/social.routes'));

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
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
  });
});

app.get('/', (req, res) => {
  res.send('Welcome to the WBB CMS Backend!');
});

// Test database connection and start server
prisma
  .$connect()
  .then(() => {
    console.log('Connected to Database via Prisma');
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Database connection error:', error);
    process.exit(1);
  });

module.exports = app;
