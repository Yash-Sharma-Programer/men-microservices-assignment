require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { connectNats, closeNats } = require('./config/nats');
const { requireInternalKey } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 4001;

app.use(helmet());
app.use(
  cors({
    origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean),
    credentials: true,
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Global rate limiting as a baseline; auth routes have a stricter limiter.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service', timestamp: new Date().toISOString() });
});

// Every non-health route below is expected to arrive via the API
// Gateway, which attaches a shared internal key. This prevents the
// service from being usable if it is ever exposed directly.
app.use(requireInternalKey);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    await connectDB();
    await connectNats();

    const server = app.listen(PORT, () => {
      logger.info(`User Service listening on port ${PORT}`);
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
    logger.error('Failed to start User Service', { error: err.message });
    process.exit(1);
  }
}

start();

module.exports = app;
