import type { Request, Response } from "express";
import type { ChannelSimulatorEngine } from "../simulator/engine";

export function createSimulatorController(engine: ChannelSimulatorEngine) {
  return {
    sendMessage(req: Request, res: Response) {
      const { channel, from, to, body, communicationId, subject } = req.body as {
        channel?: string; from?: string; to?: string; body?: string;
        communicationId?: string; subject?: string;
      };
      if (!channel || !from || !to || !body) {
        res.status(400).json({ success: false, message: "channel, from, to, body are required" });
        return;
      }
      const message = engine.send({ channel: channel as import("../simulator/engine").ChannelType, from, to, body, subject, communicationId });
      res.status(202).json({ success: true, data: message });
    },

    dispatchBatch(req: Request, res: Response) {
      const { messages } = req.body as {
        messages?: Array<{
          channel: string; from: string; to: string; body: string;
          communicationId?: string; subject?: string;
        }>;
      };
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ success: false, message: "messages array is required" });
        return;
      }
      const results = messages.map((m) =>
        engine.send({
          channel: m.channel as import("../simulator/engine").ChannelType,
          from: m.from, to: m.to, body: m.body,
          subject: m.subject, communicationId: m.communicationId,
        })
      );
      res.status(202).json({ success: true, data: { queued: results.length } });
    },

    getMessages(_req: Request, res: Response) {
      res.json({ success: true, data: engine.getMessages() });
    },

    getStats(_req: Request, res: Response) {
      const messages = engine.getMessages();
      const byChannel = (["whatsapp", "sms", "email", "rcs"] as const).map((ch) => {
        const msgs = messages.filter((m) => m.channel === ch);
        const has = (type: string) => msgs.filter((m) => m.events.some((e) => e.type === type)).length;
        return {
          channel:   ch,
          total:     msgs.length,
          delivered: has("delivered"),
          opened:    has("opened"),
          clicked:   has("clicked"),
          converted: has("converted"),
          failed:    msgs.filter((m) => m.status === "failed").length,
        };
      });
      res.json({ success: true, data: byChannel });
    },
  };
}
