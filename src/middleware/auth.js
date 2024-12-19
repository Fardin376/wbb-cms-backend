const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
// const { cookieSettings } = require('./cors');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.warn('No token provided'); // Debugging: No token
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
        isAuthError: true,
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    req.user = { userId: decoded.userId, role: decoded.role };

    console.log(req.user, decoded);

    // Fetch user from database
    const user = await User.findById(decoded.userId);
    if (!user) {
      console.warn(`User not found for ID: ${decoded.userId}`); // Debugging: Missing user
      return res.status(401).json({
        success: false,
        message: 'User not found',
        isAuthError: true,
      });
    }

    console.log('Authenticated user:', user); // Debugging: User details
    next();
  } catch (error) {
    console.error('Authentication error:', error.message); // Debugging errors

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'Lax',
    });

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please login again.',
      isAuthError: true,
    });
  }
};

module.exports = authMiddleware;
