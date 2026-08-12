const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');

async function getMyNotifications(req, res, next) {
  const userId = req.user.sub;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const [notifications, total] = await Promise.all([
    Notification.find({ userId })
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 }),
    Notification.countDocuments({ userId }),
  ]);

  res.json({
    success: true,
    data: {
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

async function getNotificationById(req, res, next) {
  const notification = await Notification.findById(req.params.id);
  if (!notification) return next(new AppError('Notification not found', 404));

  if (notification.userId !== req.user.sub && req.user.role !== 'admin') {
    return next(new AppError('Forbidden', 403));
  }

  res.json({ success: true, data: { notification } });
}

module.exports = { getMyNotifications, getNotificationById };
