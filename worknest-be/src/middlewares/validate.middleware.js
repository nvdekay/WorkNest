const ApiError = require('../utils/ApiError');

const validate = (schema) => (req, _res, next) => {
  const toValidate = {};
  if (schema.body) toValidate.body = req.body;
  if (schema.query) toValidate.query = req.query;
  if (schema.params) toValidate.params = req.params;

  const compiled = require('joi').object(schema);
  const { value, error } = compiled.validate(toValidate, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => d.message);
    return next(new ApiError(400, 'Validation failed', details));
  }

  Object.assign(req, value);
  return next();
};

module.exports = validate;
