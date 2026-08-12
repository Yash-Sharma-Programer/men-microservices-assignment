const { AckPolicy, DeliverPolicy } = require('nats');
const { getJetStream, getJetStreamManager, sc } = require('../config/nats');
const Notification = require('../models/Notification');
const { sendEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const STREAM_NAME = process.env.NATS_STREAM || 'USER_EVENTS';
const DURABLE_NAME = process.env.NATS_DURABLE_CONSUMER || 'notification-service-consumer';
const MAX_DELIVER = 5;

// Maps an event subject to how it should be turned into a notification.
const EVENT_HANDLERS = {
  'user.registered': (payload) => ({
    type: 'WELCOME',
    subject: 'Welcome! Your account has been created',
    message: `Hi ${payload.name}, welcome aboard! Your account (${payload.email}) is ready to use.`,
  }),
  'user.updated': (payload) => ({
    type: 'PROFILE_UPDATED',
    subject: 'Your profile was updated',
    message: `Hi, your profile changes were saved: ${JSON.stringify(payload.changes)}.`,
  }),
  'user.loggedIn': (payload) => ({
    type: 'LOGIN_ALERT',
    subject: 'New login to your account',
    message: `We noticed a new login to your account at ${payload.at}. If this wasn't you, please secure your account.`,
  }),
};

/**
 * Creates (or reuses) a durable JetStream pull consumer and processes
 * messages one at a time with explicit acknowledgement:
 *  - On success: ack() so the broker never redelivers it.
 *  - On transient failure: nak() with a backoff delay so JetStream
 *    redelivers it (up to MAX_DELIVER times).
 *  - After MAX_DELIVER failed attempts, the message is term()inated
 *    (removed from redelivery) and logged as a poison message, so a
 *    single bad event can never block the whole queue forever.
 * This gives at-least-once, ordered-per-consumer delivery — messages
 * are never silently dropped on a crash mid-processing.
 */
async function startSubscriber() {
  const jsm = getJetStreamManager();
  const js = getJetStream();

  await jsm.consumers.add(STREAM_NAME, {
    durable_name: DURABLE_NAME,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    max_deliver: MAX_DELIVER,
    ack_wait: 30 * 1_000_000_000, // 30s in ns
    filter_subject: 'user.>',
  });

  const consumer = await js.consumers.get(STREAM_NAME, DURABLE_NAME);
  logger.info(`Subscribed to stream "${STREAM_NAME}" as durable consumer "${DURABLE_NAME}"`);

  // Long-lived pull loop. Runs for the lifetime of the process.
  (async () => {
    while (true) {
      try {
        const messages = await consumer.consume({ max_messages: 10, expires: 5000 });
        for await (const m of messages) {
          await handleMessage(m);
        }
      } catch (err) {
        logger.error('Consumer pull loop error, retrying shortly', { error: err.message });
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  })();
}

async function handleMessage(m) {
  let event;
  try {
    event = JSON.parse(sc.decode(m.data));
  } catch (err) {
    logger.error('Failed to parse event payload, terminating message (poison message)', {
      error: err.message,
    });
    m.term();
    return;
  }

  const { subject, payload } = event;
  const handler = EVENT_HANDLERS[subject];

  if (!handler) {
    logger.warn(`No handler registered for subject "${subject}", acking to skip`);
    m.ack();
    return;
  }

  try {
    const { type, subject: emailSubject, message } = handler(payload);

    const notification = await Notification.create({
      userId: payload.userId,
      email: payload.email,
      type,
      subject: emailSubject,
      message,
      status: 'PENDING',
      sourceEvent: subject,
    });

    try {
      await sendEmail({ to: payload.email, subject: emailSubject, text: message });
      notification.status = 'SENT';
      await notification.save();
    } catch (sendErr) {
      notification.status = 'FAILED';
      notification.error = sendErr.message;
      await notification.save();
      throw sendErr; // trigger redelivery below
    }

    m.ack();
    logger.info(`Processed event "${subject}" -> notification ${notification._id}`);
  } catch (err) {
    logger.error(`Failed to process event "${subject}", will retry`, {
      error: err.message,
      deliveryCount: m.info.redeliveryCount,
    });
    if (m.info.redeliveryCount >= MAX_DELIVER) {
      logger.error(`Max redeliveries reached for event "${subject}", terminating message`);
      m.term();
    } else {
      // Exponential-ish backoff before redelivery.
      m.nak(2000 * m.info.redeliveryCount || 2000);
    }
  }
}

module.exports = { startSubscriber };
