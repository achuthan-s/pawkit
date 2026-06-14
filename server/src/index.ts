import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { connectDB } from "./utils/db";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT ?? 5050;
const CLIENT_URL = process.env.CLIENT_URL ?? "http://localhost:3000";
const isProd = process.env.NODE_ENV === "production";

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: isProd
      ? undefined
      : false, // relax CSP in dev only
  })
);

// ── CORS — restrict to known client origin ────────────────────────────────────
const allowedOrigins = [CLIENT_URL];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (no origin) and the configured client URL.
      // Pass `false` (not an Error) for blocked origins so Express returns 200 without
      // CORS headers — the browser will then refuse to read the response.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Stricter limit for auth endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth attempts. Please try again later." },
});

// Stricter limit for AI endpoints (they're expensive)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "AI rate limit reached. Please slow down." },
});

app.use(globalLimiter);
app.use(morgan(isProd ? "combined" : "dev"));

// ── Body parsing — with raw buffer capture for HMAC webhook verification ──────
app.use(
  express.json({
    limit: "10kb",
    verify: (req, _res, buf) => {
      (req as typeof req & { rawBody: string }).rawBody = buf.toString("utf8");
    },
  })
);

// ── Route-level limiters before main router ───────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api/ai", aiLimiter);

// ── Main API routes ───────────────────────────────────────────────────────────
app.use("/api", routes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

// ── Global error handler (must be last) ──────────────────────────────────────
app.use(errorHandler);

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
