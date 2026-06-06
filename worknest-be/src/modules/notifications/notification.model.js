const mongoose = require('mongoose');
const {
  NOTIFICATION_TYPE_VALUES,
  ENTITY_TYPE_VALUES,
} = require('../../common/constants');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    type: { type: String, enum: NOTIFICATION_TYPE_VALUES, required: true },
    title: { type: String, required: true },
    body: { type: String, default: null },
    entityType: { type: String, enum: ENTITY_TYPE_VALUES, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    read: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
