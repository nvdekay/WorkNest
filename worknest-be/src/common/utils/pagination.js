const { LIMITS } = require('../constants');

const parsePagination = (query = {}) => {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isFinite(page) || page < 1) page = LIMITS.PAGE_DEFAULT;
  if (!Number.isFinite(limit) || limit < 1) limit = LIMITS.LIMIT_DEFAULT;
  if (limit > LIMITS.LIMIT_MAX) limit = LIMITS.LIMIT_MAX;
  return { page, limit, skip: (page - 1) * limit };
};

const buildMeta = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

const parseSort = (raw, whitelist) => {
  if (!raw || typeof raw !== 'string') return {};
  const allow = new Set(whitelist);
  const out = {};
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const desc = part.startsWith('-');
    const field = desc ? part.slice(1) : part;
    if (allow.has(field)) out[field] = desc ? -1 : 1;
  }
  return out;
};

module.exports = { parsePagination, buildMeta, parseSort };
