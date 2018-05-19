import {Router} from 'express';
import { eventController } from '../controllers/event.controller';

const config = require('../../../tradejs.config.js');

const router = Router();

/**
 * Single
 */
router.get('/:id', function (req: any, res, next) {

});

/**
 * List
 */
router.get('/', async (req: any, res, next) => {
	try {
		res.send(await eventController.findMany(req.user, req.query));
	} catch (error) {
		next(error);
	}
});

/**
 * Create
 */
router.post('/', async (req: any, res, next) => {
	try {
		res.send(await eventController.create(req.user, req.body));
	} catch (error) {
		next(error);
	}
});

/**
 * Delete
 */
router.delete('/:id', async (req: any, res, next) => {
	try {
		res.send(await eventController.remove(req.user, req.params.id));
	} catch (error) {
		next(error);
	}
});


export = router;