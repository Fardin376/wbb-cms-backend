const layoutAccess = (req, res, next) => {
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Only SuperAdmin can access layouts',
    });
  }
  next();
};

module.exports = layoutAccess; 