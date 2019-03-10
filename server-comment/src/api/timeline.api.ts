import { Router } from 'express';
import { timelineController } from '../controllers/timeline.controller';

const router = Router();

/**
 * Single
 */
router.get('/', async (req: any, res, next) => {
    try {
        console.log('sadfsadf')
        res.send(await timelineController.get(req.user, req.query))
    } catch (error) {
        next(error);
    }
});

export = router;