const ERROR_CODES = require('./errorCodes');

class ApiError extends Error {
  constructor(code, message, details, statusOverride) {
    const meta = ERROR_CODES[code] || ERROR_CODES.INTERNAL_ERROR;
    super(message || meta.message);
    this.code = code in ERROR_CODES ? code : 'INTERNAL_ERROR';
    this.status = statusOverride || meta.status;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static from(code, details) {
    return new ApiError(code, undefined, details);
  }
}

module.exports = ApiError;
