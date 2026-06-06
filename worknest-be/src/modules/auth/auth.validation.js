const Joi = require('joi');

const password = Joi.string().min(8).max(72).pattern(/[A-Za-z]/, 'letter').pattern(/\d/, 'digit');

const register = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(60).required(),
    email: Joi.string().email().lowercase().max(254).required(),
    password: password.required(),
  }),
};

const login = {
  body: Joi.object({
    email: Joi.string().email().lowercase().required(),
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
