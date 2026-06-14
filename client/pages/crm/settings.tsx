import { useState } from "react";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  RefreshCcw, Loader2, CheckCircle, Shield, Database, Terminal,
  FileText, ChevronDown, ChevronUp, Settings, BookOpen, Code2,
  Layers, AlertCircle,
} from "lucide-react";
import api from "@/lib/api";

type Tab = "engine" | "api" | "architecture" | "validation";

interface JobResult { processed: number; errors: number }

const METHOD_STYLES: Record<string, string> = {
  GET:    "bg-blue-50 text-blue-700 border border-blue-200",
  POST:   "bg-green-50 text-green-700 border border-green-200",
  PATCH:  "bg-amber-50 text-amber-700 border border-amber-200",
  DELETE: "bg-red-50 text-red-700 border border-red-200",
};

interface Endpoint {
  method: string;
  path: string;
  description: string;
  body?: string;
  response: string;
  auth?: string;
}

interface EndpointGroup {
  group: string;
  endpoints: Endpoint[];
}

const API_GROUPS: EndpointGroup[] = [
  {
    group: "Authentication",
    endpoints: [
      { method: "POST", path: "/api/auth/login",    description: "Authenticate and receive a JWT token", body: '{ "email": "user@example.com", "password": "secret123" }', response: '{ "data": { "token": "eyJ...", "user": { "_id": "...", "role": "marketer" } } }' },
      { method: "POST", path: "/api/auth/register", description: "Register a new user account",           body: '{ "name": "Maya Sharma", "email": "maya@pawkit.dev", "password": "secret123", "role": "marketer" }', response: '{ "data": { "token": "eyJ...", "user": { ... } } }' },
    ],
  },
  {
    group: "Customers",
    endpoints: [
      { method: "GET",   path: "/api/customers",     description: "List all customers with CRM fields (segment, ltv, daysUntilRunout)", auth: "operator/marketer", response: '{ "data": [{ "_id": "...", "name": "...", "segment": "active", "ltv": 4200, "daysUntilRunout": 12 }] }' },
      { method: "GET",   path: "/api/customers/me",  description: "Get the authenticated customer's own profile", auth: "customer", response: '{ "data": { "_id": "...", "name": "...", "pets": [...], "addresses": [...] } }' },
      { method: "PATCH", path: "/api/customers/me",  description: "Update authenticated customer profile", auth: "customer", body: '{ "name": "Updated Name", "channelOptIn": "whatsapp" }', response: '{ "data": { ...updatedCustomer } }' },
    ],
  },
  {
    group: "Products",
    endpoints: [
      { method: "GET",   path: "/api/products",      description: "List all available products with sizes and inventory", response: '{ "data": [{ "_id": "...", "name": "Royal Canin Maxi", "sizes": [{ "label": "3kg", "price": 1200 }] }] }' },
      { method: "GET",   path: "/api/products/:id",  description: "Get a single product by ID", response: '{ "data": { "_id": "...", "name": "...", "description": "...", "sizes": [...] } }' },
      { method: "POST",  path: "/api/products",      description: "Create a new product (admin only)", auth: "operator", body: '{ "name": "...", "basePrice": 999, "sizes": [{ "label": "2kg", "price": 999 }], "category": "dog_food" }', response: '{ "data": { "_id": "...", ...newProduct } }' },
      { method: "PATCH", path: "/api/products/:id",  description: "Update product details or inventory (admin only)", auth: "operator", body: '{ "sizes": [{ "label": "2kg", "price": 1099, "inventory": 500 }] }', response: '{ "data": { ...updatedProduct } }' },
    ],
  },
  {
    group: "Orders",
    endpoints: [
      { method: "GET",   path: "/api/orders",           description: "List orders for authenticated user (customers see own; operators see all)", auth: "any", response: '{ "data": [{ "_id": "...", "status": "delivered", "total": 1799 }] }' },
      { method: "POST",  path: "/api/orders",           description: "Place a new order", auth: "customer", body: '{ "items": [{ "product": "id", "selectedSize": "3kg", "quantity": 1, "unitPrice": 1200 }], "shippingAddress": { "line1": "...", "city": "..." }, "paymentMethod": "upi" }', response: '{ "data": { "_id": "...", "status": "pending", "total": 1200 } }' },
      { method: "PATCH", path: "/api/orders/:id/status", description: "Update order status (operator/system)", auth: "operator", body: '{ "status": "shipped" }', response: '{ "data": { "_id": "...", "status": "shipped" } }' },
    ],
  },
  {
    group: "Campaigns",
    endpoints: [
      { method: "GET",  path: "/api/campaigns",             description: "List all campaigns with status and stats", auth: "marketer", response: '{ "data": [{ "_id": "...", "name": "...", "status": "pending_approval", "stats": { "sent": 0 } }] }' },
      { method: "POST", path: "/api/campaigns",             description: "Create a new campaign draft", auth: "marketer", body: '{ "name": "Restock Reminder", "goal": "reorder", "channel": "whatsapp", "messageTemplate": "Hi {{name}}...", "audienceFilter": { "segments": ["at_risk"] } }', response: '{ "data": { "_id": "...", "status": "draft" } }' },
      { method: "POST", path: "/api/campaigns/:id/approve", description: "Approve a pending campaign (moves draft → approved)", auth: "operator", response: '{ "data": { "_id": "...", "status": "approved" } }' },
      { method: "POST", path: "/api/campaigns/:id/launch",  description: "Launch an approved campaign — triggers message dispatch", auth: "operator", response: '{ "data": { "_id": "...", "status": "running", "launchedAt": "2025-01-01T..." } }' },
    ],
  },
  {
    group: "AI Studio",
    endpoints: [
      { method: "POST", path: "/api/ai/audience",    description: "Generate audience filter JSON from a natural-language prompt", auth: "marketer", body: '{ "prompt": "customers whose food runs out in 7 days and are on WhatsApp" }', response: '{ "data": { "filter": { "maxDaysUntilRunout": 7, "channelOptIn": "whatsapp" }, "summary": "..." } }' },
      { method: "POST", path: "/api/ai/campaign",    description: "Generate a campaign name, goal, and CTA from a brief", auth: "marketer", body: '{ "goal": "reorder reminder for at-risk dog owners", "audienceSummary": "..." }', response: '{ "data": { "name": "...", "goal": "...", "messageTemplate": "..." } }' },
      { method: "POST", path: "/api/ai/message",     description: "Generate a personalised message template for a channel", auth: "marketer", body: '{ "channel": "whatsapp", "goal": "reorder", "audienceSummary": "dog owners, premium segment" }', response: '{ "data": { "message": "Hi {{name}}, your {{petName}}\'s food..." } }' },
      { method: "POST", path: "/api/ai/radar/scan",  description: "Run the full 5-signal reorder radar scan and auto-create campaigns", auth: "marketer", response: '{ "data": { "scannedAt": "...", "groups": [...], "campaignsCreated": 3, "campaignIds": [...] } }' },
    ],
  },
  {
    group: "Analytics",
    endpoints: [
      { method: "GET", path: "/api/analytics/overview",  description: "Top-level KPIs: customers, orders, revenue, active campaigns", auth: "marketer", response: '{ "data": { "totalCustomers": 1240, "totalOrders": 5820, "activeCampaigns": 3, "totalRevenue": 820000 } }' },
      { method: "GET", path: "/api/analytics/summary",   description: "Revenue, capture rate, and MoM change", auth: "marketer", response: '{ "data": { "revenue": 820000, "captureRate": 34.2, "captureChange": 4.8, "activeCampaigns": 3 } }' },
      { method: "GET", path: "/api/analytics/funnel",    description: "Campaign message funnel: sent → delivered → read → clicked → converted", auth: "marketer", response: '{ "data": { "sent": 99000, "delivered": 87120, "read": 43400, "clicked": 21000, "converted": 8400 } }' },
      { method: "GET", path: "/api/analytics/revenue",   description: "Monthly revenue and order volume time series", auth: "marketer", response: '{ "data": [{ "date": "Jan", "revenue": 480000, "orders": 610 }] }' },
      { method: "GET", path: "/api/analytics/campaigns", description: "Per-campaign stats: sent, delivered, opened, clicked, failed", auth: "marketer", response: '{ "data": [{ "_id": "...", "name": "...", "channel": "whatsapp", "stats": { "sent": 18000 } }] }' },
      { method: "GET", path: "/api/analytics/channels",  description: "Per-channel aggregate stats: total, delivered, opened, clicked", auth: "marketer", response: '{ "data": [{ "_id": "whatsapp", "total": 68000, "delivered": 60800, "opened": 34200, "clicked": 15200 }] }' },
    ],
  },
  {
    group: "Communications (Events)",
    endpoints: [
      { method: "GET",  path: "/api/communications",      description: "List all communication events with current status", auth: "marketer", response: '{ "data": [{ "_id": "...", "status": "delivered", "channel": "whatsapp", "customerId": "..." }] }' },
      { method: "POST", path: "/api/webhook/events",      description: "Receive channel simulator callbacks — HMAC-SHA256 verified via x-sim-signature header", body: '{ "eventId": "uuid", "type": "delivered", "communicationId": "..." }', response: '{ "ok": true }', auth: "HMAC" },
    ],
  },
  {
    group: "Segments",
    endpoints: [
      { method: "GET", path: "/api/segments/preview", description: "Preview audience count for a given filter without creating a campaign", auth: "marketer", response: '{ "data": { "count": 142, "sample": [...] } }' },
    ],
  },
  {
    group: "Jobs",
    endpoints: [
      { method: "POST", path: "/api/jobs/recompute-clock", description: "Rerun the 3-tier reorder clock for all customers and update runoutPredictions", auth: "operator", response: '{ "data": { "processed": 1240, "errors": 0 } }' },
    ],
  },
];

