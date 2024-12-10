const express = require('express');
const User = require('../models/user.model');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middleware/tokenVerification');
const { isAdminUser } = require('../middleware/isAdminUser');
const csrf = require('csurf');
const generateToken = require('../middleware/generateToken');

// Initialize CSRF middleware
const csrfProtection = csrf({
  cookie: {
    key: 'XSRF-TOKEN',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
});

//user registration
router.post('/register', async (req, res) => {
  try {
    const user = new User({ ...req.body });

    //console.log(user);

    await user.save();
    res.status(200).send({ message: 'Registration Successful!' });
  } catch (error) {
    console.log('Failed to register user', error);
    res.status(500).json({ message: 'Registration failed!' });
  }
});

//user login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = await generateToken(user._id, user.role);

    // Set cookie with more specific options
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      // sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
      domain: 'vercel.app', // Remove the leading dot
    });

    // Log cookie setting
    console.log('Setting cookie:', {
      token: token.substring(0, 20) + '...',
      domain: 'vercel.app',
      path: '/',
    });

    // Set CSRF cookie with explicit domain
    const csrfToken = require('crypto').randomBytes(32).toString('hex');
    res.cookie('XSRF-TOKEN', csrfToken, {
      secure: process.env.NODE_ENV === 'production',
      // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      httpOnly: false,
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? '.vercel.app' : undefined,
    });

    if (process.env.NODE_ENV === 'development') {
      console.log('Login successful:', {
        userId: user._id,
        cookies: res.getHeaders()['set-cookie'],
      });
    }

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
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
});

// Add auth check endpoint
router.get('/check', async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token found',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

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
    res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }
});

// Protected routes (with CSRF)

//logout user
router.post('/logout', verifyToken, (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.clearCookie('XSRF-TOKEN', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ success: true, message: 'Logged out successfully' });
});

router.use(csrfProtection);
//get all users
router.get('/users', verifyToken, async (req, res) => {
  try {
    const users = await User.find({}, 'id username email role');

    res.status(200).send({ message: 'Users found successfully!', users });
  } catch (error) {
    console.log('Failed to fetch users!', error);
    res.status(500).json({ message: 'Failed to fetch users!' });
  }
});

//get current user
router.get('/users/current', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId, 'id username email role');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
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

//delete a user
router.delete('/users/:id', isAdminUser, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).send({ message: 'User not found!' });
    }

    res.status(200).send({ message: 'User deleted successfully!' });
  } catch (error) {
    console.log('Failed to delete user!', error);
    res.status(500).json({ message: 'Failed to delete user!' });
  }
});

//update user role
router.put('/users/:id', isAdminUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(id, { role }, { new: true });

    if (!user) {
      return res.status(404).send({ message: 'User not found!' });
    }

    res.status(200).send({ message: 'User role updated successfully!', user });
  } catch (error) {
    console.log('Failed to update user role!', error);
    res.status(500).json({ message: 'Failed to update user role!' });
  }
});

router.get('/verify-token', verifyToken, async (req, res) => {
  try {
    res.status(200).send({ isAuthenticated: true });
  } catch (error) {
    console.log('Failed to fetch token!', error);
    res.status(500).json({ message: 'Failed to fetch token!' });
  }
});

// Check auth status
router.get('/check-auth', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Refresh CSRF token
    const token = req.csrfToken();
    res.cookie('XSRF-TOKEN', token, {
      secure: process.env.NODE_ENV === 'production',
      // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      httpOnly: false,
      path: '/',
    });

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking authentication status',
      details:
        process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

module.exports = router;
