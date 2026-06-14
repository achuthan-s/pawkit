/**
 * Audience Resolution Service
 *
 * Resolves a customer audience from a structured IAudienceFilter.
 * Used by the campaign builder and the /api/segments/preview endpoint.
 */

import { Types } from "mongoose";
import { Customer, type CustomerSegment } from "../models/Customer";
import { User } from "../models/User";
import { Pet } from "../models/Pet";

export interface IAudienceFilter {
  segments?:           CustomerSegment[];
  tags?:               string[];            // any-match (OR)
  channelOptIn?:       "whatsapp" | "sms" | "email" | "rcs";
  minLtv?:             number;
  maxLtv?:             number;
  minOrderCount?:      number;
  maxDaysUntilRunout?: number;              // e.g. 14 → expiring within 14 days
  lastOrderDaysMax?:   number;              // e.g. 60 → ordered in last 60 days
  lastOrderDaysMin?:   number;             // e.g. 90 → not ordered in 90 days
  targetSpecies?:      string[];            // filter by pet species owned (dog, cat, bird…)
  excludeBlocked?:     boolean;
}

export interface IAudienceMember {
  customerId:   string;
  name:         string;
  email:        string;
  phone?:       string;
  segment:      CustomerSegment;
  ltv:          number;
  orderCount:   number;
  daysUntilRunout?: number;
  channelOptIns: {
    whatsapp: boolean;
    sms:      boolean;
    email:    boolean;
    rcs:      boolean;
  };
}

export interface IAudienceResult {
  total:    number;
  members:  IAudienceMember[];
  channelBreakdown: {
    whatsapp: number;
    sms:      number;
    email:    number;
    rcs:      number;
  };
}

const DAY_MS = 24 * 3600 * 1000;

export async function resolveAudience(filter: IAudienceFilter): Promise<IAudienceResult> {
  const query: Record<string, unknown> = {};

  if (filter.excludeBlocked !== false) query.isBlocked = { $ne: true };

  // Species filter: find customers who own a pet of the requested species
  if (filter.targetSpecies?.length) {
    const pets = await Pet.find({ species: { $in: filter.targetSpecies } })
      .select("customerId")
      .lean();
    const ownerIds = [...new Set(pets.map((p) => p.customerId.toString()))].map(
      (id) => new Types.ObjectId(id),
    );
    query._id = { $in: ownerIds };
  }

  if (filter.segments?.length) query.segment = { $in: filter.segments };

  if (filter.tags?.length) query.tags = { $in: filter.tags };

  if (filter.minLtv !== undefined || filter.maxLtv !== undefined) {
    query.ltv = {
      ...(filter.minLtv !== undefined ? { $gte: filter.minLtv } : {}),
      ...(filter.maxLtv !== undefined ? { $lte: filter.maxLtv } : {}),
    };
  }

  if (filter.minOrderCount !== undefined) {
    query.orderCount = { $gte: filter.minOrderCount };
  }

  if (filter.maxDaysUntilRunout !== undefined) {
    query.daysUntilRunout = { $lte: filter.maxDaysUntilRunout };
  }

  if (filter.lastOrderDaysMax !== undefined) {
    const cutoff = new Date(Date.now() - filter.lastOrderDaysMax * DAY_MS);
    query.lastOrderAt = { ...((query.lastOrderAt as object | undefined) ?? {}), $gte: cutoff };
  }

  if (filter.lastOrderDaysMin !== undefined) {
    const cutoff = new Date(Date.now() - filter.lastOrderDaysMin * DAY_MS);
    query.lastOrderAt = { ...((query.lastOrderAt as object | undefined) ?? {}), $lte: cutoff };
  }

  if (filter.channelOptIn) {
    query[`channelOptIns.${filter.channelOptIn}`] = true;
  }

  const customers = await Customer.find(query)
    .select("userId phone segment ltv orderCount daysUntilRunout channelOptIns")
    .lean();

  if (customers.length === 0) {
    return {
      total: 0,
      members: [],
      channelBreakdown: { whatsapp: 0, sms: 0, email: 0, rcs: 0 },
    };
  }

  const userIds = customers.map((c) => c.userId);
  const users   = await User.find({ _id: { $in: userIds } }).select("name email").lean();
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const members: IAudienceMember[] = customers.map((c) => {
    const user = userMap.get(c.userId.toString());
    return {
      customerId:   c._id.toString(),
      name:         user?.name  ?? "Unknown",
      email:        user?.email ?? "",
      phone:        c.phone,
      segment:      c.segment,
      ltv:          c.ltv,
      orderCount:   c.orderCount,
      daysUntilRunout: c.daysUntilRunout,
      channelOptIns: c.channelOptIns ?? { whatsapp: true, sms: true, email: true, rcs: true },
    };
  });

  const channelBreakdown = {
    whatsapp: members.filter((m) => m.channelOptIns.whatsapp).length,
    sms:      members.filter((m) => m.channelOptIns.sms).length,
    email:    members.filter((m) => m.channelOptIns.email).length,
    rcs:      members.filter((m) => m.channelOptIns.rcs).length,
  };

  return { total: members.length, members, channelBreakdown };
}
