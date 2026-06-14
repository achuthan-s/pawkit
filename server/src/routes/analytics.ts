import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getOverview,
  getRevenueTimeline,
  getCampaignPerformance,
  getChannelBreakdown,
  getSummary,
  getFunnelStats,
} from "../controllers/analyticsController";

const router = Router();

router.use(authenticate, authorize("marketer", "operator"));

router.get("/summary", getSummary);
router.get("/overview", getOverview);
router.get("/funnel", getFunnelStats);
router.get("/revenue", getRevenueTimeline);
router.get("/campaigns", getCampaignPerformance);
router.get("/channels", getChannelBreakdown);

export default router;
