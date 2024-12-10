const jwt = require('jsonwebtoken');

const verifyTokenMiddleware = (req, res, next) => {
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

    // Log user ID only in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Token verified for user:', decoded.userId);
    }

    req.user = { userId: decoded.userId, role: decoded.role };
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);

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

module.exports = verifyTokenMiddleware;
