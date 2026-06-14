/**
 * Reorder Clock Service
 *
 * For each (customer, pet, consumable product the household buys) computes:
 *   - predictedRunoutDate  (cold-start | blended | empirical)
 *   - daysUntilRunout      (negative = already overdue)
 *   - confidence           (0–100)
 *   - method
 *
 * Materialises results to Customer.runoutPredictions (embed) and the two
 * denormalized fields nextRunoutAt / daysUntilRunout (for fast queries).
 * Also re-derives Customer.segment from recency + runout signal.
 */

import { Types } from "mongoose";
import { Customer } from "../models/Customer";
import { Pet }      from "../models/Pet";
import { Order }    from "../models/Order";
import { Product }  from "../models/Product";
import { estimateDailyGrams, inferLifeStage, parsePackGrams } from "../utils/feedingGuide";

// Categories we treat as consumable (depletable daily)
const CONSUMABLE_CATS = new Set([
  "dog-food", "cat-food", "treats", "supplements", "health",
]);

// Blending weight cap
const MAX_BLEND_W = 0.8;

// DAY_MS constant
const DAY_MS = 24 * 3600 * 1000;

// ── Types ─────────────────────────────────────────────────────────────────

interface PredictionInput {
  customerId: Types.ObjectId;
  petId:      Types.ObjectId;
  productId:  Types.ObjectId;
  species:    string;
  weightKg:   number;
  dob?:       Date;
  dailyGramsOverride?: number;       // from foodPreferences
  packGrams:  number;                // resolved from the size the customer buys
  qty:        number;                // qty bought in most recent order
  orderDates: Date[];                // all order dates for this product (asc)
}

interface ClockResult {
  petId:               Types.ObjectId;
  productId:           Types.ObjectId;
  predictedRunoutDate: Date;
  daysUntilRunout:     number;
  confidence:          number;
  method:              "cold-start" | "blended" | "empirical";
  calculatedAt:        Date;
}

// ── Core computation ──────────────────────────────────────────────────────

function computePrediction(inp: PredictionInput): ClockResult {
  const stage = inferLifeStage(inp.species, inp.dob);
  const dailyGrams =
    inp.dailyGramsOverride && inp.dailyGramsOverride > 0
      ? inp.dailyGramsOverride
      : estimateDailyGrams(inp.species, inp.weightKg, stage);

  // Guard against degenerate values
  const safeDaily = Math.max(dailyGrams, 1);
  const lastOrder = inp.orderDates[inp.orderDates.length - 1];
  const coldDays  = (inp.packGrams * inp.qty) / safeDaily;

  let daysSupply: number;
  let confidence: number;
  let method: ClockResult["method"];

  if (inp.orderDates.length < 2) {
    // Cold-start: pure pack-size + daily grams estimate
    daysSupply = coldDays;
    confidence = inp.dailyGramsOverride ? 65 : 40;
    method     = "cold-start";
  } else {
    // Compute median inter-purchase interval
    const intervals: number[] = [];
    for (let i = 1; i < inp.orderDates.length; i++) {
      intervals.push(
        (inp.orderDates[i].getTime() - inp.orderDates[i - 1].getTime()) / DAY_MS
      );
    }
    intervals.sort((a, b) => a - b);
    const mid = Math.floor(intervals.length / 2);
    const empiricalDays =
      intervals.length % 2 === 1
        ? intervals[mid]
        : (intervals[mid - 1] + intervals[mid]) / 2;

    // Blending weight: grows with # of data points, capped at MAX_BLEND_W
    const w = Math.min((inp.orderDates.length / 4) * MAX_BLEND_W, MAX_BLEND_W);

    // Coefficient of variation of intervals → lower CV = higher confidence
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 1;
    // cv 0 → 100%, cv 1 → ~50%, cv >2 → low
    const dataConfidence = Math.max(20, Math.round(100 * Math.exp(-cv)));

    if (w >= MAX_BLEND_W) {
      daysSupply = empiricalDays;
      confidence = dataConfidence;
      method     = "empirical";
    } else {
      daysSupply = w * empiricalDays + (1 - w) * coldDays;
      confidence = Math.round(w * dataConfidence + (1 - w) * (inp.dailyGramsOverride ? 65 : 40));
      method     = "blended";
    }
  }

  const predictedRunoutDate = new Date(lastOrder.getTime() + daysSupply * DAY_MS);
  const daysUntilRunout     = Math.round(
    (predictedRunoutDate.getTime() - Date.now()) / DAY_MS
  );

  return {
    petId:               inp.petId,
    productId:           inp.productId,
    predictedRunoutDate,
    daysUntilRunout,
    confidence,
    method,
    calculatedAt: new Date(),
  };
}

// ── Segment derivation ────────────────────────────────────────────────────

function deriveSegment(
  ltv: number,
  orderCount: number,
  lastOrderAt: Date | undefined,
  minDaysUntilRunout: number | null,
): "high-ltv" | "loyal" | "at-risk" | "new" | "growing" | "inactive" {
  const now      = Date.now();
  const daysSinceLast = lastOrderAt
    ? (now - lastOrderAt.getTime()) / DAY_MS
    : Infinity;

  if (ltv >= 20000 || orderCount >= 12) return "high-ltv";
  if (orderCount <= 1) return "new";
  if (daysSinceLast > 90) return "inactive";
  if (daysSinceLast > 45 || (minDaysUntilRunout !== null && minDaysUntilRunout < 0)) {
    return "at-risk";
  }
  if (orderCount >= 5 && daysSinceLast <= 60) return "loyal";
  return "growing";
}

