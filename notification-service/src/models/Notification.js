const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    email: { type: String, required: true },
    type: {
      type: String,
      enum: ['WELCOME', 'PROFILE_UPDATED', 'LOGIN_ALERT'],
      required: true,
    },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
    },
    sourceEvent: { type: String, required: true },
    error: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
