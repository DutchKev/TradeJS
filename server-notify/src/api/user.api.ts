import {Router} from 'express';
import {userController} from '../controllers/user.controller';
import { G_ERROR_DUPLICATE_FIELD } from 'coinpush/src/constant';
import { MONGO_ERROR_VALIDATION } from '../../node_modules/coinpush/src/constant';

const router = Router();

/**
 * single
 */
router.get('/:id', async (req: any, res, next) => {
	try {
		res.send(await userController.findById(req.user, req.params.id));
	} catch (error) {
		next(error);
	}
});

/**
 * list
 */
router.get('/', async (req: any, res, next) => {
	try {
		res.send(await userController.findMany(req.user, req.query));
	} catch (error) {
		next(error);
	}
});

/**
 * create
 */
router.post('/', async (req: any, res, next) => {
	try {
		console.log('create user');
		res.send(await userController.create(req.user, req.body, req.query));
	} catch (error) {
		if (error) {
			if (error.name === MONGO_ERROR_VALIDATION) {
				res.status(409).send({ code: G_ERROR_DUPLICATE_FIELD, field: Object.keys(error.errors)[0] });
				return;
			}
		}
		next(error);
	}
});

/**
 * update
 */
router.put('/:id', async (req: any, res, next) => {
	try {
		res.send(await userController.update(req.user, req.params.id, req.body));
	} catch (error) {
		next(error);
	}
});

/**
 * delete
 */
router.delete('/:id', async (req: any, res, next) => {
	console.log('EMAIL USER DELETE');
	try {
		res.send(await userController.remove(req.user, req.params.id));
	} catch (error) {
		next(error)
	}
});

export = router;