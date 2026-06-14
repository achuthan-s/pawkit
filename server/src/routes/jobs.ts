import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { triggerRecomputeClock, triggerRecomputeForCustomer } from "../controllers/jobsController";

const router = Router();

router.use(authenticate, authorize("marketer", "operator"));

router.post("/recompute-clock", triggerRecomputeClock);
router.post("/recompute-clock/:customerId", triggerRecomputeForCustomer);

export default router;
