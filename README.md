# PawKit Platform

PawKit is a comprehensive, AI-powered pet care CRM and marketing automation platform. Designed for pet supply retailers, PawKit helps operators manage products, customers, and AI-driven marketing campaigns with an automated reorder prediction system based on customer purchase history and pet data.

## 🌟 Features

- **AI-Powered Audience Targeting**: Use natural language prompts to instantly generate audience segments for your campaigns (powered by Google Gemini).
- **Automated Reorder Predictions**: A sophisticated "Reorder Clock" that blends cold-start predictions (based on pet species/weight) with empirical purchase history to determine exactly when a customer needs to reorder pet food.
- **Smart Campaign Management**: Create, approve, and launch multi-channel marketing campaigns (Email, SMS, WhatsApp).
- **Frequency Capping & Cross-Channel Isolation**: Ensure you don't spam customers by enforcing frequency limits per channel.
- **Radar Automation**: Background AI scan that spots anomalies and automatically creates draft campaigns to capture lost revenue.
- **Attribution Engine**: Webhooks track message delivery, opens, clicks, and conversions, generating attributed CRM orders and boosting customer LTV.
- **Channel Simulator**: A built-in local simulator to test webhook events, message dispatches, and campaign flow without spending real money on messaging providers.

---

## 🏗️ Architecture & Tech Stack

PawKit is structured as an npm workspace monorepo containing three core packages:

### 1. Client (`/client`)
The frontend is a modern, responsive web application for Marketers and Operators.
- **Framework**: Next.js 15 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v3
- **Components**: Radix UI primitives & `lucide-react` icons
- **Data Viz**: Recharts

### 2. Server (`/server`)
The robust REST API backend that powers the CRM, AI layer, and webhook attribution.
- **Runtime**: Node.js & Express.js
- **Database**: MongoDB (via Mongoose)
- **Validation**: Zod
- **Authentication**: JWT & bcryptjs
- **AI Integration**: Google Generative AI (`@google/generative-ai`)
- **Dev Database**: `mongodb-memory-server` (Zero-setup local database for development)

### 3. Channel Simulator (`/channel-simulator`)
A local mocking service that simulates the behavior of external API providers (Twilio, SendGrid, Meta). It receives dispatched messages and fires HMAC-secured webhooks back to the server to simulate delivery, opens, clicks, and conversions.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v22+ recommended)
- npm (v9+)

### Installation

1. **Clone the repository** and navigate to the project root:
   ```bash
   cd pawkit
   ```

2. **Install all dependencies** across all workspaces:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Copy the example environment file and fill in the required values.
   ```bash
   cp .env.example .env
   ```
   *Note: For the AI features to work, you will need to add a valid `GEMINI_API_KEY` to the server's environment variables.*

### Running the Application

To start the entire platform (Client, Server, and Simulator) concurrently in development mode, run:

```bash
npm run dev
```

