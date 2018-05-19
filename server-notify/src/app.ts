import * as express from 'express';
import * as helmet from 'helmet';
import * as morgan from 'morgan';
import * as mongoose from 'mongoose';
import { json, urlencoded } from 'body-parser';
import { notifyController } from './controllers/notify.controller';
import { subClient } from 'coinpush/redis';

const config = require('../../tradejs.config.js');
const app = express();
app.listen(config.server.notify.port, '0.0.0.0', () => console.log(`\n Notify service started on      : 0.0.0.0:${config.server.notify.port}`));

/**
 * mongo
 */
// mongoose.set('debug', true);
(<any>mongoose).Promise = global.Promise;
mongoose.connection.on('error', console.error.bind(console, 'connection error:'));
mongoose.connection.once('open', function () {
	console.log('DB connected');
});
mongoose.connect(config.server.notify.connectionString);

/**
 * express
 */
app.use(morgan('dev'));
app.use(helmet());
app.use(json());
app.use(urlencoded({ extended: false }));
app.use((req, res, next) => {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Headers', '_id, Authorization, Origin, X-Requested-With, Content-Type, Accept');
	next();
});

/**
 * Add 'user' variable to request, holding userID
 */
app.use((req: any, res, next) => {
	req.user = { id: req.headers['_id'] };
	next();
});

app.use('/notify', require('./api/notify.api'));
app.use('/mail', require('./api/email.api'));
app.use('/user', require('./api/user.api'));
app.use('/device', require('./api/device.api'));

app.use((error, req, res, next) => {
	console.log('asdfsdfasdfasdfasdfasdf', error);

	if (res.headersSent)
		return next(error);

	if (error && error.statusCode === 401)
		return res.send(401);

	res.status(500).send({ error });
});

subClient.subscribe("notify");
subClient.on("message", function (channel, message) {

	try {
		switch (channel) {
			case 'notify':
				notifyController.parse(JSON.parse(message));
				break;
		}
	} catch (error) {
		return console.error(error);
	}
});