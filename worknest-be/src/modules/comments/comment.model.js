const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, minlength: 1, maxlength: 5000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    mentions: { type: [mongoose.Schema.Types.ObjectId], default: [], ref: 'User' },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

commentSchema.index({ taskId: 1, parentId: 1, createdAt: 1 });
commentSchema.index({ workspaceId: 1, authorId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
