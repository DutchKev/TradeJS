import {cacheController} from '../controllers/cache.controller';

module.exports = (socket) => {
	socket.on('read', async (params, cb: Function) => {
		try {
			cb(null, await cacheController.find({id: null}, params));
		} catch (error) {
			console.error(error);
			cb(error);
		}
	});
};