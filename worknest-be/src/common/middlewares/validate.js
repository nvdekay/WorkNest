const Joi = require('joi');
const ApiError = require('../errors/ApiError');

// validate({ body?, query?, params? }) — mỗi key là Joi schema.
const validate = (schema = {}) => {
  const compiled = {};
  for (const key of ['body', 'query', 'params']) {
    if (schema[key]) compiled[key] = Joi.isSchema(schema[key]) ? schema[key] : Joi.object(schema[key]);
  }

  return (req, _res, next) => {
    const details = [];
    for (const key of Object.keys(compiled)) {
      const { value, error } = compiled[key].validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        for (const d of error.details) {
          details.push({ field: `${key}.${d.path.join('.')}`, message: d.message });
        }
      } else {
        req[key] = value;
      }
    }
    if (details.length) return next(new ApiError('VALIDATION_ERROR', undefined, details));
    return next();
  };
};

module.exports = validate;
