module.exports = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtIssuer: process.env.JWT_ISSUER,
  internalApiKey: process.env.INTERNAL_API_KEY,
  services: {
    user: process.env.USER_SERVICE_URL || 'http://localhost:4001',
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4002',
  },
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 200,
  },
};
