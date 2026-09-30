import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { alertController } from "../controllers/alert.controller";
import { requireRole } from "../middleware/role.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/", requireRole("nurse", "parent"), alertController.getAll);

router.patch(
  "/:id/acknowledge",
  requireRole("nurse", "parent"),
  alertController.acknowledge,
);

export default router;
