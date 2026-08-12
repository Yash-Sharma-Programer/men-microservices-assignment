const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    logger.error(message, { stack: err.stack, path: req.originalUrl });
  } else {
    logger.warn(message, { path: req.originalUrl });
  }

  res.status(statusCode).json({ success: false, message });
}

module.exports = { AppError, notFoundHandler, errorHandler };
