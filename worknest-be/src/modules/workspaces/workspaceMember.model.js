const mongoose = require('mongoose');
const { ROLE_VALUES, MEMBER_STATUS_VALUES, MEMBER_STATUS } = require('../../common/constants');

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ROLE_VALUES, required: true },
    status: { type: String, enum: MEMBER_STATUS_VALUES, default: MEMBER_STATUS.ACTIVE, required: true },
    joinedAt: { type: Date, default: () => new Date(), required: true },
  },
  { timestamps: true }
);

workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true, name: 'uniq_ws_user' });
workspaceMemberSchema.index({ userId: 1, status: 1 });
workspaceMemberSchema.index({ workspaceId: 1, role: 1 });

module.exports = mongoose.model('WorkspaceMember', workspaceMemberSchema);
