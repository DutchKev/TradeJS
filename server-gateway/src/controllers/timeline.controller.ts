import * as request from 'request-promise';

const config = require('../../../coinpush.config.js');

export const timelineController = {

	async get(reqUser, params?): Promise<any> {
		return request({
			uri: config.server.comment.apiUrl + '/timeline',
			headers: { _id: reqUser.id },
			qs: params,
			json: true
		});
	}
};