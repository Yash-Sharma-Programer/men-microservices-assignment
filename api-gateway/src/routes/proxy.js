const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const config = require('../config');
const logger = require('../utils/logger');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

/**
 * Attaches the shared internal API key to every proxied request so
 * downstream services can confirm the request genuinely came through
 * the gateway, and never strips/forwards it from client input.
 */
function onProxyReq(proxyReq, req) {
  proxyReq.setHeader('x-internal-api-key', config.internalApiKey);
  if (req.user) {
    proxyReq.setHeader('x-user-id', req.user.sub);
    proxyReq.setHeader('x-user-role', req.user.role);
  }
}

function onError(err, req, res) {
  logger.error('Proxy error', { error: err.message, path: req.originalUrl });
  res.status(502).json({ success: false, message: 'Upstream service unavailable' });
}

// --- Public auth endpoints (register/login) — proxied to User Service ---
router.use(
  '/api/auth',
  authLimiter,
  createProxyMiddleware({
    target: config.services.user,
    changeOrigin: true,
    onProxyReq,
    onError,
    logLevel: 'warn',
  })
);

// --- Protected user endpoints — require a valid JWT before proxying ---
router.use(
  '/api/users',
  requireAuth,
  createProxyMiddleware({
    target: config.services.user,
    changeOrigin: true,
    onProxyReq,
    onError,
    logLevel: 'warn',
  })
);

// --- Protected notification endpoints ---
router.use(
  '/api/notifications',
  requireAuth,
  createProxyMiddleware({
    target: config.services.notification,
    changeOrigin: true,
    onProxyReq,
    onError,
    logLevel: 'warn',
  })
);

module.exports = router;
