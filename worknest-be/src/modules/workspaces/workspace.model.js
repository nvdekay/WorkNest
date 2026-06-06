const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    memberCanCreateProject: { type: Boolean, default: true },
    timezone: { type: String, default: 'UTC' },
  },
  { _id: false }
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, default: null, maxlength: 500 },
    avatarUrl: { type: String, default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    settings: { type: settingsSchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

workspaceSchema.index({ ownerId: 1 });
workspaceSchema.index({ deletedAt: 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
