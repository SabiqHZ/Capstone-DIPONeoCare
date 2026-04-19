import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';

const router = Router();

// Endpoint yang dipanggil AI server setelah inferensi selesai
router.post('/result/sleep', aiController.receiveSleepResult);
router.post('/result/crying', aiController.receiveCryingResult);

export default router;