interface Adr {
  id: string;
  title: string;
  status: string;
  date: string;
  context: string;
  decision: string;
  rationale: string;
}

const ADR_LIST: Adr[] = [
  {
    id: "001", title: "Frontend Framework Choice", status: "Accepted", date: "2024-09",
    context: "Needed SSR for SEO, file-based routing, TypeScript support, and a mature React ecosystem with a large component library.",
    decision: "Next.js 15 with the pages router, TypeScript strict mode, Tailwind CSS, and ShadCN UI components.",
    rationale: "Next.js pages router is battle-tested, TypeScript catches API contract mismatches at compile time, and Tailwind enables rapid design iteration without a CSS bundle.",
  },
  {
    id: "002", title: "Database Choice — MongoDB + Mongoose", status: "Accepted", date: "2024-09",
    context: "Customer documents need flexible schemas: embedded pets arrays, multiple addresses, nested runout prediction objects, and denormalised CRM fields that change shape as the product evolves.",
    decision: "MongoDB 7 with Mongoose 8 ODM. MongoMemoryServer for zero-config local development.",
    rationale: "Rich sub-documents avoid joins for hot read paths. MongoMemoryServer removes the need for Docker in development. Mongoose schemas provide runtime validation without a separate migration system.",
  },
  {
    id: "003", title: "Prediction Strategy Design — 3-Tier Clock", status: "Accepted", date: "2024-10",
    context: "Customers have vastly different data richness: new customers have zero order history while loyal customers have 20+ orders. A single prediction method performs poorly across the board.",
    decision: "Three-tier strategy: cold-start (category median) → blended (weighted average of cold-start and empirical) → empirical (personal median inter-order gap). Confidence score determines which tier is used.",
    rationale: "Graceful degradation — every customer gets a prediction. Quality improves automatically as data accumulates. Confidence score is surfaced in the UI so operators understand reliability.",
  },
  {
    id: "004", title: "Event Sourcing for Communications", status: "Accepted", date: "2024-10",
    context: "Channel simulators can deliver duplicate webhook callbacks. Status must only move forward (delivered cannot revert to sent). Audit trail required for compliance.",
    decision: "CommunicationEvent model with a unique index on eventId. A STATUS_RANK map enforces monotonic state transitions.",
    rationale: "Idempotency is guaranteed by the database unique index rather than application logic. The event log provides a full audit trail. State machine enforcement prevents race conditions.",
  },
  {
    id: "005", title: "Campaign Workflow — Mandatory Approval Gate", status: "Accepted", date: "2024-10",
    context: "Automated AI-generated messages carry compliance risk under TRAI DLT guidelines. Sending without human review could result in regulatory action or customer harm.",
    decision: "Campaigns must pass through draft → pending_approval → approved → running. No messages are dispatched until a human operator explicitly approves.",
    rationale: "Safety and regulatory compliance take precedence over automation speed. The approval gate also provides a natural review point for AI-generated content quality.",
  },
  {
    id: "006", title: "AI Integration — Function Calling + Zod + Fallbacks", status: "Accepted", date: "2024-11",
    context: "OpenAI API can be unavailable, rate-limited, or return malformed JSON. The system must remain functional when the AI service is down.",
    decision: "OpenAI function-calling for structured output, validated with Zod schemas. Rule-based keyword-matching fallbacks for all three AI endpoints when the API is unavailable.",
    rationale: "Resilience by design — degraded AI quality is better than a 500 error. Zod validation catches hallucinated fields before they reach the database. Cost is controlled by falling back for simple queries.",
  },
  {
    id: "007", title: "Security Design — JWT + HMAC Webhooks", status: "Accepted", date: "2024-09",
    context: "Three user roles (customer, marketer, operator) need different API access. Webhook endpoints must verify that callbacks genuinely originate from the channel simulator.",
    decision: "JWT HS256 tokens with role embedded in the payload. HMAC-SHA256 verification on x-sim-signature for all webhook events using SIM_WEBHOOK_SECRET.",
    rationale: "Stateless JWT auth scales horizontally. HMAC webhooks prevent spoofing without requiring a shared session store. Role middleware is declarative and easy to audit.",
  },
  {
    id: "008", title: "Analytics Design — MongoDB Aggregation", status: "Accepted", date: "2024-11",
    context: "Real-time KPIs and historical trends are needed. Standing up a separate analytics database (BigQuery, ClickHouse) adds operational complexity at this stage.",
    decision: "All analytics computed via MongoDB aggregation pipelines on the existing collections. No separate analytics store.",
    rationale: "Simplicity at current scale (<10M events). Aggregation pipelines are sufficient for sub-second queries on this data volume. Migration path to BigQuery is documented for when event volume exceeds 10M.",
  },
  {
    id: "009", title: "Audience Segmentation — Dynamic MongoDB Pipeline", status: "Accepted", date: "2024-10",
    context: "Operators need precise targeting: by segment, channel opt-in, LTV range, days until runout, and combinations thereof. Hardcoded segment lists do not scale.",
    decision: "resolveAudience() builds a MongoDB $match pipeline dynamically from an AudienceFilter object. Reused by AI Studio, segment preview, and campaign dispatch.",
    rationale: "Single source of truth for audience resolution. Leverages existing customer data with no separate segment store. Easy to extend with new filter dimensions.",
  },
  {
    id: "010", title: "Scalability Strategy — Stateless API + Atlas", status: "Accepted", date: "2024-11",
    context: "Current architecture uses MongoMemoryServer for development. Production needs durability, replication, and horizontal scaling for API servers.",
    decision: "Stateless Express API servers (no in-process state). MongoDB Atlas for production. Redis for session/cache when needed. CDN for static assets. BullMQ for batch job queuing.",
    rationale: "Stateless servers scale horizontally behind a load balancer. Atlas provides managed replication and backups. Redis enables distributed rate limiting and campaign job queuing at scale.",
  },
];

