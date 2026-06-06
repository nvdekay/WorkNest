const Joi = require('joi');
const { TASK_STATUS_VALUES, PRIORITY_VALUES } = require('../../common/constants');

const labelSchema = Joi.object({
  name: Joi.string().min(1).max(20).required(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).required(),
});

const create = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(200).required(),
    description: Joi.string().max(10_000).allow(null, ''),
    status: Joi.string().valid(...TASK_STATUS_VALUES),
    priority: Joi.string().valid(...PRIORITY_VALUES),
    assigneeId: Joi.string().hex().length(24).allow(null),
    dueDate: Joi.date().iso().allow(null),
    startDate: Joi.date().iso().allow(null),
    labels: Joi.array().items(labelSchema).max(10),
  }),
};

const update = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(200),
    description: Joi.string().max(10_000).allow(null, ''),
    status: Joi.string().valid(...TASK_STATUS_VALUES),
    position: Joi.number().min(0),
    priority: Joi.string().valid(...PRIORITY_VALUES),
    assigneeId: Joi.string().hex().length(24).allow(null),
    dueDate: Joi.date().iso().allow(null),
    startDate: Joi.date().iso().allow(null),
    labels: Joi.array().items(labelSchema).max(10),
  }).min(1),
};

const list = {
  query: Joi.object({
    view: Joi.string().valid('board', 'list').default('board'),
    status: Joi.string(),
    assignee: Joi.string(),
    priority: Joi.string(),
    label: Joi.string(),
    dueFrom: Joi.date().iso(),
    dueTo: Joi.date().iso(),
    overdue: Joi.string().valid('true', 'false'),
    search: Joi.string().trim().max(200),
    sort: Joi.string(),
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
  }),
};

const checklistCreate = {
  body: Joi.object({ text: Joi.string().min(1).max(200).required() }),
};
const checklistUpdate = {
  body: Joi.object({
    text: Joi.string().min(1).max(200),
    done: Joi.boolean(),
    order: Joi.number().integer().min(0),
  }).min(1),
};

module.exports = { create, update, list, checklistCreate, checklistUpdate };
