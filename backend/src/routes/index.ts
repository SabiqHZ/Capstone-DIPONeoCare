import { Router } from 'express';
import authRoutes from './auth.routes';
import babyRoutes from './baby.routes';
import reportRoutes from './report.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/babies', babyRoutes);
router.use('/report', reportRoutes);

export default router;