import { Router } from 'express';
import multer from 'multer';
import { deviceController } from '../controllers/device.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { deviceTokenMiddleware } from '../middleware/deviceToken.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1_000_000 } });

router.post('/register', deviceController.register);
router.post('/heartbeat', deviceTokenMiddleware, deviceController.heartbeat);
router.post('/upload/frame', upload.single('image'), deviceTokenMiddleware, deviceController.uploadFrame);
router.post('/upload/audio', upload.single('audio'), deviceTokenMiddleware, deviceController.uploadAudio);

router.get('/available', authMiddleware, requireRole('nurse'), deviceController.available);
router.patch('/:id/config', authMiddleware, requireRole('nurse'), deviceController.updateConfig);

export default router;
