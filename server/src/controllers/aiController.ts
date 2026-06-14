import { asyncHandler } from "../utils/asyncHandler";
import { z } from "zod";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { nlToAudienceFilter, goalToCampaign, draftMessage } from "../services/aiService";
import { resolveAudience } from "../services/audience";

// ── POST /api/ai/audience ─────────────────────────────────────────────────────
// Body: { prompt: string }
// Returns: { filter: IAudienceFilter, preview: IAudienceResult }

const AudienceBodySchema = z.object({
  prompt: z.string().min(3).max(500),
});

export const aiAudienceHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = AudienceBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const filter  = await nlToAudienceFilter(parsed.data.prompt);
  const preview = await resolveAudience({ ...filter, excludeBlocked: true });

  res.json({ data: { filter, preview } });
});

// ── POST /api/ai/campaign ─────────────────────────────────────────────────────
// Body: { goal: string, audienceSummary?: string }
// Returns: CampaignProposal

const CampaignBodySchema = z.object({
  goal:            z.string().min(3).max(500),
  audienceSummary: z.string().max(300).optional(),
});

export const aiCampaignHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = CampaignBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { goal, audienceSummary = "General PawKit customers" } = parsed.data;
  const proposal = await goalToCampaign(goal, audienceSummary);

  res.json({ data: proposal });
});

// ── POST /api/ai/message ──────────────────────────────────────────────────────
// Body: { channel: string, goal: string, audienceSummary?: string }
// Returns: MessageTemplate

const MessageBodySchema = z.object({
  channel:         z.enum(["whatsapp", "sms", "email", "rcs"]),
  goal:            z.string().min(3).max(500),
  audienceSummary: z.string().max(300).optional(),
});

export const aiMessageHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = MessageBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { channel, goal, audienceSummary } = parsed.data;
  const template = await draftMessage(channel, goal, audienceSummary);

  res.json({ data: template });
});
