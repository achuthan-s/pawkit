import { asyncHandler } from "../utils/asyncHandler";
import { z } from "zod";
import type { Response } from "express";
import { Campaign } from "../models/Campaign";
import { Communication } from "../models/Communication";
import { Customer } from "../models/Customer";
import { User } from "../models/User";
import type { AuthRequest } from "../middleware/auth";
import type { IAudienceFilter as ServiceAudienceFilter } from "../services/audience";
import { resolveAudience } from "../services/audience";
import { goalToCampaign } from "../services/aiService";
import axios from "axios";

const CreateCampaignSchema = z.object({
  name:            z.string().min(1).max(200).trim(),
  goal:            z.string().min(1).max(500).trim(),
  channel:         z.enum(["whatsapp", "sms", "email", "rcs"]),
  messageTemplate: z.string().min(1),
  frequencyCapDays: z.number().int().min(1).max(365).default(7),
  targetAudience:  z.object({
    segment:           z.string().optional(),
    minLtv:            z.number().optional(),
    maxDaysSinceOrder: z.number().optional(),
    maxDaysUntilRunout: z.number().optional(),
    tags:              z.array(z.string()).optional(),
    species:           z.array(z.string()).optional(),
  }).default({}),
  scheduledAt: z.string().datetime().optional(),
});

const SIMULATOR_URL = process.env.SIMULATOR_URL ?? "http://localhost:5001";
const DAY_MS = 24 * 3600 * 1000;

// ── AI campaign plan generation (kept for plan-preview UI) ────────────────────

export const generateCampaignPlan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { goal } = req.body as { goal?: string };
  if (!goal?.trim()) {
    res.status(400).json({ error: "goal is required" });
    return;
  }

  const proposal = await goalToCampaign(goal, "General PawKit customers");
  res.json({ data: proposal });
});

// ── CRUD ──────────────────────────────────────────────────────────────────────

// Build live stats from the Communication collection for one or many campaigns.
// This is authoritative — stored campaign.stats may lag if simulator webhooks are delayed.
async function liveStatsFor(campaignIds: unknown[]) {
  const agg = await Communication.aggregate([
    { $match: { campaignId: { $in: campaignIds } } },
    {
      $group: {
        _id:       "$campaignId",
        sent:      { $sum: 1 },
        delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered","opened","clicked","converted"]] }, 1, 0] } },
        opened:    { $sum: { $cond: [{ $in: ["$status", ["opened","clicked","converted"]]             }, 1, 0] } },
        clicked:   { $sum: { $cond: [{ $in: ["$status", ["clicked","converted"]]                      }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq:  ["$status", "converted"]                                 }, 1, 0] } },
        failed:    { $sum: { $cond: [{ $eq:  ["$status", "failed"]                                    }, 1, 0] } },
        bounced:   { $sum: { $cond: [{ $eq:  ["$status", "bounced"]                                   }, 1, 0] } },
        revenue:   { $sum: { $ifNull: ["$attributedRevenue", 0] } },
      },
    },
  ]);
  return new Map(agg.map((s) => [s._id.toString(), s]));
}

export const getCampaigns = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const campaigns = await Campaign.find()
    .populate("createdBy", "name email")
    .populate("approvedBy", "name email")
    .sort({ createdAt: -1 });

  const statsMap = await liveStatsFor(campaigns.map((c) => c._id));

  const data = campaigns.map((c) => {
    const obj  = c.toObject();
    const live = statsMap.get(c._id.toString());
    if (live) {
      obj.stats = {
        sent:      live.sent,
        delivered: live.delivered,
        opened:    live.opened,
        clicked:   live.clicked,
        converted: live.converted,
        failed:    live.failed,
        bounced:   live.bounced,
        revenue:   live.revenue,
      };
    }
    return obj;
  });

  res.json({ data });
});

export const getCampaign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const campaign = await Campaign.findById(req.params.id)
    .populate("createdBy", "name email")
    .populate("approvedBy", "name email");
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  const statsMap = await liveStatsFor([campaign._id]);
  const obj  = campaign.toObject();
  const live = statsMap.get(campaign._id.toString());
  if (live) {
    obj.stats = {
      sent:      live.sent,
      delivered: live.delivered,
      opened:    live.opened,
      clicked:   live.clicked,
      converted: live.converted,
      failed:    live.failed,
      bounced:   live.bounced,
      revenue:   live.revenue,
    };
  }

  res.json({ data: obj });
});

export const createCampaign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = CreateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const campaign = await Campaign.create({
    ...parsed.data,
    createdBy: req.user!.id,
    status: "draft",
  });
  res.status(201).json({ data: campaign });
});

export const updateCampaignStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status } = req.body as { status?: string };
  const campaign = await Campaign.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  );
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json({ data: campaign });
});

// ── Approve (operator only) ───────────────────────────────────────────────────

