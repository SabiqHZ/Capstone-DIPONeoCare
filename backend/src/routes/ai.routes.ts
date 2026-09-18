import { Router } from 'express';
import { aiController } from '../controllers/ai.controller';

const router = Router();

// Endpoint yang dipanggil AI server setelah inferensi aktivitas selesai.
router.post('/result/activity', aiController.receiveActivityResult);

export default router;
