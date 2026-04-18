import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

router.post('/nurse', authController.loginNurse);
router.post('/parent', authController.loginWithCode);

export default router;