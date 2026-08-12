const jwt = require('jsonwebtoken');
const config = require('../config');
const { AppError } = require('./errorHandler');

/**
 * Verifies the JWT at the edge before a request is ever proxied
 * downstream. This is defense-in-depth: each backend service also
 * verifies the token independently, but rejecting unauthenticated
 * traffic here means invalid requests never reach internal services
 * or consume their resources.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication token missing', 401));
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret, { issuer: config.jwtIssuer });
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
}

module.exports = { requireAuth };
