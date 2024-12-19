const isAdmin = (req, res, next) => {
  const { role } = req.user;

  if (!['admin', 'superadmin'].includes(role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to perform this action.',
    });
  }

  next();
};

module.exports = isAdmin;
