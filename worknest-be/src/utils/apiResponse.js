const success = (res, data = null, message = 'OK', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data });

const created = (res, data = null, message = 'Created') =>
  success(res, data, message, 201);

module.exports = { success, created };
