const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { cookieSettings } = require('./cors');

const setAuthCookie = (res, token) => {
  res.cookie('token', token, cookieSettings);
};

const auth = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
        isAuthError: true
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        isAuthError: true
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    // Clear cookie on verification failure
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    
    res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.',
      isAuthError: true
    });
  }
};

module.exports = auth;
