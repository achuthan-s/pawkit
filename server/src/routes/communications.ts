import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { handleWebhook, getCommunications } from "../controllers/communicationController";

const router = Router();

// Webhook from channel simulator — no auth (uses a shared secret in prod)
router.post("/webhook", handleWebhook);

// Internal query
router.get("/", authenticate, authorize("marketer", "operator"), getCommunications);

export default router;