interface ZodSchema {
  name: string;
  description: string;
  schema: string;
}

const ZOD_SCHEMAS: ZodSchema[] = [
  {
    name: "LoginSchema",
    description: "POST /api/auth/login — Validates user credentials",
    schema: `z.object({
  email:    z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})`,
  },
  {
    name: "CreateCampaignSchema",
    description: "POST /api/campaigns — Validates campaign creation payload",
    schema: `z.object({
  name:              z.string().min(3).max(120),
  goal:              z.string().min(3).max(500),
  channel:           z.enum(["whatsapp", "sms", "email", "rcs"]),
  messageTemplate:   z.string().min(10).max(1600),
  frequencyCapDays:  z.number().int().min(1).max(90).default(7),
  audienceFilter:    z.object({
    segments:            z.array(z.enum(["active","at_risk","inactive","new"])).optional(),
    channelOptIn:        z.enum(["whatsapp","sms","email","rcs"]).optional(),
    minLtv:              z.number().nonnegative().optional(),
    maxDaysUntilRunout:  z.number().int().optional(),
  }).optional(),
})`,
  },
  {
    name: "AudienceFilterSchema",
    description: "POST /api/ai/audience & GET /api/segments/preview — Audience targeting parameters",
    schema: `z.object({
  segments:           z.array(
    z.enum(["active", "at_risk", "inactive", "new"])
  ).optional(),
  channelOptIn:       z.enum(["whatsapp", "sms", "email", "rcs"]).optional(),
  minLtv:             z.number().nonnegative().optional(),
  maxLtv:             z.number().nonnegative().optional(),
  maxDaysUntilRunout: z.number().int().optional(),
  minDaysUntilRunout: z.number().int().optional(),
})`,
  },
  {
    name: "CreateOrderSchema",
    description: "POST /api/orders — Validates order placement",
    schema: `z.object({
  items: z.array(z.object({
    product:      z.string().min(1),
    selectedSize: z.string().min(1),
    quantity:     z.number().int().positive(),
    unitPrice:    z.number().positive(),
  })).min(1, "Order must have at least one item"),
  shippingAddress: z.object({
    line1:   z.string().min(3),
    line2:   z.string().optional(),
    city:    z.string().min(2),
    state:   z.string().min(2),
    pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Invalid PIN"),
  }),
  paymentMethod: z.enum(["upi", "card", "cod", "netbanking"]),
})`,
  },
  {
    name: "CreateProductSchema",
    description: "POST /api/products — Validates product creation (admin)",
    schema: `z.object({
  name:          z.string().min(2).max(120),
  description:   z.string().min(10).max(2000),
  basePrice:     z.number().positive(),
  sizes: z.array(z.object({
    label:     z.string().min(1),
    price:     z.number().positive(),
    inventory: z.number().int().nonnegative().optional(),
    sku:       z.string().optional(),
  })).min(1),
  category:       z.enum(["dog_food","cat_food","treats","supplements","accessories"]),
  targetSpecies:  z.array(z.enum(["dog","cat","bird","fish"])).optional(),
  brand:          z.string().optional(),
})`,
  },
];

