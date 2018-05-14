import {Schema, model} from 'mongoose';

export const StatusSchema = new Schema({
	symbol: {
		type: String,
		required: true
	},
	lastSync: {
		type: Date,
		required: true
	},
	lastPrice: {
		type: Number,
		required: true
	}
}, {
	timestamps: true
});

export const Status = model('__status', StatusSchema);