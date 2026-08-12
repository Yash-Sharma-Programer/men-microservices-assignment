const { z } = require('zod');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { publishEvent } = require('../events/publisher');
const logger = require('../utils/logger');

const updateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});

async function getMe(req, res, next) {
  const user = await User.findById(req.user.sub);
  if (!user) return next(new AppError('User not found', 404));
  res.json({ success: true, data: { user: user.toPublicJSON() } });
}

async function getUserById(req, res, next) {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found', 404));
  res.json({ success: true, data: { user: user.toPublicJSON() } });
}

async function updateMe(req, res, next) {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError('Validation failed', 422, parsed.error.issues));
  }

  const user = await User.findByIdAndUpdate(req.user.sub, parsed.data, {
    new: true,
    runValidators: true,
  });
  if (!user) return next(new AppError('User not found', 404));

  try {
    await publishEvent('user.updated', {
      userId: user._id.toString(),
      email: user.email,
      changes: parsed.data,
    });
  } catch (err) {
    logger.warn('user.updated event publish failed', { error: err.message });
  }

  res.json({ success: true, message: 'Profile updated', data: { user: user.toPublicJSON() } });
}

async function listUsers(req, res, next) {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

  const [users, total] = await Promise.all([
    User.find()
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 }),
    User.countDocuments(),
  ]);

  res.json({
    success: true,
    data: {
      users: users.map((u) => u.toPublicJSON()),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    },
  });
}

module.exports = { getMe, getUserById, updateMe, listUsers };
