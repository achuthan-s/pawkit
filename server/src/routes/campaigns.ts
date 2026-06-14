import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getCampaigns,
  getCampaign,
  createCampaign,
  updateCampaignStatus,
  approveCampaign,
  launchCampaign,
  generateCampaignPlan,
} from "../controllers/campaignController";

const router = Router();

router.use(authenticate, authorize("marketer", "operator"));

router.post("/generate", generateCampaignPlan);
router.get("/", getCampaigns);
router.get("/:id", getCampaign);
router.post("/", createCampaign);
router.patch("/:id/status", updateCampaignStatus);
router.post("/:id/approve", authorize("operator"), approveCampaign);
router.post("/:id/launch", launchCampaign);

export default router;
