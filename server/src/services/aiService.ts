/**
 * AI Service — Google Gemini with JSON-mode structured output + rule-based fallbacks.
 *
 * Three structured capabilities:
 *  1. nlToAudienceFilter  — natural language → IAudienceFilter
 *  2. goalToCampaign      — marketing goal → campaign proposal
 *  3. draftMessage        — channel + goal → message template
 *
 * All three degrade gracefully when GEMINI_API_KEY is absent or the call fails.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type { IAudienceFilter } from "./audience";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
const MODEL = "gemini-2.5-flash";

// ── Shared zod schemas ────────────────────────────────────────────────────────

export const AudienceFilterSchema = z.object({
  segments: z
    .array(z.enum(["high-ltv", "loyal", "at-risk", "new", "growing", "inactive"]))
    .optional(),
  tags:               z.array(z.string()).optional(),
  channelOptIn:       z.enum(["whatsapp", "sms", "email", "rcs"]).optional(),
  minLtv:             z.number().optional(),
  maxLtv:             z.number().optional(),
  minOrderCount:      z.number().optional(),
  maxDaysUntilRunout: z.number().optional(),
  lastOrderDaysMax:   z.number().optional(),
  lastOrderDaysMin:   z.number().optional(),
});

export const CampaignProposalSchema = z.object({
  name:             z.string().min(1),
  goal:             z.string().min(1),
  channel:          z.enum(["whatsapp", "sms", "email", "rcs"]),
  messageTemplate:  z.string().min(1),
  frequencyCapDays: z.number().int().min(1).default(7),
  rationale:        z.string(),
});

export const MessageTemplateSchema = z.object({
  subject: z.string().optional(),
  body:    z.string().min(1),
  cta:     z.string().optional(),
});

export type CampaignProposal = z.infer<typeof CampaignProposalSchema>;
export type MessageTemplate  = z.infer<typeof MessageTemplateSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function zodFieldToJson(field: z.ZodTypeAny): Record<string, unknown> {
  if (field instanceof z.ZodString)  return { type: "string" };
  if (field instanceof z.ZodNumber)  return { type: "number" };
  if (field instanceof z.ZodBoolean) return { type: "boolean" };
  if (field instanceof z.ZodDefault) return zodFieldToJson(field._def.innerType as z.ZodTypeAny);
  if (field instanceof z.ZodEnum)    return { type: "string", enum: field.options as string[] };
  if (field instanceof z.ZodArray)   return { type: "array", items: zodFieldToJson(field.element) };
  return { type: "string" };
}

function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(schema.shape)) {
    const inner = val instanceof z.ZodOptional ? val.unwrap() : (val as z.ZodTypeAny);
    properties[key] = zodFieldToJson(inner);
  }
  return { type: "object", properties };
}

// Strips markdown code fences Gemini sometimes adds even in JSON mode
function extractJSON(text: string): string {
  return text
    .replace(/^```(?:json)?\n?/i, "")
    .replace(/\n?```$/i, "")
    .trim();
}

async function callWithJSON<T>(
  prompt:   string,
  schema:   z.ZodObject<z.ZodRawShape>,
  parse:    (raw: unknown) => T,
  fallback: () => T,
): Promise<T> {
  if (!process.env.GEMINI_API_KEY) return fallback();

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const schemaStr = JSON.stringify(zodToJsonSchema(schema), null, 2);
    const fullPrompt = `${prompt}\n\nRespond with ONLY valid JSON that exactly matches this schema (no explanation, no markdown):\n${schemaStr}`;

    const result = await model.generateContent(fullPrompt);
    const text   = extractJSON(result.response.text());
    const raw    = JSON.parse(text) as unknown;
    return parse(raw);
  } catch (err) {
    console.error("[aiService] Gemini call failed:", err);
    return fallback();
  }
}

// ── 1. NL → Audience filter ───────────────────────────────────────────────────

function fallbackAudienceFilter(nl: string): IAudienceFilter {
  const t = nl.toLowerCase();
  const filter: IAudienceFilter = {};

  if (t.includes("loyal"))                                    filter.segments = ["loyal"];
  else if (t.includes("at-risk") || t.includes("at risk"))    filter.segments = ["at-risk"];
  else if (t.includes("high") && t.includes("ltv"))           filter.segments = ["high-ltv"];
  else if (t.includes("inactive"))                            filter.segments = ["inactive"];
  else if (t.includes("new"))                                 filter.segments = ["new"];

  if (t.includes("dog"))      filter.tags = ["dog-owner"];
  else if (t.includes("cat")) filter.tags = ["cat-owner"];

  if (t.includes("whatsapp"))       filter.channelOptIn = "whatsapp";
  else if (t.includes("email"))     filter.channelOptIn = "email";
  else if (t.includes("sms"))       filter.channelOptIn = "sms";

  const runoutMatch = t.match(/runout.{0,10}(\d+)\s*day/);
  if (runoutMatch) filter.maxDaysUntilRunout = parseInt(runoutMatch[1], 10);

  const ltvMatch = t.match(/ltv[^\d]*(\d+)/);
  if (ltvMatch) filter.minLtv = parseInt(ltvMatch[1], 10);

  return filter;
}

export async function nlToAudienceFilter(prompt: string): Promise<IAudienceFilter> {
  return callWithJSON(
    `Convert this marketing description into a structured audience filter:\n"${prompt}"\n\nReturn only the fields that apply. Omit fields not mentioned.`,
    AudienceFilterSchema,
    (raw) => AudienceFilterSchema.parse(raw),
    () => fallbackAudienceFilter(prompt),
  );
}

// ── 2. Goal → Campaign proposal ───────────────────────────────────────────────

function fallbackCampaignProposal(goal: string): CampaignProposal {
  const t = goal.toLowerCase();
  const channel: CampaignProposal["channel"] = t.includes("email") ? "email"
    : t.includes("sms") ? "sms"
    : t.includes("rcs") ? "rcs"
    : "whatsapp";

  const name = goal.length > 60 ? goal.slice(0, 57) + "..." : goal;
  const messageTemplate = t.includes("discount") || t.includes("offer")
    ? "Hi {{name}}, we have a special offer just for you! Use code PAWKIT10 for 10% off your next order. Shop now: {{link}}"
    : t.includes("runout") || t.includes("reorder")
    ? "Hi {{name}}, it looks like {{pet_name}}'s food might be running low. Reorder now: {{link}}"
    : "Hi {{name}}, we miss you at PawKit! Check out what's new for {{pet_name}}: {{link}}";

  return {
    name,
    goal,
    channel,
    messageTemplate,
    frequencyCapDays: 7,
    rationale: "Rule-based fallback — Gemini API key not configured.",
  };
}

export async function goalToCampaign(
  goal: string,
  audienceSummary: string,
): Promise<CampaignProposal> {
  const prompt = `
You are a CRM marketer for PawKit, a pet care e-commerce platform in India.
Create a campaign proposal for the following goal:
"${goal}"

Target audience: ${audienceSummary}

Choose the best channel (whatsapp, sms, email, rcs), write a short message template
(use {{name}}, {{pet_name}}, {{link}} as placeholders), and explain your rationale.
Keep the message under 160 characters for sms, or under 300 for other channels.
`.trim();

  return callWithJSON(
    prompt,
    CampaignProposalSchema,
    (raw) => CampaignProposalSchema.parse(raw),
    () => fallbackCampaignProposal(goal),
  );
}

// ── 3. Message template drafting ──────────────────────────────────────────────

function fallbackMessageTemplate(channel: string, goal: string): MessageTemplate {
  const t = goal.toLowerCase();

  if (channel === "email") {
    return {
      subject: t.includes("reorder") ? "Time to restock {{pet_name}}'s food!"
              : t.includes("discount") ? "A special offer just for you"
              : "We miss you at PawKit!",
      body: `Hi {{name}},\n\n${
        t.includes("reorder")
          ? "It looks like {{pet_name}} might be running low on food. Reorder now to avoid gaps in their daily routine."
          : t.includes("discount")
          ? "As a valued PawKit customer, we're offering you 10% off your next order. Use code PAWKIT10 at checkout."
          : "We noticed it's been a while since your last order. {{pet_name}} misses their favourite treats!"
      }\n\nShop now: {{link}}\n\nThe PawKit Team`,
      cta: "Shop Now",
    };
  }

  const body = t.includes("reorder")
    ? "Hi {{name}}! {{pet_name}}'s food might be running out. Reorder now: {{link}}"
    : t.includes("discount")
    ? "Hi {{name}}! 10% off for you today. Use PAWKIT10 → {{link}}"
    : "Hi {{name}}, we miss you! Shop for {{pet_name}}: {{link}}";

  return { body, cta: "Order now" };
}

export async function draftMessage(
  channel: string,
  goal: string,
  audienceSummary?: string,
): Promise<MessageTemplate> {
  const charLimit = channel === "sms" ? "160" : "300";
  const prompt = `
Draft a ${channel} marketing message for PawKit (Indian pet care brand).
Goal: "${goal}"${audienceSummary ? `\nAudience: ${audienceSummary}` : ""}

${channel === "email"
  ? "Include a subject line, body (2-4 sentences), and a CTA button label."
  : `Write a single short message under ${charLimit} characters. Include a CTA.`}

Use these placeholders: {{name}}, {{pet_name}}, {{link}}.
Return: subject (email only), body, cta.
`.trim();

  return callWithJSON(
    prompt,
    MessageTemplateSchema,
    (raw) => MessageTemplateSchema.parse(raw),
    () => fallbackMessageTemplate(channel, goal),
  );
}

// ── Legacy: pet care advice (kept for existing routes) ───────────────────────

export async function getPetCareAdvice(question: string, petContext?: string): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "AI pet care advice is not configured. Please consult your veterinarian.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const systemContext =
      "You are a helpful pet care assistant. Provide clear, accurate advice about pet health, nutrition, and care. Always recommend consulting a veterinarian for medical concerns.";

    const userContent = petContext
      ? `Context about my pet: ${petContext}\n\n${question}`
      : question;

    const result = await model.generateContent(`${systemContext}\n\n${userContent}`);
    return result.response.text() || "I could not generate a response.";
  } catch {
    return "AI advice is temporarily unavailable. Please consult your veterinarian.";
  }
}
