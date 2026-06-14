import { asyncHandler } from "../utils/asyncHandler";
import type { Request, Response } from "express";
import { User } from "../models/User";
import { Order } from "../models/Order";
import { Campaign } from "../models/Campaign";
import { Communication } from "../models/Communication";

export const getOverview = asyncHandler(async (_req: Request, res: Response) => {
  const [totalCustomers, totalOrders, activeCampaigns, revenueAgg] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    Order.countDocuments(),
    Campaign.countDocuments({ status: { $in: ["approved", "running"] } }),
    Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  res.json({
    data: {
      totalCustomers,
      totalOrders,
      activeCampaigns,
      totalRevenue: revenueAgg[0]?.total ?? 0,
    },
  });
});

export const getRevenueTimeline = asyncHandler(async (_req: Request, res: Response) => {
  const data = await Order.aggregate([
    { $match: { status: { $ne: "cancelled" } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        revenue: { $sum: "$total" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 30 },
    { $project: { _id: 0, date: "$_id", revenue: 1, orders: 1 } },
  ]);
  res.json({ success: true, data });
});

export const getCampaignPerformance = asyncHandler(async (_req: Request, res: Response) => {
  const campaigns = await Campaign.find()
    .select("name channel stats status createdAt")
    .sort({ createdAt: -1 })
    .limit(20);

  const ids = campaigns.map((c) => c._id);
  const statsAgg = await Communication.aggregate([
    { $match: { campaignId: { $in: ids } } },
    {
      $group: {
        _id:       "$campaignId",
        sent:      { $sum: 1 },
        delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered","opened","clicked","converted"]] }, 1, 0] } },
        opened:    { $sum: { $cond: [{ $in: ["$status", ["opened","clicked","converted"]]             }, 1, 0] } },
        clicked:   { $sum: { $cond: [{ $in: ["$status", ["clicked","converted"]]                      }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq:  ["$status", "converted"]                                 }, 1, 0] } },
        revenue:   { $sum: { $ifNull: ["$attributedRevenue", 0] } },
      },
    },
  ]);
  const sm = new Map(statsAgg.map((s) => [s._id.toString(), s]));

  const data = campaigns.map((c) => {
    const obj  = c.toObject();
    const live = sm.get(c._id.toString());
    if (live) {
      obj.stats = {
        ...obj.stats,
        sent:      live.sent,
        delivered: live.delivered,
        opened:    live.opened,
        clicked:   live.clicked,
        converted: live.converted,
        revenue:   live.revenue,
      };
    }
    return obj;
  });

  res.json({ data });
});

export const getSummary = asyncHandler(async (_req: Request, res: Response) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const sixtyDaysAgo  = new Date(Date.now() - 60 * 24 * 3600 * 1000);

  const [totalRevenueAgg, activeCampaigns, captureAgg, prevCaptureAgg] = await Promise.all([
    Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Campaign.countDocuments({ status: { $in: ["approved", "running"] } }),
    // Current 30d: reorder capture rate = converted comms / total sent comms
    Communication.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: null,
        total:     { $sum: 1 },
        converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
      }},
    ]),
    // Previous 30d for MoM change
    Communication.aggregate([
      { $match: { createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
      { $group: {
        _id: null,
        total:     { $sum: 1 },
        converted: { $sum: { $cond: [{ $eq: ["$status", "converted"] }, 1, 0] } },
      }},
    ]),
  ]);

  const cur  = captureAgg[0]  ?? { total: 0, converted: 0 };
  const prev = prevCaptureAgg[0] ?? { total: 0, converted: 0 };

  const captureRate     = cur.total  > 0 ? Math.round((cur.converted  / cur.total)  * 100) : 0;
  const prevCaptureRate = prev.total > 0 ? Math.round((prev.converted / prev.total) * 100) : 0;
  const captureChange   = captureRate - prevCaptureRate;

  res.json({
    data: {
      revenue: totalRevenueAgg[0]?.total ?? 0,
      captureRate,
      captureChange,
      activeCampaigns,
    },
  });
});

export const getChannelBreakdown = asyncHandler(async (_req: Request, res: Response) => {
  const data = await Communication.aggregate([
    {
      $group: {
        _id:       "$channel",
        total:     { $sum: 1 },
        delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered","opened","clicked","converted"]] }, 1, 0] } },
        opened:    { $sum: { $cond: [{ $in: ["$status", ["opened","clicked","converted"]]             }, 1, 0] } },
        clicked:   { $sum: { $cond: [{ $in: ["$status", ["clicked","converted"]]                      }, 1, 0] } },
      },
    },
  ]);
  res.json({ success: true, data });
});

export const getFunnelStats = asyncHandler(async (_req: Request, res: Response) => {
  // Cumulative funnel: each stage includes all higher-rank statuses so the
  // funnel is monotonically decreasing (sent >= delivered >= opened >= clicked >= converted).
  const [commAgg] = await Communication.aggregate([
    {
      $group: {
        _id: null,
        sent:      { $sum: 1 },
        delivered: { $sum: { $cond: [{ $in: ["$status", ["delivered","opened","clicked","converted"]] }, 1, 0] } },
        read:      { $sum: { $cond: [{ $in: ["$status", ["opened","clicked","converted"]]             }, 1, 0] } },
        clicked:   { $sum: { $cond: [{ $in: ["$status", ["clicked","converted"]]                      }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq:  ["$status", "converted"]                                 }, 1, 0] } },
      },
    },
  ]);

  const c = commAgg ?? { sent: 0, delivered: 0, read: 0, clicked: 0, converted: 0 };
  res.json({
    data: {
      sent:      c.sent,
      delivered: c.delivered,
      read:      c.read,
      clicked:   c.clicked,
      converted: c.converted,
    },
  });
});
