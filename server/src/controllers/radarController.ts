import { asyncHandler } from "../utils/asyncHandler";
/**
 * Reorder Radar — autonomous scan that groups customers by signal strength
 * and auto-creates pending_approval campaigns for each group.
 *
 * POST /api/ai/radar/scan
 */

import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { Customer } from "../models/Customer";
import { Campaign } from "../models/Campaign";
import { goalToCampaign } from "../services/aiService";
import { User } from "../models/User";

interface RadarGroup {
  signal:   string;
  label:    string;
  count:    number;
  segment?: string;
  maxDaysUntilRunout?: number;
}

interface RadarResult {
  scannedAt:        string;
  groups:           RadarGroup[];
  campaignsCreated: number;
  campaignIds:      string[];
}

// ── Signal groups ─────────────────────────────────────────────────────────────

const RADAR_SIGNALS: Array<{
  signal: string;
  label:  string;
  filter: Record<string, unknown>;
  goal:   string;
  audienceSummary: string;
  segment?: string;
  maxDaysUntilRunout?: number;
}> = [
  {
    signal: "runout_imminent",
    label:  "Runout in ≤7 days",
    filter: { daysUntilRunout: { $gte: 0, $lte: 7 }, isBlocked: { $ne: true } },
    goal:   "Remind customers whose pet food is running out in 7 days to reorder",
    audienceSummary: "Customers with pet food running out in 7 days or less",
    maxDaysUntilRunout: 7,
  },
  {
    signal: "runout_overdue",
    label:  "Runout overdue (already out)",
    filter: { daysUntilRunout: { $lt: 0 }, isBlocked: { $ne: true } },
    goal:   "Win back customers whose pet food is already overdue for reordering",
    audienceSummary: "Customers whose estimated food supply is already depleted",
    maxDaysUntilRunout: -1,
  },
  {
    signal: "at_risk",
    label:  "At-risk (inactive 45–90 days)",
    filter: { segment: "at-risk", isBlocked: { $ne: true } },
    goal:   "Re-engage at-risk customers who haven't ordered in 45–90 days",
    audienceSummary: "At-risk customers, last ordered 45–90 days ago",
    segment: "at-risk",
  },
  {
    signal: "inactive",
    label:  "Inactive (90+ days)",
    filter: { segment: "inactive", isBlocked: { $ne: true } },
    goal:   "Win back inactive customers with a special comeback offer",
    audienceSummary: "Inactive customers, no order in 90+ days",
    segment: "inactive",
  },
  {
    signal: "high_ltv_runout",
    label:  "High-LTV running low",
    filter: {
      segment:        "high-ltv",
      daysUntilRunout: { $lte: 14 },
      isBlocked:       { $ne: true },
    },
    goal:   "Proactively remind high-value customers to reorder before running out",
    audienceSummary: "High-LTV customers with food expiring within 14 days",
    segment: "high-ltv",
    maxDaysUntilRunout: 14,
  },
];

// ── Main scan handler ─────────────────────────────────────────────────────────

export const radarScan = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result: RadarResult = {
    scannedAt:        new Date().toISOString(),
    groups:           [],
    campaignsCreated: 0,
    campaignIds:      [],
  };

  // Find the system operator user to use as campaign creator
  const systemUser = await User.findOne({ role: "operator" }).lean();
  const creatorId  = systemUser?._id ?? req.user!.id;

  for (const sig of RADAR_SIGNALS) {
    const count = await Customer.countDocuments(sig.filter);
    const group: RadarGroup = {
      signal:  sig.signal,
      label:   sig.label,
      count,
      segment: sig.segment,
      maxDaysUntilRunout: sig.maxDaysUntilRunout,
    };
    result.groups.push(group);

    if (count === 0) continue;

    // Check if a pending_approval campaign for this signal already exists (created today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const existing = await Campaign.findOne({
      status:    "pending_approval",
      goal:      { $regex: sig.signal, $options: "i" },
      createdAt: { $gte: todayStart },
    }).lean();

    if (existing) continue; // already created today — skip

    // Generate a campaign proposal via AI (with fallback)
    const proposal = await goalToCampaign(
      sig.goal,
      `${sig.audienceSummary} (${count} customers)`,
    );

    // Build targetAudience from signal
    const targetAudience: Record<string, unknown> = {};
    if (sig.segment) targetAudience.segment = sig.segment;
    if (sig.maxDaysUntilRunout !== undefined)
      targetAudience.maxDaysUntilRunout = sig.maxDaysUntilRunout;

    const campaign = await Campaign.create({
      name:            `[Radar] ${sig.label}`,
      goal:            `${sig.goal} [radar:${sig.signal}]`,
      channel:         proposal.channel,
      messageTemplate: proposal.messageTemplate,
      targetAudience,
      audienceCount:   count,
      frequencyCapDays: 7,
      status:          "pending_approval",
      createdBy:       creatorId,
    });

    result.campaignsCreated++;
    result.campaignIds.push(campaign._id.toString());
  }

  res.json({ data: result });
});
