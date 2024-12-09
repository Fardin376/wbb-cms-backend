const errorHandler = (err, req, res, next) => {
  // Log error details
  console.error({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  // Handle specific error types
  if (err.name === 'MongoServerError' && err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate key error'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = errorHandler;
