const mongoose = require('mongoose');
const { TASK_STATUS_VALUES, DEFAULT_PROJECT_STATUSES } = require('../../common/constants');

const statusEntrySchema = new mongoose.Schema(
  {
    key: { type: String, enum: TASK_STATUS_VALUES, required: true },
    label: { type: String, required: true, minlength: 1, maxlength: 30 },
    order: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, default: null, maxlength: 1000 },
    key: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      match: /^[A-Z0-9]{2,6}$/,
      immutable: true,
    },
    color: { type: String, default: null, match: /^#[0-9A-Fa-f]{6}$/ },
    statuses: { type: [statusEntrySchema], default: () => DEFAULT_PROJECT_STATUSES.slice() },
    taskCounter: { type: Number, default: 0, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

projectSchema.path('statuses').validate((arr) => Array.isArray(arr) && arr.length === 4, 'statuses must contain exactly 4 entries');

projectSchema.index({ workspaceId: 1, deletedAt: 1 });
projectSchema.index({ workspaceId: 1, key: 1 }, { unique: true, name: 'uniq_ws_key' });
projectSchema.index({ workspaceId: 1, archivedAt: 1 });

module.exports = mongoose.model('Project', projectSchema);
