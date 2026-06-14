import "dotenv/config";
import express from "express";
import cors from "cors";
import { ChannelSimulatorEngine } from "./simulator/engine";
import { createRoutes } from "./routes";

const HTTP_PORT = Number(process.env.SIMULATOR_PORT ?? 5001);
const WS_PORT = HTTP_PORT + 1;

const app = express();
app.use(cors());
app.use(express.json());

const engine = new ChannelSimulatorEngine(WS_PORT);

app.use("/api/simulator", createRoutes(engine));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(HTTP_PORT, () =>
  console.log(`Channel Simulator HTTP on port ${HTTP_PORT}, WS on port ${WS_PORT}`)
);
