require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const { globalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const proxyRoutes = require('./routes/proxy');
const logger = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.allowedOrigins, credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(globalLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

// NOTE: proxy routes are mounted before any express.json() body
// parser. http-proxy-middleware needs the raw, unconsumed request
// stream to correctly forward the body to downstream services.
app.use(proxyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`API Gateway listening on port ${config.port}`);
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
