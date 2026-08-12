const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');

/**
 * Verifies the JWT issued at login. Accepts the token either from the
 * Authorization header directly (service tested standalone) or as
 * forwarded by the API Gateway.
 */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentication token missing', 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: process.env.JWT_ISSUER,
    });
    req.user = decoded;
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
}

/**
 * Defense-in-depth: verifies requests reaching this service actually
 * came through the API Gateway (which attaches a shared internal key).
 * Direct calls to the service without the key are rejected. In
 * production this is paired with network-level isolation (private
 * subnet / service mesh) so the service is not internet-reachable at all.
 */
function requireInternalKey(req, res, next) {
  const key = req.headers['x-internal-api-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return next(new AppError('Forbidden: missing or invalid internal service credentials', 403));
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: insufficient permissions', 403));
    }
    next();
  };
}

module.exports = { requireAuth, requireInternalKey, requireRole };
