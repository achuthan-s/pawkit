import { asyncHandler } from "../utils/asyncHandler";
import { Types } from "mongoose";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { recomputeAll, recomputeForCustomer } from "../services/reorderClock";

export const triggerRecomputeClock = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const start  = Date.now();
  const result = await recomputeAll();
  res.json({
    data: {
      ...result,
      durationMs: Date.now() - start,
      ranAt: new Date().toISOString(),
    },
  });
});

export const triggerRecomputeForCustomer = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customerId = req.params["customerId"] as string;

  if (!Types.ObjectId.isValid(customerId)) {
    res.status(400).json({ error: "Invalid customer ID" });
    return;
  }

  const start = Date.now();
  try {
    await recomputeForCustomer(customerId);
    res.json({
      data: { processed: 1, errors: 0, durationMs: Date.now() - start, ranAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[jobs] recompute for customer failed:", err);
    res.json({
      data: { processed: 0, errors: 1, durationMs: Date.now() - start, ranAt: new Date().toISOString() },
    });
  }
});
