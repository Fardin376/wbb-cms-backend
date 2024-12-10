const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const allowedOrigins =
  process.env.NODE_ENV === 'development'
    ? [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://wbb-cms-frontend.vercel.app',
        'https://wbb-cms-admin-panel.vercel.app',
      ]
    : process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()) ||
      [];

const corsMiddleware = cors({
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'CSRF-Token',
    'XSRF-TOKEN',
    'X-XSRF-TOKEN',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['set-cookie', 'Date', 'ETag'],
});

module.exports = corsMiddleware;
