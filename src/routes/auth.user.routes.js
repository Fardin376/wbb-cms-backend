const express = require('express');
const User = require('../models/user.model');
const router = express.Router();
const bcrypt = require('bcrypt');
const verifyToken = require('../middleware/tokenVerification');
const isAdmin = require('../middleware/isAdmin');
const csrf = require('csurf');
const generateToken = require('../middleware/generateToken');
const clearAuthCookie = require('../controllers/clearAuthCookie');

// Initialize CSRF middleware
const csrfProtection = csrf({
  cookie: {
    key: 'XSRF-TOKEN',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
  },
});

// User registration
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, username, password: hashedPassword });

    await user.save();
    res.status(200).json({ message: 'Registration Successful!' });
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ message: 'Registration failed!' });
  }
});

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

    // Set token in cookie with secure options
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    // Set CSRF token
    // const csrfToken = req.csrfToken();
    // res.cookie('XSRF-TOKEN', csrfToken, {
    //   httpOnly: false,
    //   secure: true,
    //   sameSite: 'Strict',
    //   path: '/',
    // });

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
router.post('/logout', verifyToken, (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// Auth check (Protected route)
router.get('/check', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

// Get current user (Protected route)
router.get('/users/current', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// Admin routes (requires isAdmin middleware)

router.use(csrfProtection);

// Get all users (Admin only)
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'username email role');
    res.status(200).json({ message: 'Users found successfully!', users });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ message: 'Failed to fetch users!' });
  }
});

// Delete a user (Admin only)
router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    if (!user) return res.status(404).json({ message: 'User not found!' });

    res.status(200).json({ message: 'User deleted successfully!' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ message: 'Failed to delete user!' });
  }
});

// Update user role (Admin only)
router.put('/users/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(id, { role }, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found!' });

    res.status(200).json({ message: 'User role updated successfully!', user });
  } catch (error) {
    console.error('Failed to update user role:', error);
    res.status(500).json({ message: 'Failed to update user role!' });
  }
});

// Verify token validity (For frontend token checking)
router.get('/verify-token', verifyToken, (req, res) => {
  res.status(200).json({ isAuthenticated: true });
});

module.exports = router;
