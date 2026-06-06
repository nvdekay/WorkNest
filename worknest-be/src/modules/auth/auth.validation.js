const Joi = require('joi');

const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Za-z]/, 'letter')
  .pattern(/\d/, 'digit')
  .messages({
    'string.pattern.name': '"password" must contain at least one {#name}',
  });

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(60).required(),
    email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254).required(),
    password: password.required(),
  }).custom((value, helpers) => {
    if (value.password.toLowerCase() === value.email.toLowerCase()) {
      return helpers.error('any.custom', { message: 'password must differ from email' });
    }
    return value;
  }, 'password != email'),
};

const login = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().required(),
  }),
};

const refresh = {
  body: Joi.object({ refreshToken: Joi.string().required() }),
};

const logout = {
  body: Joi.object({ refreshToken: Joi.string().required() }),
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: password.required(),
  }),
};

module.exports = { register, login, refresh, logout, changePassword };
