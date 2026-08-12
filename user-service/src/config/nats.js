const { connect, credsAuthenticator, StringCodec } = require('nats');
const fs = require('fs');
const logger = require('../utils/logger');

const sc = StringCodec();
let natsConnection = null;
let jetStreamClient = null;
let jetStreamManager = null;

/**
 * Establishes a secure, authenticated connection to the NATS server.
 * Uses username/password auth by default; TLS can be enabled via env vars
 * for production deployments (mutual TLS recommended).
 */
async function connectNats() {
  if (natsConnection) return natsConnection;

  const servers = (process.env.NATS_SERVERS || 'nats://localhost:4222').split(',');

  const options = {
    servers,
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASSWORD,
    name: process.env.SERVICE_NAME || 'user-service',
    reconnect: true,
    maxReconnectAttempts: -1, // retry indefinitely
    reconnectTimeWait: 2000,
    timeout: 5000,
  };

  if (String(process.env.NATS_TLS_ENABLED).toLowerCase() === 'true') {
    options.tls = {
      caFile: process.env.NATS_TLS_CA,
      certFile: process.env.NATS_TLS_CERT,
      keyFile: process.env.NATS_TLS_KEY,
    };
  }

  natsConnection = await connect(options);
  logger.info(`Connected to NATS at ${natsConnection.getServer()}`);

  (async () => {
    for await (const status of natsConnection.status()) {
      logger.warn(`NATS connection status event: ${status.type}`, { data: status.data });
    }
  })().catch((err) => logger.error('NATS status watcher error', { error: err.message }));

  jetStreamManager = await natsConnection.jetstreamManager();
  jetStreamClient = natsConnection.jetstream();

  // Ensure the durable stream exists for reliable, at-least-once delivery
  // of user domain events. Consumers (Notification Service) acknowledge
  // messages explicitly; unacked messages are redelivered.
  const streamName = process.env.NATS_STREAM || 'USER_EVENTS';
  try {
    await jetStreamManager.streams.info(streamName);
  } catch (err) {
    await jetStreamManager.streams.add({
      name: streamName,
      subjects: ['user.>'],
      retention: 'limits',
      max_age: 24 * 60 * 60 * 1_000_000_000, // 24h in ns
      storage: 'file',
      num_replicas: 1,
    });
    logger.info(`Created JetStream stream "${streamName}"`);
  }

  return natsConnection;
}

function getJetStream() {
  if (!jetStreamClient) throw new Error('JetStream client not initialized. Call connectNats() first.');
  return jetStreamClient;
}

async function closeNats() {
  if (natsConnection) {
    await natsConnection.drain();
    natsConnection = null;
    logger.info('NATS connection drained and closed');
  }
}

module.exports = { connectNats, getJetStream, closeNats, sc };
