const { getJetStream, sc } = require('../config/nats');
const logger = require('../utils/logger');

/**
 * Publishes a domain event to JetStream with at-least-once delivery
 * guarantees. The publish call awaits a PubAck from the server, so a
 * failure to persist the message (e.g. broker unreachable) surfaces
 * as a thrown error the caller can react to (log, retry, alert).
 *
 * @param {string} subject e.g. "user.registered"
 * @param {object} payload serializable event payload
 */
async function publishEvent(subject, payload) {
  const js = getJetStream();
  const event = {
    subject,
    payload,
    metadata: {
      publishedAt: new Date().toISOString(),
      source: process.env.SERVICE_NAME || 'user-service',
    },
  };

  try {
    const ack = await js.publish(subject, sc.encode(JSON.stringify(event)));
    logger.info(`Published event "${subject}"`, { seq: ack.seq, stream: ack.stream });
    return ack;
  } catch (err) {
    logger.error(`Failed to publish event "${subject}"`, { error: err.message });
    // Re-throw so the caller can decide whether the failure should
    // block the HTTP response or be handled as a best-effort side effect.
    throw err;
  }
}

module.exports = { publishEvent };
