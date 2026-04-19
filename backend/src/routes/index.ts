import { Router } from 'express';
import authRoutes from './auth.routes';
import babyRoutes from './baby.routes';
import reportRoutes from './report.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/babies', babyRoutes);
router.use('/report', reportRoutes);
router.use('/notifications', notificationRoutes);

export default router;