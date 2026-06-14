import { Router } from "express";
import type { ChannelSimulatorEngine } from "../simulator/engine";
import { createSimulatorController } from "../controllers/simulatorController";

export function createRoutes(engine: ChannelSimulatorEngine) {
  const router = Router();
  const ctrl = createSimulatorController(engine);

  router.post("/send",     (req, res) => ctrl.sendMessage(req, res));
  router.post("/dispatch", (req, res) => ctrl.dispatchBatch(req, res));
  router.get("/messages",  (req, res) => ctrl.getMessages(req, res));
  router.get("/stats",     (req, res) => ctrl.getStats(req, res));

  return router;
}
