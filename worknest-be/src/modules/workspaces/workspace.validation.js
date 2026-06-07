const Joi = require('joi');

const isIanaTimezone = (value, helpers) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return value;
  } catch (_err) {
    return helpers.error('any.invalid');
  }
};

const settingsSchema = Joi.object({
  memberCanCreateProject: Joi.boolean(),
  timezone: Joi.string().custom(isIanaTimezone, 'IANA timezone'),
}).min(1);

const create = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    description: Joi.string().max(500).allow(null, ''),
  }),
};

const update = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    description: Joi.string().max(500).allow(null, ''),
    avatarUrl: Joi.string().uri({ scheme: ['https'] }).allow(null),
    settings: settingsSchema,
  }).min(1),
};

const transferOwnership = {
  body: Joi.object({
    newOwnerId: Joi.string().hex().length(24).required(),
  }),
};

const list = {
  query: Joi.object({
    search: Joi.string().trim().max(80),
    sort: Joi.string(),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

module.exports = { create, update, transferOwnership, list };
