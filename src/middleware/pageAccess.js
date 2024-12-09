const pageAccess = (req, res, next) => {
  const allowedRoles = ['superadmin', 'admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Only SuperAdmin and Admin can access pages',
    });
  }
  next();
};

module.exports = pageAccess; 