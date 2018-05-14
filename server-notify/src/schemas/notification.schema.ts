import { Schema, model } from 'mongoose';
import * as beautifyUnique from 'mongoose-beautiful-unique-validation';

export const NotificationSchema = new Schema({
    toUserId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    fromUserId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    type: {
        type: String,
        required: true
    },
    data: {
        type: Schema.Types.Mixed
    },
    sendDate: {
        type: Date
    },
    isRead: {
        type: Boolean,
        default: false
    },
    readDate: {
        type: Date
    }
}, {
	timestamps: true
});

NotificationSchema.plugin(beautifyUnique);

export const Notification = model('Notification', NotificationSchema, 'notifications');