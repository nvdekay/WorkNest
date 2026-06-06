const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const env = require('../../config/env');
const ApiError = require('../errors/ApiError');

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const makeStorage = (subdir) => {
  const dest = ensureDir(path.join(env.UPLOAD_DIR, subdir));
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => {
      const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).slice(1) || 'bin';
      cb(null, `${crypto.randomBytes(16).toString('hex')}.${ext}`);
    },
  });
};

const allowMimes = (mimes) => (_req, file, cb) => {
  if (mimes.includes(file.mimetype)) return cb(null, true);
  cb(new ApiError('INVALID_FILE', `Unsupported mime type: ${file.mimetype}`));
};

// Wrap multer middleware để chuẩn hóa MulterError → ApiError(INVALID_FILE).
const wrap = (mw) => (req, res, next) => {
  mw(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds size limit' : err.message;
      return next(new ApiError('INVALID_FILE', message));
    }
    return next(err);
  });
};

const singleImage = (field, maxBytes, subdir) =>
  wrap(
    multer({
      storage: makeStorage(subdir),
      limits: { fileSize: maxBytes, files: 1 },
      fileFilter: allowMimes(IMAGE_MIMES),
    }).single(field)
  );

module.exports = {
  avatarUpload: singleImage('file', env.MAX_AVATAR_SIZE, 'avatars'),
  IMAGE_MIMES,
};
