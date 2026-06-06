// Xóa cứng dữ liệu đã xóa mềm sau khoảng ân hạn (vd 30 ngày).
// Thu hồi attachments mồ côi.

const GRACE_DAYS = 30;

const run = async () => {
  // TODO: Workspace/Project/Task/Comment.deleteMany({ deletedAt: { $lt: cutoff } })
  // TODO: cleanup orphan files trong UPLOAD_DIR / S3
};

module.exports = { run, schedule: '0 3 * * *', GRACE_DAYS }; // 03:00 mỗi ngày
