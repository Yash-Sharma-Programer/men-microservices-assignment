const { connect, StringCodec } = require('nats');
const logger = require('../utils/logger');

const sc = StringCodec();
let natsConnection = null;
let jetStreamClient = null;
let jetStreamManager = null;

async function connectNats() {
  if (natsConnection) return natsConnection;

  const servers = (process.env.NATS_SERVERS || 'nats://localhost:4222').split(',');

  const options = {
    servers,
    user: process.env.NATS_USER,
    pass: process.env.NATS_PASSWORD,
    name: process.env.SERVICE_NAME || 'notification-service',
    reconnect: true,
    maxReconnectAttempts: -1,
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

  return natsConnection;
}

function getJetStream() {
  if (!jetStreamClient) throw new Error('JetStream client not initialized. Call connectNats() first.');
  return jetStreamClient;
}

function getJetStreamManager() {
  if (!jetStreamManager) throw new Error('JetStreamManager not initialized. Call connectNats() first.');
  return jetStreamManager;
}

async function closeNats() {
  if (natsConnection) {
    await natsConnection.drain();
    natsConnection = null;
    logger.info('NATS connection drained and closed');
  }
}

module.exports = { connectNats, getJetStream, getJetStreamManager, closeNats, sc };