export const approveCampaign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  if (!["draft", "pending_approval"].includes(campaign.status)) {
    res.status(400).json({
      error: `Campaign cannot be approved from status "${campaign.status}"`,
    });
    return;
  }

  campaign.status     = "approved";
  campaign.approvedBy = req.user!.id as unknown as typeof campaign.approvedBy;
  campaign.approvedAt = new Date();
  await campaign.save();

  res.json({ data: campaign });
});

// ── Launch: batch dispatch with guardrails ────────────────────────────────────

interface ExclusionBreakdown {
  optedOut:        number;
  frequencyCapped: number;
}

interface DispatchResult {
  resolved:   number;
  dispatched: number;
  excluded:   number;
  breakdown:  ExclusionBreakdown;
  exclusions: Array<{ customerId: string; name: string; reason: string }>;
}

export const launchCampaign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  if (campaign.status !== "approved") {
    res.status(400).json({ error: "Campaign must be approved before launching" });
    return;
  }

  // ── 1. Resolve audience from campaign filter ────────────────────────────────
  const ta = campaign.targetAudience;
  const serviceFilter: ServiceAudienceFilter = {
    excludeBlocked: true,
    channelOptIn:   campaign.channel,
  };
  if (ta.segment) serviceFilter.segments = [ta.segment as ServiceAudienceFilter["segments"] extends Array<infer S> ? S : never];
  if (ta.minLtv)            serviceFilter.minLtv            = ta.minLtv;
  if (ta.maxDaysSinceOrder) serviceFilter.lastOrderDaysMin  = ta.maxDaysSinceOrder;
  if (ta.maxDaysUntilRunout) serviceFilter.maxDaysUntilRunout = ta.maxDaysUntilRunout;
  if (ta.tags?.length)      serviceFilter.tags              = ta.tags;

  const audience = await resolveAudience(serviceFilter);
  const resolved = audience.members.length;

  // ── 2. Frequency cap: per-channel — only block if same channel was sent recently ──
  const frequencyCapDays = campaign.frequencyCapDays ?? 7;
  const capCutoff = new Date(Date.now() - frequencyCapDays * DAY_MS);

  const customerIds = audience.members.map((m) => m.customerId);
  const recentComms = await Communication.find({
    customerId: { $in: customerIds },
    channel:    campaign.channel,      // per-channel: only this channel counts against the cap
    createdAt:  { $gte: capCutoff },
  })
    .select("customerId")
    .lean();

  const blockedByFreqCap = new Set(recentComms.map((c) => c.customerId.toString()));

  // ── 3. Per-member dispatch with structured exclusion tracking ─────────────
  const breakdown: ExclusionBreakdown = { optedOut: 0, frequencyCapped: 0 };
  const result: DispatchResult = { resolved, dispatched: 0, excluded: 0, breakdown, exclusions: [] };
  const sends: Promise<unknown>[] = [];

  for (const member of audience.members) {
    // Channel opt-out (double-check; resolveAudience already filtered but note if missed)
    const optIn = member.channelOptIns[campaign.channel];
    if (!optIn) {
      result.excluded++;
      breakdown.optedOut++;
      result.exclusions.push({
        customerId: member.customerId,
        name:       member.name,
        reason:     `opted out of ${campaign.channel}`,
      });
      continue;
    }

    // Per-channel frequency cap
    if (blockedByFreqCap.has(member.customerId)) {
      result.excluded++;
      breakdown.frequencyCapped++;
      result.exclusions.push({
        customerId: member.customerId,
        name:       member.name,
        reason:     `frequency cap: messaged on ${campaign.channel} within last ${frequencyCapDays} days`,
      });
      continue;
    }

    // Build recipient address
    const recipient = campaign.channel === "email" ? member.email : (member.phone ?? member.email);
    const message   = campaign.messageTemplate.replace(/\{\{name\}\}/g, member.name);

    const comm = await Communication.create({
      campaignId: campaign._id,
      customerId: member.customerId,
      channel:    campaign.channel,
      recipient,
      message,
      status: "queued",
    });

    sends.push(
      axios
        .post(`${SIMULATOR_URL}/api/simulator/send`, {
          channel:         campaign.channel,
          from:            "PawKit",
          to:              recipient,
          body:            message,
          communicationId: comm._id.toString(),
        })
        .catch((err) =>
          console.error(`[launch] simulator send failed for comm ${comm._id}:`, err)
        )
    );

    result.dispatched++;
  }

  await Promise.allSettled(sends);

  // Persist status + lastLaunch breakdown so the UI can explain 0-dispatch runs
  await Campaign.findByIdAndUpdate(campaign._id, {
    status:        "running",
    audienceCount: result.dispatched,
    lastLaunch: {
      resolved,
      sent:            result.dispatched,
      excluded: {
        optedOut:        breakdown.optedOut,
        frequencyCapped: breakdown.frequencyCapped,
      },
      launchedAt: new Date(),
    },
  });

  res.json({
    data:    result,
    message: `Campaign launched: ${result.dispatched} dispatched, ${result.excluded} excluded (${breakdown.optedOut} opted out, ${breakdown.frequencyCapped} frequency capped)`,
  });
});
