const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { cookieSettings } = require('./cors');

const setAuthCookie = (res, token) => {
  res.cookie('token', token, cookieSettings);
};

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
        isAuthError: true,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Assign token payload to req.user and include role
    req.user = { userId: decoded.userId, role: decoded.role };

    // Fetch user from the database only if necessary
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        isAuthError: true,
      });
    }

    // Avoid resetting the cookie on every request
    if (!req.cookies.token) {
      setAuthCookie(res, token);
    }

    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please login again.',
      isAuthError: true,
    });
  }
};

module.exports = authMiddleware;
