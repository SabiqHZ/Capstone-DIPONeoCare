import { Router } from 'express';
import { babyController } from '../controllers/baby.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { babyService } from '../services/baby.service';

const router = Router();

router.use(authMiddleware);

// Nurse only
router.get('/', requireRole('nurse'), babyController.getBabies);
router.post('/', requireRole('nurse'), babyController.registerBaby);
router.post('/pair', requireRole('nurse'), babyController.pairDevice);

// Nurse & Parent
router.get('/:id', requireRole('nurse', 'parent'), babyController.getBabyById);

// Tambah route baru
router.get('/:id/stream-url', requireRole('nurse', 'parent'), async (req, res) => {
  try {
    const streamUrl = await babyService.getBabyStreamUrl(req.params.id as string);
    res.json({ success: true, data: { streamUrl } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
export default router;