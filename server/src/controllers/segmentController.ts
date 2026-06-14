import { asyncHandler } from "../utils/asyncHandler";
import { Types } from "mongoose";
import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth";
import { resolveAudience, type IAudienceFilter } from "../services/audience";
import { SavedSegment } from "../models/SavedSegment";

// ── helpers ───────────────────────────────────────────────────────────────────

function toArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

// ── Preview ───────────────────────────────────────────────────────────────────

export const previewSegment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | string[] | undefined>;

  const filter: IAudienceFilter = {};

  // Accept both `segments=a&segments=b` (Axios default) and `segments[]=a` (URLSearchParams)
  const segRaw = q["segments"] ?? q["segments[]"];
  const segs   = toArray(segRaw);
  if (segs.length) filter.segments = segs as IAudienceFilter["segments"];

  const tagRaw = q["tags"] ?? q["tags[]"];
  const tags   = toArray(tagRaw);
  if (tags.length) filter.tags = tags;

  const speciesRaw = q["targetSpecies"] ?? q["targetSpecies[]"];
  const species    = toArray(speciesRaw);
  if (species.length) filter.targetSpecies = species;

  const { channelOptIn, minLtv, maxLtv, minOrderCount,
    maxDaysUntilRunout, lastOrderDaysMax, lastOrderDaysMin } = q;

  if (channelOptIn && ["whatsapp","sms","email","rcs"].includes(channelOptIn as string)) {
    filter.channelOptIn = channelOptIn as IAudienceFilter["channelOptIn"];
  }
  if (minLtv            !== undefined) filter.minLtv            = Number(minLtv);
  if (maxLtv            !== undefined) filter.maxLtv            = Number(maxLtv);
  if (minOrderCount     !== undefined) filter.minOrderCount     = Number(minOrderCount);
  if (maxDaysUntilRunout !== undefined) filter.maxDaysUntilRunout = Number(maxDaysUntilRunout);
  if (lastOrderDaysMax  !== undefined) filter.lastOrderDaysMax  = Number(lastOrderDaysMax);
  if (lastOrderDaysMin  !== undefined) filter.lastOrderDaysMin  = Number(lastOrderDaysMin);

  filter.excludeBlocked = true;

  const result = await resolveAudience(filter);
  res.json({ data: result });
});

// ── Saved segments CRUD ───────────────────────────────────────────────────────

export const listSavedSegments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const segments = await SavedSegment.find({ createdBy: req.user!.id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ data: segments });
});

export const createSavedSegment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, filterState, lastTotal } = req.body as {
    name?: string;
    filterState?: Record<string, unknown>;
    lastTotal?: number;
  };

  if (!name?.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (!filterState || typeof filterState !== "object") {
    res.status(400).json({ error: "filterState is required" });
    return;
  }

  const segment = await SavedSegment.create({
    name:        name.trim(),
    createdBy:   req.user!.id,
    filterState,
    lastTotal:   lastTotal ?? 0,
  });

  res.status(201).json({ data: segment });
});

export const deleteSavedSegment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = req.params["id"] as string;

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid segment ID" });
    return;
  }

  const segment = await SavedSegment.findOneAndDelete({
    _id:       id,
    createdBy: req.user!.id,
  });

  if (!segment) {
    res.status(404).json({ error: "Segment not found" });
    return;
  }

  res.json({ data: { deleted: true } });
});
