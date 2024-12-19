const express = require('express');
const User = require('../models/user.model');
const authMiddleware = require('../middleware/auth');
const bcrypt = require('bcrypt');
const isAdmin = require('../middleware/isAdmin');
const generateToken = require('../middleware/generateToken');
const clearAuthCookie = require('../controllers/clearAuthCookie');

const router = express.Router();

// User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(401)
        .json({ success: false, message: 'Invalid credentials' });
    }

    const token = await generateToken(user._id, user.role);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Logout user
router.post('/logout', authMiddleware, (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// Admin-only route to get all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username email role');
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
});

// Verify token validity
router.get('/verify-token', authMiddleware, (req, res) => {
  res.status(200).json({ isAuthenticated: true });
});

// /auth/check route to validate token and fetch user details
router.get('/check', authMiddleware, async (req, res) => {
  try {
    console.time('Auth Check Execution Time'); // Start timer

    const user = await User.findById(req.user.userId).select('-password'); // Exclude password
    if (!user) {
      console.warn(`User not found for ID: ${req.user.userId}`);
      return res
        .status(404)
        .json({ success: false, message: 'User not found' });
    }

    console.log('User fetched:', user); // Debugging user details

    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });

    console.timeEnd('Auth Check Execution Time'); // End timer
  } catch (error) {
    console.error('Error in /auth/check:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch user' });
  }
});

module.exports = router;
