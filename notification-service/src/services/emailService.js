const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

/**
 * Sends an email, or logs it when EMAIL_DRY_RUN=true (default for local
 * development so the assignment can be run without real SMTP credentials).
 */
async function sendEmail({ to, subject, text }) {
  if (String(process.env.EMAIL_DRY_RUN).toLowerCase() !== 'false') {
    logger.info('[EMAIL_DRY_RUN] Simulated email send', { to, subject, text });
    return { simulated: true };
  }

  const info = await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject,
    text,
  });

  return info;
}

module.exports = { sendEmail };
