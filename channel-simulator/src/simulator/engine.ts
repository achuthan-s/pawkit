import { WebSocketServer, WebSocket } from "ws";
import axios from "axios";
import crypto from "crypto";

export type ChannelType = "whatsapp" | "sms" | "email" | "rcs";

export type DeliveryEventType =
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "converted"
  | "failed"
  | "bounced";

export interface SimulatedMessage {
  id: string;
  communicationId?: string;
  channel: ChannelType;
  from: string;
  to: string;
  subject?: string;
  body: string;
  timestamp: string;
  status: DeliveryEventType;
  events: Array<{ type: DeliveryEventType; timestamp: string; metadata?: Record<string, unknown> }>;
}

const PLATFORM_WEBHOOK_URL =
  process.env.PLATFORM_WEBHOOK_URL ?? "http://localhost:5050/api/communications/webhook";

// Probability that the message reaches the recipient's device
const DELIVERY_RATES: Record<ChannelType, number> = {
  whatsapp: 0.95,
  sms:      0.90,
  email:    0.85,
  rcs:      0.88,
};

// Probability of opening a delivered message
const OPEN_RATES: Record<ChannelType, number> = {
  whatsapp: 0.75,
  sms:      0.60,
  email:    0.35,
  rcs:      0.50,
};

// Probability of clicking a link after opening
const CLICK_RATE = 0.25;

// Probability of placing an order after clicking (conversion)
const CONVERT_RATE = 0.40;

// Simulated order value range (INR)
const MIN_ORDER_VALUE = 300;
const MAX_ORDER_VALUE = 2000;

function randBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class ChannelSimulatorEngine {
  private wss: WebSocketServer;
  private messages: SimulatedMessage[] = [];

  constructor(wsPort: number) {
    this.wss = new WebSocketServer({ port: wsPort });
    this.wss.on("connection", (ws) => {
      ws.send(JSON.stringify({ event: "connected", messages: this.messages }));
    });
    console.log(`Channel Simulator WebSocket on ws://localhost:${wsPort}`);
  }

  send(
    payload: Omit<SimulatedMessage, "id" | "timestamp" | "status" | "events">
  ): SimulatedMessage {
    const msg: SimulatedMessage = {
      ...payload,
      id:        crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      status:    "sent",
      events:    [{ type: "sent", timestamp: new Date().toISOString() }],
    };
    this.messages.push(msg);
    this.broadcast({ event: "message:sent", message: msg });
    this.fireWebhook(payload.communicationId, "sent");

    this.simulateLifecycle(msg);
    return msg;
  }

  getMessages(): SimulatedMessage[] {
    return this.messages;
  }

  private simulateLifecycle(msg: SimulatedMessage) {
    // Step 1 — delivery attempt: 0.5–2 s after send
    setTimeout(() => {
      const delivered = Math.random() < DELIVERY_RATES[msg.channel];

      if (!delivered) {
        this.advance(msg, "failed");
        return;
      }

      this.advance(msg, "delivered");

      // Step 2 — open attempt: 5–20 s after delivery
      setTimeout(() => {
        if (Math.random() >= OPEN_RATES[msg.channel]) return;

        this.advance(msg, "opened");

        // Step 3 — click attempt: 3–10 s after open
        setTimeout(() => {
          if (Math.random() >= CLICK_RATE) return;

          this.advance(msg, "clicked");

          // Step 4 — conversion attempt: 2–8 s after click
          setTimeout(() => {
            if (Math.random() >= CONVERT_RATE) return;

            const orderValue = randBetween(MIN_ORDER_VALUE, MAX_ORDER_VALUE);
            this.advance(msg, "converted", { estimatedOrderValue: orderValue });
          }, 2000 + Math.random() * 6000);

        }, 3000 + Math.random() * 7000);

      }, 5000 + Math.random() * 15000);

    }, 500 + Math.random() * 1500);
  }

  private advance(
    msg: SimulatedMessage,
    event: DeliveryEventType,
    metadata?: Record<string, unknown>
  ) {
    msg.status = event;
    msg.events.push({ type: event, timestamp: new Date().toISOString(), metadata });
    this.broadcast({ event: `message:${event}`, message: msg });
    this.fireWebhook(msg.communicationId, event, metadata);
  }

  private async fireWebhook(
    communicationId: string | undefined,
    event: DeliveryEventType,
    metadata?: Record<string, unknown>
  ) {
    if (!communicationId) return;
    const eventId   = crypto.randomUUID();
    const secret    = process.env.SIM_WEBHOOK_SECRET ?? "";
    const body      = JSON.stringify({
      communicationId,
      eventId,
      event,
      timestamp: new Date().toISOString(),
      metadata,
    });
    const signature = secret
      ? crypto.createHmac("sha256", secret).update(body).digest("hex")
      : undefined;

    try {
      await axios.post(PLATFORM_WEBHOOK_URL, body, {
        headers: {
          "Content-Type":    "application/json",
          ...(signature ? { "x-sim-signature": signature } : {}),
        },
      });
    } catch {
      // Best-effort — simulator does not retry
    }
  }

  private broadcast(payload: object) {
    const data = JSON.stringify(payload);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(data);
    });
  }
}
