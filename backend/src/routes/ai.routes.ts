import { Router } from "express";
import { aiController } from "../controllers/ai.controller";

const router = Router();

router.post("/results/vision", aiController.receiveVisionResult);
router.post("/results/audio", aiController.receiveAudioResults);

export default router;