const VALIDATION_ERROR_EXAMPLE = `{
  "success": false,
  "error": {
    "issues": [
      {
        "code":    "invalid_type",
        "path":    ["email"],
        "message": "Invalid email address"
      },
      {
        "code":    "too_small",
        "path":    ["password"],
        "message": "Password must be at least 8 characters"
      }
    ]
  }
}`;

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md font-mono tracking-wider flex-shrink-0 ${METHOD_STYLES[method] ?? "bg-gray-100 text-gray-600"}`}>
      {method}
    </span>
  );
}

function EndpointRow({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50/60 transition-colors"
      >
        <MethodBadge method={ep.method} />
        <span className="font-mono text-xs text-gray-700 font-semibold flex-1 min-w-0 truncate">{ep.path}</span>
        {ep.auth && (
          <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full flex-shrink-0 hidden sm:block">{ep.auth}</span>
        )}
        {open ? <ChevronUp size={13} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={13} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/40 space-y-3">
          <p className="text-xs text-gray-600 font-medium">{ep.description}</p>
          {ep.body && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Request Body</p>
              <pre className="bg-gray-900 text-green-400 rounded-lg p-3 text-[11px] font-mono overflow-x-auto leading-relaxed">{ep.body}</pre>
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Example Response</p>
            <pre className="bg-gray-900 text-blue-300 rounded-lg p-3 text-[11px] font-mono overflow-x-auto leading-relaxed">{ep.response}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function AdrCard({ adr }: { adr: Adr }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/60 transition-colors"
      >
        <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex-shrink-0">ADR-{adr.id}</span>
        <span className="text-xs font-bold text-gray-800 flex-1">{adr.title}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[9px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full hidden sm:block">{adr.status}</span>
          <span className="text-[9px] text-gray-400 hidden sm:block">{adr.date}</span>
          {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 bg-gray-50/40 space-y-3">
          {[
            { label: "Context",   text: adr.context },
            { label: "Decision",  text: adr.decision },
            { label: "Rationale", text: adr.rationale },
          ].map(({ label, text }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-xs text-gray-600 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaBlock({ schema }: { schema: ZodSchema }) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <div className="flex items-start justify-between p-4 bg-gray-50/60">
        <div>
          <p className="text-xs font-bold text-gray-900 font-mono">{schema.name}</p>
          <p className="text-[11px] text-gray-400 font-medium mt-0.5">{schema.description}</p>
        </div>
        <span className="text-[9px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full border border-violet-200 flex-shrink-0 ml-3">Zod</span>
      </div>
      <pre className="bg-gray-900 p-4 text-[11px] font-mono leading-relaxed overflow-x-auto">
        {schema.schema.split("\n").map((line, i) => {
          const trimmed = line.trim();
          const isMethod = /^z\.(object|array|string|number|enum|boolean)/.test(trimmed);
          const isKey    = /^\w+:/.test(trimmed) && !isMethod;
          const isZodCall = /z\.(string|number|enum|array|object|boolean|nonnegative|int|positive|min|max|optional|default|regex)/.test(trimmed);
          return (
            <span key={i} className="block">
              {line.split(/(\bz\.\w+\b|"[^"]*"|\b\d+\b)/).map((part, j) => {
                if (/^z\.\w+$/.test(part)) return <span key={j} className="text-violet-400">{part}</span>;
                if (/^"[^"]*"$/.test(part)) return <span key={j} className="text-amber-300">{part}</span>;
                if (/^\d+$/.test(part)) return <span key={j} className="text-blue-300">{part}</span>;
                return <span key={j} className="text-gray-300">{part}</span>;
              })}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "engine",       label: "Reorder Engine",  icon: Settings  },
  { id: "api",          label: "API Explorer",    icon: Terminal  },
  { id: "architecture", label: "Architecture",    icon: Layers    },
  { id: "validation",   label: "Validation",      icon: Shield    },
];

export default function SettingsPage() {
  const [tab,        setTab]       = useState<Tab>("engine");
  const [jobResult,  setJobResult] = useState<JobResult | null>(null);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobError,   setJobError]  = useState("");
  const [lastRun,    setLastRun]   = useState<Date | null>(null);

  async function runRecompute() {
    setJobLoading(true); setJobResult(null); setJobError("");
    try {
      const { data } = await api.post<{ data: JobResult }>("/jobs/recompute-clock");
      setJobResult(data.data);
      setLastRun(new Date());
    } catch (err: unknown) {
      setJobError(err instanceof Error ? err.message : "Job failed — check server logs");
    }
    setJobLoading(false);
  }

  return (
    <CrmLayout title="System Settings" subtitle="Engine configuration, API reference, architecture decisions, and validation schemas">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                tab === id ? "bg-violet-600 text-white shadow" : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {tab === "engine" && (
          <div className="space-y-5">

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center">
                  <RefreshCcw size={15} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Reorder Clock Control</p>
                  <p className="text-xs text-gray-400 font-medium">Recomputes runout predictions for all customers</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900 mb-1">Recompute All Clocks</p>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">
                      Runs the 3-tier prediction engine for every customer with order history. Updates{" "}
                      <code className="bg-gray-200 px-1.5 py-0.5 rounded text-[11px] font-mono">runoutPredictions</code> and{" "}
                      <code className="bg-gray-200 px-1.5 py-0.5 rounded text-[11px] font-mono">daysUntilRunout</code> on each Customer document.
                    </p>
                    {lastRun && (
                      <p className="text-xs text-gray-400 font-medium mb-3">
                        Last run: {lastRun.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                    {jobResult && (
                      <div className="flex items-center gap-4 text-xs">
                        <span className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full">
                          <CheckCircle size={12} /> {jobResult.processed} recomputed
                        </span>
                        {jobResult.errors > 0 && (
                          <span className="flex items-center gap-1.5 text-red-500 font-bold bg-red-50 px-2.5 py-1 rounded-full">
                            <AlertCircle size={12} /> {jobResult.errors} errors
                          </span>
                        )}
                      </div>
                    )}
                    {jobError && (
                      <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
                        <AlertCircle size={12} /> {jobError}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={runRecompute}
                    disabled={jobLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-sm flex-shrink-0"
                  >
                    {jobLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                    {jobLoading ? "Running…" : "Recompute All Clocks"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                  <BookOpen size={15} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Prediction Method Configuration</p>
                  <p className="text-xs text-gray-400 font-medium">How each tier works — display only</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    tier: "Tier 1", name: "Cold-Start", color: "blue",
                    icon: "🌱",
                    desc: "Used for new customers with fewer than 2 orders. Bases prediction on the median inter-order gap for the product category.",
                    params: [
                      { label: "Min orders required", value: "< 2" },
                      { label: "Source", value: "Category median" },
                      { label: "Confidence", value: "30–50%" },
                    ],
                  },
                  {
                    tier: "Tier 2", name: "Blended", color: "violet",
                    icon: "⚖️",
                    desc: "Weighted average of cold-start and empirical predictions. Applied when the customer has 2–4 orders.",
                    params: [
                      { label: "Order range", value: "2–4 orders" },
                      { label: "Blend weight", value: "0.4 personal / 0.6 category" },
                      { label: "Confidence", value: "50–75%" },
                    ],
                  },
                  {
                    tier: "Tier 3", name: "Empirical", color: "emerald",
                    icon: "📊",
                    desc: "Personal median gap computed from the customer's own order history. Most accurate — used once 5+ orders exist.",
                    params: [
                      { label: "Min orders", value: "5+" },
                      { label: "Source", value: "Personal median gap" },
                      { label: "Confidence", value: "75–95%" },
                    ],
                  },
                ].map(({ tier, name, color, icon, desc, params }) => (
                  <div key={tier} className={`border border-${color}-100 bg-${color}-50/40 rounded-xl p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">{icon}</span>
                      <div>
                        <p className={`text-[9px] font-black text-${color}-600 uppercase tracking-wider`}>{tier}</p>
                        <p className="text-sm font-bold text-gray-900">{name}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed mb-3">{desc}</p>
                    <div className="space-y-1.5">
                      {params.map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between text-[10px]">
                          <span className="text-gray-400 font-medium">{label}</span>
                          <span className={`font-bold text-${color}-700 bg-${color}-100 px-1.5 py-0.5 rounded`}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
                  <Database size={14} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-gray-900">Runtime Configuration</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "API Server",    value: "http://localhost:5050" },
                  { label: "Simulator",     value: "http://localhost:5001" },
                  { label: "Database",      value: "MongoMemoryServer (dev)" },
                  { label: "Auth",          value: "JWT HS256 — 7d expiry" },
                  { label: "Webhook HMAC",  value: "SIM_WEBHOOK_SECRET env var" },
                  { label: "AI Provider",   value: "OpenAI (+ rule-based fallback)" },
                  { label: "Next.js",       value: "v15 — pages router" },
                  { label: "Node.js",       value: "v20+ required" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-xs text-gray-700 font-mono font-medium">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "api" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <Code2 size={14} className="text-blue-600 flex-shrink-0" />
              <p className="text-xs text-blue-700 font-medium">
                Base URL: <code className="font-mono font-bold">http://localhost:5050/api</code> — All protected routes require{" "}
                <code className="font-mono font-bold">Authorization: Bearer &lt;token&gt;</code>
              </p>
            </div>
            {API_GROUPS.map(({ group, endpoints }) => (
              <div key={group} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-bold text-gray-900">{group}</p>
                  <span className="text-[10px] bg-gray-100 text-gray-500 font-bold px-1.5 py-0.5 rounded-full">{endpoints.length}</span>
                </div>
                <div className="space-y-2">
                  {endpoints.map((ep) => <EndpointRow key={ep.method + ep.path} ep={ep} />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "architecture" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
              <FileText size={14} className="text-amber-600 flex-shrink-0" />
              <p className="text-xs text-amber-700 font-medium">
                10 Architecture Decision Records documenting key design choices. Status: <span className="font-bold">Accepted</span>.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
              {ADR_LIST.map((adr) => <AdrCard key={adr.id} adr={adr} />)}
            </div>
          </div>
        )}

        {tab === "validation" && (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-100 rounded-xl">
              <Shield size={14} className="text-violet-600 flex-shrink-0" />
              <p className="text-xs text-violet-700 font-medium">
                All POST/PATCH endpoints validate request bodies with Zod. Invalid requests return{" "}
                <code className="font-mono font-bold">HTTP 400</code> with structured error details.
              </p>
            </div>

            <div className="space-y-4">
              {ZOD_SCHEMAS.map((schema) => (
                <SchemaBlock key={schema.name} schema={schema} />
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={14} className="text-red-500" />
                <p className="text-sm font-bold text-gray-900">Validation Error Response Format</p>
              </div>
              <p className="text-xs text-gray-400 font-medium mb-3">
                All validation failures return HTTP 400 with this envelope shape:
              </p>
              <pre className="bg-gray-900 rounded-xl p-4 text-[11px] font-mono leading-relaxed overflow-x-auto">
                {VALIDATION_ERROR_EXAMPLE.split("\n").map((line, i) => {
                  return (
                    <span key={i} className="block">
                      {line.split(/("[\w]+":|"[^"]*"|\btrue\b|\bfalse\b|\bnull\b|\d+)/).map((part, j) => {
                        if (/^"[\w]+":\s*$/.test(part + " ") || /^"[\w]+":$/.test(part)) return <span key={j} className="text-blue-300">{part}</span>;
                        if (/^"[^"]*"$/.test(part)) return <span key={j} className="text-amber-300">{part}</span>;
                        if (/^(true|false|null)$/.test(part)) return <span key={j} className="text-violet-400">{part}</span>;
                        if (/^\d+$/.test(part)) return <span key={j} className="text-green-400">{part}</span>;
                        return <span key={j} className="text-gray-300">{part}</span>;
                      })}
                    </span>
                  );
                })}
              </pre>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { code: "invalid_type",   desc: "Wrong data type (e.g. string where number expected)" },
                  { code: "too_small",      desc: "Value below minimum length, value, or array size" },
                  { code: "invalid_enum_value", desc: "Value not in the allowed enum set" },
                ].map(({ code, desc }) => (
                  <div key={code} className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-[10px] font-mono font-bold text-red-600 mb-0.5">{code}</p>
                    <p className="text-[10px] text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </CrmLayout>
  );
}
