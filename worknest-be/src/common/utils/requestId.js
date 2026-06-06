const crypto = require('crypto');

const HEADER = 'x-request-id';

const requestId = (req, res, next) => {
  const incoming = req.headers[HEADER];
  const id = incoming && typeof incoming === 'string' ? incoming : `req_${crypto.randomBytes(6).toString('hex')}`;
  req.id = id;
  res.setHeader(HEADER, id);
  next();
};

module.exports = requestId;
