const mongoose = require('mongoose');
const { ACTIVITY_TYPE_VALUES } = require('../../common/constants');

// Append-only: chỉ có createdAt, không có updatedAt.
const activitySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ACTIVITY_TYPE_VALUES, required: true },
    entityLabel: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activitySchema.index({ workspaceId: 1, createdAt: -1 });
activitySchema.index({ projectId: 1, createdAt: -1 });
activitySchema.index({ taskId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
