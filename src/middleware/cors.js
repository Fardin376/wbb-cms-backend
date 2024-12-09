const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const allowedOrigins = process.env.NODE_ENV === 'development' 
  ? ['http://localhost:5173', 'http://localhost:3000']
  : process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()) || [];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'CSRF-Token'],
  exposedHeaders: ['CSRF-Token'],
};

module.exports = cors(corsOptions);
