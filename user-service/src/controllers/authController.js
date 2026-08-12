const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');
const { publishEvent } = require('../events/publisher');
const logger = require('../utils/logger');

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h', issuer: process.env.JWT_ISSUER }
  );
}

async function register(req, res, next) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError('Validation failed', 422, parsed.error.issues));
  }
  const { name, email, password } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    return next(new AppError('An account with this email already exists', 409));
  }

  const user = await User.create({ name, email, password });
  const token = signToken(user);

  // Publish an async, fire-and-forget style domain event. Failure to
  // publish does not fail the registration itself (the write to the
  // source of truth already succeeded); it is logged for alerting.
  try {
    await publishEvent('user.registered', {
      userId: user._id.toString(),
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    logger.error('user.registered event publish failed after successful registration', {
      userId: user._id.toString(),
      error: err.message,
    });
  }

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: { user: user.toPublicJSON(), token },
  });
}

async function login(req, res, next) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return next(new AppError('Validation failed', 422, parsed.error.issues));
  }
  const { email, password } = parsed.data;

  const user = await User.findOne({ email }).select('+password');
  if (!user || !user.isActive) {
    return next(new AppError('Invalid credentials', 401));
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return next(new AppError('Invalid credentials', 401));
  }

  const token = signToken(user);

  try {
    await publishEvent('user.loggedIn', {
      userId: user._id.toString(),
      email: user.email,
      at: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('user.loggedIn event publish failed', { error: err.message });
  }

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user: user.toPublicJSON(), token },
  });
}

module.exports = { register, login };
