import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.post('/nurse', authController.loginNurse);
router.post('/parent', authController.loginWithCode);
router.get('/nurse/profile', authMiddleware, requireRole('nurse'), authController.getNurseProfile);
router.patch('/nurse/password', authMiddleware, requireRole('nurse'), authController.changeNursePassword);

export default router;
