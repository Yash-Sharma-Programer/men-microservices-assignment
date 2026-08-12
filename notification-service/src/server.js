require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { connectNats, closeNats } = require('./config/nats');
const { startSubscriber } = require('./events/subscriber');
const { requireInternalKey } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const notificationRoutes = require('./routes/notificationRoutes');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4002;

app.use(helmet());
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

app.use(requireInternalKey);
app.use('/api/notifications', notificationRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    await connectNats();
    await startSubscriber();

    const server = app.listen(PORT, () => {
      logger.info(`Notification Service listening on port ${PORT}`);
    });

    const shutdown = async (signal) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        await closeNats();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    logger.error('Failed to start Notification Service', { error: err.message });
    process.exit(1);
  }
}

start();

module.exports = app;
