const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const JWT_secret = process.env.JWT_SECRET_KEY;

// Updated function to accept both userId and role (optional)
const generateToken = async (userId, role) => {
  try {
    let userRole = role;

    // If role is not passed, fetch the user to get their role
    if (!userRole) {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found!');
      }
      userRole = user.role;
    }

    // Create JWT token
    const token = jwt.sign({ userId, role: userRole }, process.env.JWT_SECRET_KEY);

    return token;
  } catch (error) {
    console.error('Error generating token:', error.message); // Improved logging
    throw error;
  }
};

module.exports = generateToken;
