const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const generateToken = async (userId, role = null) => {
  try {
    // Fetch user role only if not provided
    if (!role) {
      const user = await User.findById(userId);
      if (!user || !user.role) {
        throw new Error('User not found or role is missing.');
      }
      role = user.role;
    }

    // Create and return token
    const token = jwt.sign({ userId, role }, process.env.JWT_SECRET_KEY, {
      expiresIn: '1h', // Set token expiration time for security
    });

    return token;
  } catch (error) {
    console.error('Error generating token:', error.message);
    throw error;
  }
};

module.exports = generateToken;
