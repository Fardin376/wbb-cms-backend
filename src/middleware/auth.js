const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const auth = async (req, res, next) => {
  try {
    // Get token from cookies
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please login.',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    // Attach user info to request object
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.',
    });
  }
};

module.exports = auth; 