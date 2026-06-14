import { asyncHandler } from "../utils/asyncHandler";
import crypto from "crypto";
import { Types } from "mongoose";
import type { Request, Response } from "express";
import { Communication, type CommEventType, type CommStatus } from "../models/Communication";
import { CommunicationEvent } from "../models/CommunicationEvent";
import { Campaign } from "../models/Campaign";
import { Customer } from "../models/Customer";
import { Order } from "../models/Order";

// ── Signature verification ────────────────────────────────────────────────────

const SIM_SECRET = process.env.SIM_WEBHOOK_SECRET ?? "";

function verifySignature(rawBody: string, signature: string | undefined): boolean {
  if (!SIM_SECRET) return true;            // no secret configured → skip
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", SIM_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Monotonic state machine ───────────────────────────────────────────────────

const STATUS_RANK: Record<CommStatus, number> = {
  queued:    0,
  sent:      1,
  delivered: 2,
  opened:    3,
  clicked:   4,
  converted: 5,
  failed:    5,
  bounced:   5,
};

const TERMINAL_STATES: ReadonlySet<CommStatus> = new Set(["converted", "failed", "bounced"]);

function canAdvance(current: CommStatus, next: CommEventType): boolean {
  if (TERMINAL_STATES.has(current)) return false;
  return (STATUS_RANK[next as CommStatus] ?? -1) > STATUS_RANK[current];
}

// ── Timestamp map ─────────────────────────────────────────────────────────────

const TIMESTAMP_FIELD: Partial<Record<CommEventType, string>> = {
  sent:      "sentAt",
  delivered: "deliveredAt",
  opened:    "openedAt",
  clicked:   "clickedAt",
  converted: "convertedAt",
};

const VALID_STAT_EVENTS: ReadonlySet<string> = new Set([
  "sent", "delivered", "opened", "clicked", "converted", "failed", "bounced",
]);

// ── Webhook handler ───────────────────────────────────────────────────────────

export const handleWebhook = asyncHandler(async (req: Request, res: Response) => {
  // 1. Verify shared-secret HMAC signature
  const rawBody   = (req as typeof req & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
  const signature = req.headers["x-sim-signature"] as string | undefined;

  if (!verifySignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const { communicationId, eventId, event, timestamp, metadata } = req.body as {
    communicationId?: string;
    eventId?:         string;
    event?:           string;
    timestamp?:       string;
    metadata?:        Record<string, unknown>;
  };

  if (!communicationId || !event) {
    res.status(400).json({ error: "communicationId and event are required" });
    return;
  }

  // Validate communicationId is a valid ObjectId to prevent Mongoose cast errors
  if (!Types.ObjectId.isValid(communicationId)) {
    res.status(400).json({ error: "Invalid communicationId format" });
    return;
  }

  const ts = new Date(timestamp ?? Date.now());

  // 2. Idempotency: if eventId provided, deduplicate
  if (eventId) {
    const exists = await CommunicationEvent.findOne({ eventId }).lean();
    if (exists) {
      res.json({ success: true, idempotent: true });
      return;
    }
  }

  // 3. Load communication and apply monotonic state machine
  const comm = await Communication.findById(communicationId);
  if (!comm) {
    res.status(404).json({ error: "Communication not found" });
    return;
  }

  const eventType = event as CommEventType;

  if (!canAdvance(comm.status, eventType)) {
    // Event arrives out of order or tries to regress — acknowledge but skip
    res.json({ success: true, skipped: true, reason: "state machine: event rejected" });
    return;
  }

  // 4. Persist idempotency record (best-effort before update)
  if (eventId) {
    try {
      await CommunicationEvent.create({
        eventId,
        communicationId: comm._id,
        event: eventType,
        timestamp: ts,
        metadata,
      });
    } catch {
      // Unique index race: another process already processed it
      res.json({ success: true, idempotent: true });
      return;
    }
  }

  // 5. Update Communication: status + denormalized timestamp + event log
  const setFields: Record<string, unknown> = { status: eventType };
  const tsField = TIMESTAMP_FIELD[eventType];
  if (tsField) setFields[tsField] = ts;

  if (eventType === "failed" || eventType === "bounced") {
    if (metadata?.errorCode)    setFields.errorCode    = metadata.errorCode;
    if (metadata?.errorMessage) setFields.errorMessage = metadata.errorMessage;
  }

  await Communication.findByIdAndUpdate(communicationId, {
    $set:  setFields,
    $push: { events: { type: eventType, timestamp: ts, metadata } },
  });

  // 6. Attribution: on converted event, create a real attributed Order
  if (eventType === "converted") {
    const orderValue = Number(metadata?.estimatedOrderValue ?? 0);
    try {
      const customer = await Customer.findById(comm.customerId).lean();
      const lastOrder = customer
        ? await Order.findOne({
            customer: comm.customerId,
            status: "delivered",
            attributedCommunicationId: { $exists: false }, // only non-attributed orders
          })
            .sort({ createdAt: -1 })
            .lean()
        : null;

      const shippingAddress = lastOrder?.shippingAddress ??
        (customer?.addresses?.[0]
          ? {
              street:  customer.addresses[0].street,
              city:    customer.addresses[0].city,
              state:   customer.addresses[0].state,
              zip:     customer.addresses[0].zip,
              country: customer.addresses[0].country,
            }
          : { street: "Unknown", city: "Unknown", state: "Unknown", zip: "000000", country: "India" });

      const items = lastOrder?.items && lastOrder.items.length > 0
        ? lastOrder.items
        : null;

      if (items && customer) {
        const attributedOrder = await Order.create({
          customer:     comm.customerId,
          items,
          subtotal:     orderValue,
          deliveryFee:  0,
          discount:     0,
          total:        orderValue,
          status:       "delivered",
          paymentMethod: "upi",
          paymentStatus: "paid",
          shippingAddress,
          attributedCommunicationId: comm._id,
        });

        // Link order back to communication and update customer LTV
        await Communication.findByIdAndUpdate(comm._id, {
          attributedOrderId: attributedOrder._id,
          attributedRevenue: orderValue,
        });
        await Customer.findByIdAndUpdate(comm.customerId, {
          $inc: { ltv: orderValue, orderCount: 1 },
          lastOrderAt: new Date(),
        });
      }

      await Campaign.findByIdAndUpdate(comm.campaignId, {
        $inc: { "stats.converted": 1, "stats.revenue": orderValue },
      });
    } catch (err) {
      console.error("[webhook] attribution failed:", err);
      // Don't fail the webhook — attribution is best-effort
      await Campaign.findByIdAndUpdate(comm.campaignId, {
        $inc: { "stats.converted": 1, "stats.revenue": 0 },
      });
    }
  } else if (VALID_STAT_EVENTS.has(event)) {
    await Campaign.findByIdAndUpdate(comm.campaignId, {
      $inc: { [`stats.${event}`]: 1 },
    });
  }

  res.json({ success: true });
});

// ── List communications ────────────────────────────────────────────────────────

export const getCommunications = asyncHandler(async (req: Request, res: Response) => {
  const { campaignId } = req.query;
  const filter = campaignId ? { campaignId } : {};
  const comms = await Communication.find(filter)
    .populate("customerId", "userId")
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ data: comms });
});
