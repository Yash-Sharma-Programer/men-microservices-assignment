const { AppError } = require('./errorHandler');

/**
 * Generic request-body validator. Pass a zod schema; on failure a
 * 422 AppError is thrown with field-level details.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(new AppError('Validation failed', 422, details));
    }
    req.body = result.data;
    next();
  };
}

module.exports = validate;
