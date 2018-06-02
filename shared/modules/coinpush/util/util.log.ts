import * as win		from 'winston';
import * as path	from 'path';
import * as fs		from 'fs';
import * as mkdirp	from 'mkdirp';

const
	PATH_SERVER_LOG = path.join(path.dirname(require.main.filename), '_log'),
	PATH_SERVER_LOG_FILE = path.join(PATH_SERVER_LOG, 'server.txt'),
	OWNER_MIN_LENGTH = 20;

if (!fs.existsSync(PATH_SERVER_LOG)) {
	mkdirp.sync(PATH_SERVER_LOG);
}

function ensureStringLength(str) {
	while(str.length < OWNER_MIN_LENGTH) {
		str += ' ';
	}
	return str;
}

const logger = new win.Logger({
	transports: [
		new win.transports.File({
			level: 'info',
			filename: PATH_SERVER_LOG_FILE,
			json: false,
			maxsize: 10242880, // 10MB
			maxFiles: 1
		}).on('error', function(err) {
			console.error(err.stack);
		}),
		new win.transports.Console({
			level: 'debug',
			json: false,
			colorize: 'all'
		})
	],
	exitOnError: false
});

export const log = {
	info(owner, ...params) {
		logger.info(ensureStringLength(owner) + ' : ', ...params);
	},

	warn(owner, ...params) {
		logger.warn(ensureStringLength(owner) + ' : ', ...params);
	},

	error(owner, ...params) {
		logger.error(ensureStringLength(owner) + ' : ', ...params);
	}
};