const isAdmin = (req, res, next) => {
  // Check if user exists and has a role
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  // Check if user has required role
  const allowedRoles = ['superadmin', 'admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized access! Only SuperAdmin, Admin, and Editor can access posts.',
    });
  }

  next();
};

module.exports = isAdmin;
