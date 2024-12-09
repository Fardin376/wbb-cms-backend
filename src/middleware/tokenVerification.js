const jwt = require('jsonwebtoken');
const JWT_secret = process.env.JWT_SECRET_KEY;

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).send({ message: 'Token not found' });
  }
  try {
    const decoded = jwt.verify(token, JWT_secret);
    req.userId = decoded.userId;
    req.username = decoded.username;
    req.email = decoded.email;
    req.role = decoded.role;
    next();
  } catch (error) {
    console.error('Error verifying token', error);
    return res.status(401).send({ message: 'Invalid token!' });
  }
};

module.exports = verifyToken;
