import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/:babyId', requireRole('nurse', 'parent'), reportController.getDailyReport);
router.get('/:babyId/list', requireRole('nurse', 'parent'), reportController.getReportList);

export default router;