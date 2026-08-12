const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 400, details = undefined) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 422;
    details = Object.values(err.errors).map((e) => e.message);
    message = 'Validation failed';
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate value for field(s): ${Object.keys(err.keyValue).join(', ')}`;
  }

  if (statusCode >= 500) {
    logger.error(message, { stack: err.stack, path: req.originalUrl });
  } else {
    logger.warn(message, { path: req.originalUrl, details });
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = { AppError, notFoundHandler, errorHandler };
