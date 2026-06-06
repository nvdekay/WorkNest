const mongoose = require('mongoose');
const {
  INVITATION_ROLE_VALUES,
  INVITATION_STATUS_VALUES,
  INVITATION_STATUS,
} = require('../../common/constants');

const invitationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    role: { type: String, enum: INVITATION_ROLE_VALUES, required: true },
    token: { type: String, required: true, unique: true, select: false },
    status: {
      type: String,
      enum: INVITATION_STATUS_VALUES,
      default: INVITATION_STATUS.PENDING,
      required: true,
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

invitationSchema.index({ token: 1 }, { unique: true, name: 'uniq_token' });
invitationSchema.index({ workspaceId: 1, email: 1, status: 1 });
invitationSchema.index({ expiresAt: 1 });

invitationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.token;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Invitation', invitationSchema);
