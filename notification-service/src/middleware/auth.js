const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return next(new AppError('Authentication token missing', 401));

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET, { issuer: process.env.JWT_ISSUER });
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
}

// See user-service/src/middleware/auth.js for rationale: this rejects
// any request that did not come through the API Gateway.
function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-api-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return next(new AppError('Forbidden: missing or invalid internal service credentials', 403));
  }
  next();
}

module.exports = { requireAuth, requireInternalKey };