This will spin up:
- **Client**: [http://localhost:3000](http://localhost:3000)
- **Server**: [http://localhost:5050](http://localhost:5050)
- **Simulator**: [http://localhost:5001](http://localhost:5001)

*(Note: The server uses an ephemeral `mongodb-memory-server` by default so no local MongoDB installation is required. The database is seeded on every cold start).*

---

## 📖 Architecture Decisions

The following Architecture Decision Records (ADRs) outline the core design choices made during the platform's development:

### ADR-001: MongoMemoryServer for development
- **Context:** The team does not want to run a local MongoDB daemon for development.
- **Decision:** Use `mongodb-memory-server` when `MONGODB_URI` is not set. The binary is stored in `/tmp/mongodb-binaries` via `MONGOMS_DOWNLOAD_DIR` to avoid root-owned `~/.cache` on shared machines.
- **Trade-off:** Ephemeral — data is lost on restart. Seeded on every cold start via `seedDevData()`. For persistence in dev, set `MONGODB_URI`.

### ADR-002: Denormalized CRM fields on Customer
- **Context:** The analytics dashboard needs `segment`, `ltv`, `orderCount`, `lastOrderAt`, `nextRunoutAt`, `daysUntilRunout` without joining multiple collections.
- **Decision:** Denormalize these onto `Customer`. The order controller bumps `ltv`/`orderCount`/`lastOrderAt` in-place; `recomputeForCustomer` refreshes runout fields after every order. A batch job (`POST /api/jobs/recompute-clock`) catches any drift.
- **Trade-off:** Slightly stale between events. Acceptable because the radar scan and audience queries run on these fields at campaign time, not real-time.

### ADR-003: Reorder clock — cold-start → blended → empirical
- **Context:** New customers have no inter-purchase history.
- **Decision:** Three-mode prediction: (1) cold-start uses species/weight/life-stage feeding tables; (2) blended linearly weights cold-start and empirical as data accumulates (weight = min(n/4, 0.8)); (3) empirical takes the median inter-purchase interval once weight hits 0.8.
- **Trade-off:** Cold-start is inaccurate (~40% confidence) but better than nothing. Confidence score surfaces uncertainty to the marketer.

### ADR-004: IAudienceFilter split — Campaign model vs. audience service
- **Context:** The `Campaign` model has its own embedded `IAudienceFilter` schema. The `resolveAudience` service has a richer `IAudienceFilter`.
- **Decision:** Keep the Campaign schema minimal (what the UI edits) and map to the service filter at launch time in `launchCampaign`. No migration needed.

### ADR-005: Webhook signature — HMAC-SHA256 with shared secret
- **Context:** The simulator posts delivery events to the CRM. Without verification, any caller could fake events.
- **Decision:** Simulator signs each webhook body with HMAC-SHA256(`SIM_WEBHOOK_SECRET`), sent as `x-sim-signature`. Server verifies before processing. If `SIM_WEBHOOK_SECRET` is empty (e.g., missing in dev), verification is bypassed.
- **Trade-off:** Timing-safe comparison prevents timing attacks. Secret is symmetric.

### ADR-006: Idempotency via CommunicationEvent collection
- **Context:** Webhook delivery is at-least-once. Duplicate events would inflate campaign stats.
- **Decision:** Each webhook carries a `eventId` (UUID). The `CommunicationEvent` collection has a unique index on `eventId`. A duplicate event triggers a MongoDB duplicate-key error, which is caught and returns `{ idempotent: true }` without processing.
- **Trade-off:** Adds one extra DB write per event. Acceptable for correctness.

### ADR-007: Monotonic state machine for Communication status
- **Context:** Events can arrive out of order (network reorder). Allowing regressions would corrupt status.
- **Decision:** `STATUS_RANK` assigns each status a rank (queued=0 … converted/failed/bounced=5). An event is only applied if its rank > current rank AND the current status is not terminal.
- **Trade-off:** A `failed` event after `clicked` is silently dropped. This is intentional.

### ADR-008: Attribution creates a real Order on converted event
- **Context:** "Conversion" from the simulator is a simulated signal. To track CRM-driven revenue separately, we need a real Order document.
- **Decision:** On `converted` webhook, the server clones the customer's most recent delivered non-attributed order, creates a new Order with `attributedCommunicationId`, and links back `attributedOrderId` on the Communication. Customer `ltv`/`orderCount` are bumped.
- **Trade-off:** If the customer has no previous order, no attributed Order is created. Attribution is best-effort.

### ADR-009: Radar scan deduplicates by signal + day
- **Context:** If the operator runs the radar scan twice in one day, we don't want duplicate `pending_approval` campaigns.
- **Decision:** `radarScan` skips creating a campaign if a `pending_approval` campaign with a matching goal pattern already exists for the current day.
- **Trade-off:** Uses a regex search on `goal`, which is fragile. A dedicated `radarSignal` field on Campaign would be more robust — acceptable tech debt for now.

### ADR-010: OpenAI function-calling with zod + rule-based fallback
- **Context:** AI endpoints must work even without an API key (dev, demo, cost control).
- **Decision:** Every AI function checks `process.env.OPENAI_API_KEY` first. If absent or if the API call fails, a rule-based fallback runs (keyword matching / pre-written templates). Zod validates the structured output regardless of source.
- **Trade-off:** Fallback quality is lower. Confidence is surfaced in proposal `rationale`.

## 🧪 Testing and Verification

You can verify the types across all workspaces by running:
```bash
npm run type-check
```

To build the project for production, run:
```bash
npm run build
```

---

*PawKit - Because your pet business deserves smart automation.*
