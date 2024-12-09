const isAdminUser = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).send({
      success: false,
      message: 'Unauthorized access! Admin access required.',
    });
  }
  next();
};

module.exports = isAdminUser;
