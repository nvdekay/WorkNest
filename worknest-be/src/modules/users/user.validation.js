const Joi = require('joi');

const updateMe = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(60),
    avatarUrl: Joi.string().uri({ scheme: ['https'] }).allow(null),
  }).min(1),
};

module.exports = { updateMe };
