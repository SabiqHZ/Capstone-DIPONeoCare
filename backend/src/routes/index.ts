import { Router } from 'express';
import authRoutes from './auth.routes';
import babyRoutes from './baby.routes';
import reportRoutes from './report.routes';
import notificationRoutes from './notification.routes';
import aiRoutes from './ai.routes';
import deviceRoutes from './device.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/babies', babyRoutes);
router.use('/report', reportRoutes);
router.use('/notifications', notificationRoutes);
router.use('/ai', aiRoutes);
router.use('/devices', deviceRoutes);

export default router;
