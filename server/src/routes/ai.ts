import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  aiAudienceHandler,
  aiCampaignHandler,
  aiMessageHandler,
} from "../controllers/aiController";
import { radarScan } from "../controllers/radarController";

const router = Router();

router.use(authenticate, authorize("marketer", "operator"));

router.post("/audience",    aiAudienceHandler);
router.post("/campaign",    aiCampaignHandler);
router.post("/message",     aiMessageHandler);
router.post("/radar/scan",  radarScan);

export default router;
