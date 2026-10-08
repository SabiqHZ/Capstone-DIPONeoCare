import { Router } from "express";
import multer from "multer";
import { deviceController } from "../controllers/device.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { deviceTokenMiddleware } from "../middleware/deviceToken.middleware";
import { requireRole } from "../middleware/role.middleware";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1_000_000 },
});

router.post("/register", deviceController.register);
router.post("/heartbeat", deviceTokenMiddleware, deviceController.heartbeat);
router.post(
  "/upload/frame",
  upload.single("image"),
  deviceTokenMiddleware,
  deviceController.uploadFrame,
);
router.post(
  "/upload/audio",
  upload.single("audio"),
  deviceTokenMiddleware,
  deviceController.uploadAudio,
);

router.get(
  "/available",
  authMiddleware,
  requireRole("nurse"),
  deviceController.available,
);

router.get("/:id/stream", deviceController.stream);
router.get("/:id/stream/frame", deviceController.streamFrame);
router.get("/:id/live/ingest", (req, res) => {
  res.status(426).json({
    success: false,
    error: "Endpoint ini menggunakan koneksi WebSocket, bukan HTTP GET",
  });
});

router.get(
  "/:id/config",
  authMiddleware,
  requireRole("nurse"),
  deviceController.getConfig,
);

router.patch(
  "/:id/config",
  authMiddleware,
  requireRole("nurse"),
  deviceController.updateConfig,
);
export default router;
