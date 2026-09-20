import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';
import { apiKeyMiddleware } from '../middleware/apiKey.middleware';

const router = Router();

router.use(apiKeyMiddleware);

router.post('/results/vision', aiController.receiveVisionResult);
router.post('/results/audio', aiController.receiveAudioResults);

export default router;
