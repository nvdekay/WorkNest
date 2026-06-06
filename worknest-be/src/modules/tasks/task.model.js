const mongoose = require('mongoose');
const {
  TASK_STATUS_VALUES,
  TASK_STATUS,
  PRIORITY_VALUES,
  PRIORITY,
  LIMITS,
} = require('../../common/constants');

const labelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, minlength: 1, maxlength: 20 },
    color: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
  },
  { _id: false }
);

const checklistItemSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, minlength: 1, maxlength: 200 },
    done: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileSize: { type: Number, required: true, max: 10 * 1024 * 1024 },
    mimeType: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    taskCode: { type: String, required: true, immutable: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    description: { type: String, default: null, maxlength: 10_000 },
    status: { type: String, enum: TASK_STATUS_VALUES, default: TASK_STATUS.TODO, required: true },
    priority: { type: String, enum: PRIORITY_VALUES, default: PRIORITY.MEDIUM, required: true },
    position: { type: Number, default: 0, min: 0 },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, default: null },
    startDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    labels: {
      type: [labelSchema],
      default: [],
      validate: (v) => v.length <= LIMITS.TASK_LABELS_MAX,
    },
    checklist: {
      type: [checklistItemSchema],
      default: [],
      validate: (v) => v.length <= LIMITS.CHECKLIST_MAX,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: (v) => v.length <= LIMITS.ATTACHMENTS_MAX,
    },
    watchers: { type: [mongoose.Schema.Types.ObjectId], default: [], ref: 'User' },
    commentCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.index({ projectId: 1, status: 1, position: 1 });
taskSchema.index({ workspaceId: 1, assignee: 1 });
taskSchema.index({ workspaceId: 1, dueDate: 1 });
taskSchema.index({ taskCode: 1 });
taskSchema.index({ title: 'text', description: 'text' });

// `isOverdue` là virtual — không lưu (xem spec §7.A).
taskSchema.virtual('isOverdue').get(function () {
  return !!(this.dueDate && this.dueDate < new Date() && this.status !== TASK_STATUS.DONE);
});

taskSchema.set('toJSON', { virtuals: true });
taskSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Task', taskSchema);
