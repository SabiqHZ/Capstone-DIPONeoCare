import { Router } from 'express';
import { babyController } from '../controllers/baby.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.use(authMiddleware);

// Nurse only
router.get('/', requireRole('nurse'), babyController.getBabies);
router.post('/', requireRole('nurse'), babyController.registerBaby);
router.post('/pair', requireRole('nurse'), babyController.pairDevice);

// Nurse & Parent
router.get('/:id', requireRole('nurse', 'parent'), babyController.getBabyById);

export default router;