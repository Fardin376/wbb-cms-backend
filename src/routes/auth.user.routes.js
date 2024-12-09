const express = require('express');
const User = require('../models/user.model');
const auth = require('../middleware/auth');
const isAdminUser = require('../middleware/isAdminUser');
const verifyToken = require('../middleware/tokenVerification');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

    // Create token with user ID and role
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
      },
      process.env.JWT_SECRET_KEY,
      { expiresIn: '24h' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
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
      message: 'Login failed',
      error: error.message,
    });
  }
});

//logout user
router.post('/logout', async (req, res) => {
  try {
    res.clearCookie('token', { path: '/' });
    res.status(200).send({ message: 'Logged out successfully!' });
  } catch (error) {
    console.log('Failed to log out', error);
    res.status(500).json({ message: 'Logout failed!' });
  }
});

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
        role: user.role
      }
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

router.get('/check-auth', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking authentication status',
    });
  }
});

module.exports = router;
