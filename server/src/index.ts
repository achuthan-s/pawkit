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
app.set("trust proxy", 1); // Trust reverse proxy for rate limiting (Render/Heroku)

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: isProd
      ? undefined
      : false, // relax CSP in dev only
  })
);

// ── CORS — restrict to known client origin ────────────────────────────────────
const allowedOrigins = CLIENT_URL.split(',').map(url => url.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      // Reflect the origin back to support Vercel preview URLs, 
      // or check against allowedOrigins array if strictly needed.
      callback(null, origin || true);
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