// ── Main: recompute for a single customer ─────────────────────────────────

export async function recomputeForCustomer(customerId: string | Types.ObjectId): Promise<void> {
  const cid = typeof customerId === "string"
    ? new Types.ObjectId(customerId)
    : customerId;

  const [customer, pets] = await Promise.all([
    Customer.findById(cid),
    Pet.find({ customerId: cid }),
  ]);

  if (!customer) return;

  // All orders for this customer (newest first)
  const orders = await Order.find({ customer: cid })
    .populate("items.product")
    .sort({ createdAt: 1 })       // ascending so we can walk intervals
    .lean();

  // Build map: productId → { orders (dates), packGrams, qty, size label }
  const productMap = new Map<
    string,
    { dates: Date[]; packGrams: number; qty: number; size: string }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const prod = item.product as (typeof item.product & {
        category?: string; sizes?: Array<{ label: string; price: number }>;
      }) | null;
      if (!prod) continue;
      const category = (prod as { category?: string }).category ?? "";
      if (!CONSUMABLE_CATS.has(category)) continue;

      const pid = (prod as { _id: Types.ObjectId })._id.toString();
      const packGrams = parsePackGrams(item.selectedSize) ?? 1000;

      if (!productMap.has(pid)) {
        productMap.set(pid, { dates: [], packGrams, qty: item.quantity, size: item.selectedSize });
      }
      const entry = productMap.get(pid)!;
      entry.dates.push(order.createdAt as Date);
      // Update to most-recent packGrams / qty
      if (order.createdAt >= entry.dates[entry.dates.length - 1]) {
        entry.packGrams = packGrams;
        entry.qty       = item.quantity;
      }
    }
  }

  if (productMap.size === 0) {
    // No consumable orders — clear predictions, keep derived segment
    const seg = deriveSegment(customer.ltv, customer.orderCount, customer.lastOrderAt, null);
    await Customer.findByIdAndUpdate(cid, {
      runoutPredictions: [],
      nextRunoutAt:      undefined,
      daysUntilRunout:   undefined,
      segment:           seg,
    });
    return;
  }

  // Build one prediction per (pet, product) pair
  // Simple heuristic: assign product to the pet whose species matches the category
  const results: ClockResult[] = [];

  for (const [pid, entry] of productMap.entries()) {
    const prod = await Product.findById(pid).lean();
    if (!prod) continue;

    // Find matching pet(s) by species / category
    const targetSpecies = (prod as { targetSpecies?: string[] }).targetSpecies ?? [];
    const matchingPets  = pets.filter((p) =>
      targetSpecies.length === 0 ||
      targetSpecies.includes(p.species) ||
      targetSpecies.includes("all")
    );

    if (matchingPets.length === 0) {
      // Assign to first pet as fallback
      if (pets.length > 0) matchingPets.push(pets[0]);
      else continue;
    }

    // Sum daily grams for multi-pet households sharing the product
    const totalDailyGrams = matchingPets.reduce((sum, pet) => {
      const override = pet.foodPreferences?.dailyAmountGrams;
      const stage    = inferLifeStage(pet.species, pet.dob);
      return sum + (override && override > 0
        ? override
        : estimateDailyGrams(pet.species, pet.weight ?? 0, stage));
    }, 0);

    // One prediction per pet, sharing the total supply
    for (const pet of matchingPets) {
      const inp: PredictionInput = {
        customerId:          cid,
        petId:               pet._id as Types.ObjectId,
        productId:           new Types.ObjectId(pid),
        species:             pet.species,
        weightKg:            pet.weight ?? 0,
        dob:                 pet.dob,
        dailyGramsOverride:  totalDailyGrams,
        packGrams:           entry.packGrams,
        qty:                 entry.qty,
        orderDates:          entry.dates,
      };
      results.push(computePrediction(inp));
    }
  }

  // Soonest runout
  const soonest = results.reduce<ClockResult | null>((best, r) =>
    best === null || r.daysUntilRunout < best.daysUntilRunout ? r : best
  , null);

  const minDays = soonest ? soonest.daysUntilRunout : null;
  const seg     = deriveSegment(customer.ltv, customer.orderCount, customer.lastOrderAt, minDays);

  await Customer.findByIdAndUpdate(cid, {
    runoutPredictions: results.map((r) => ({
      petId:               r.petId,
      productId:           r.productId,
      predictedRunoutDate: r.predictedRunoutDate,
      daysUntilRunout:     r.daysUntilRunout,
      confidence:          r.confidence,
      method:              r.method,
      calculatedAt:        r.calculatedAt,
    })),
    nextRunoutAt:    soonest?.predictedRunoutDate ?? undefined,
    daysUntilRunout: minDays ?? undefined,
    segment:         seg,
  });
}

// ── Batch recompute ───────────────────────────────────────────────────────

export async function recomputeAll(): Promise<{ processed: number; errors: number }> {
  const customers = await Customer.find({}, "_id").lean();
  let errors = 0;

  for (const c of customers) {
    try {
      await recomputeForCustomer(c._id as Types.ObjectId);
    } catch (err) {
      console.error(`reorderClock: failed for customer ${c._id}`, err);
      errors++;
    }
  }

  return { processed: customers.length - errors, errors };
}
