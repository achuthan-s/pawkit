import { useState, useCallback } from "react";
import { useRouter } from "next/router";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  Brain,
  Search,
  Target,
  MessageSquare,
  Loader2,
  Sparkles,
  Copy,
  Check,
  ChevronRight,
  Info,
  Users,
  Pencil,
  Send,
  ArrowRight,
} from "lucide-react";
import api from "@/lib/api";

type Tab = "audience" | "campaign" | "message";

interface AudienceFilter {
  segments?: string[];
  tags?: string[];
  channelOptIn?: string;
  minLtv?: number;
  maxDaysUntilRunout?: number;
  lastOrderDaysMax?: number;
  [key: string]: unknown;
}

interface AudienceResult {
  total: number;
  channelBreakdown: Record<string, number>;
}

interface CampaignProposal {
  name: string;
  goal: string;
  channel: string;
  messageTemplate: string;
  frequencyCapDays: number;
  rationale: string;
}

interface MessageTemplate {
  subject?: string;
  body: string;
  cta?: string;
}

const TABS: { id: Tab; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: "audience",
    label: "NL → Audience",
    icon: <Search size={14} />,
    desc: "Natural language to audience filter",
  },
  {
    id: "campaign",
    label: "Goal → Campaign",
    icon: <Target size={14} />,
    desc: "Marketing goal to campaign proposal",
  },
  {
    id: "message",
    label: "Message Draft",
    icon: <MessageSquare size={14} />,
    desc: "Channel-specific message generator",
  },
];

const AUDIENCE_EXAMPLES = [
  "Loyal dog owners opted in to WhatsApp",
  "At-risk customers whose food runs out in 10 days",
  "High-LTV customers who haven't ordered in 30 days",
];

const CAMPAIGN_EXAMPLES = [
  "Re-engage inactive customers with a 10% comeback discount",
  "Remind customers whose pet food is running out soon",
  "Upsell premium food to our most loyal buyers",
];

const CH_EMOJI: Record<string, string> = {
  whatsapp: "💬",
  sms: "📱",
  email: "📧",
  rcs: "🎯",
};

const CH_COLOR: Record<string, string> = {
  whatsapp: "bg-emerald-500",
  sms: "bg-blue-500",
  email: "bg-violet-500",
  rcs: "bg-amber-500",
};

const INFO_TEXT: Record<Tab, { title: string; body: string }> = {
  audience: {
    title: "How NL → Audience works",
    body:
      "Describe your target audience in plain English. The AI extracts structured filter parameters (segments, tags, channel opt-in, LTV thresholds, runout days) and returns a count preview with channel breakdown. Use this to validate your audience before attaching it to a campaign.",
  },
  campaign: {
    title: "How Goal → Campaign works",
    body:
      "Enter a high-level marketing goal. The AI selects the best channel, writes a message template, sets a frequency cap, and explains its reasoning. You can edit the proposal fields before saving it as a draft campaign ready for approval.",
  },
  message: {
    title: "How Message Draft works",
    body:
      "Select a channel and describe what the message should achieve. The AI generates a channel-optimised message with subject (email), body copy, and CTA. Switch on Edit mode to customise the body before copying it to your clipboard.",
  },
};

function FilterTree({ filter }: { filter: AudienceFilter }) {
  const entries = Object.entries(filter).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0)
    return <p className="text-xs text-gray-400 italic">No filters extracted</p>;
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex items-start justify-between gap-3 bg-white border border-gray-100 rounded-xl px-3 py-2"
        >
          <span className="text-xs font-bold text-violet-600 capitalize">
            {key.replace(/([A-Z])/g, " $1").trim()}
          </span>
          <span className="text-xs text-gray-700 font-mono text-right break-all">
            {Array.isArray(value) ? value.join(", ") : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChannelPreview({
  channel,
  subject,
  body,
  cta,
  editMode,
  onBodyChange,
}: {
  channel: string;
  subject?: string;
  body: string;
  cta?: string;
  editMode: boolean;
  onBodyChange: (v: string) => void;
}) {
  if (channel === "email") {
    return (
      <div className="bg-gray-100 rounded-2xl p-4">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 bg-red-400 rounded-full" />
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-full" />
                <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
              </div>
              <div className="flex-1 bg-white border border-gray-200 rounded text-xs text-gray-400 px-2 py-0.5 text-center">
                noreply@pawkit.dev
              </div>
            </div>
          </div>
          <div className="p-4">
            {subject && (
              <p className="text-sm font-bold text-gray-900 mb-3 pb-3 border-b border-gray-100">
                {subject}
              </p>
            )}
            {editMode ? (
              <textarea
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
                rows={5}
                className="w-full text-sm text-gray-700 leading-relaxed resize-none outline-none border border-violet-200 rounded-lg p-2 focus:ring-2 focus:ring-violet-100"
              />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{body}</p>
            )}
            {cta && (
              <div className="mt-4">
                <span className="inline-block px-4 py-2 bg-violet-600 text-white text-xs font-bold rounded-lg">
                  {cta}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (channel === "whatsapp") {
    return (
      <div className="bg-[#e5ddd5] rounded-2xl p-4">
        <div className="flex flex-col items-end gap-2">
          <div className="bg-[#dcf8c6] rounded-2xl rounded-tr-sm px-4 py-3 max-w-xs shadow-sm">
            {editMode ? (
              <textarea
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
                rows={4}
                className="text-sm text-gray-800 leading-relaxed w-full bg-transparent resize-none outline-none"
              />
            ) : (
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{body}</p>
            )}
            {cta && (
              <div className="mt-2 pt-2 border-t border-[#c5e6af]">
                <div className="flex items-center gap-1 text-[#128c7e] text-xs font-bold">
                  <ArrowRight size={12} />
                  {cta}
                </div>
              </div>
            )}
            <p className="text-[10px] text-gray-400 text-right mt-1">
              {new Date().toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              ✓✓
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 rounded-2xl p-4">
      <div className="flex flex-col gap-2">
        <div className="bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1 rounded-full self-start">
          {channel.toUpperCase()}
        </div>
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-xs shadow-sm self-start">
          {editMode ? (
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              rows={4}
              className="text-sm text-gray-800 leading-relaxed w-full bg-transparent resize-none outline-none"
            />
          ) : (
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{body}</p>
          )}
          {cta && (
            <p className="text-xs font-bold text-blue-600 mt-2">{cta}</p>
          )}
          <p className="text-[10px] text-gray-400 mt-1">
            {new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AiStudioPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("audience");
  const [loading, setLoading] = useState(false);

  const [nlPrompt, setNlPrompt] = useState("");
  const [audFilter, setAudFilter] = useState<AudienceFilter | null>(null);
  const [audPreview, setAudPreview] = useState<AudienceResult | null>(null);

  const [campGoal, setCampGoal] = useState("");
  const [campSummary, setCampSummary] = useState("");
  const [proposal, setProposal] = useState<CampaignProposal | null>(null);
  const [editedProposal, setEditedProposal] = useState<CampaignProposal | null>(null);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [savedCampaign, setSavedCampaign] = useState(false);

  const [msgChannel, setMsgChannel] = useState("whatsapp");
  const [msgGoal, setMsgGoal] = useState("");
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const [copied, setCopied] = useState(false);

  const runAudience = useCallback(async () => {
    if (!nlPrompt.trim()) return;
    setLoading(true);
    setAudFilter(null);
    setAudPreview(null);
    try {
      const { data } = await api.post<{
        data: { filter: AudienceFilter; preview: AudienceResult };
      }>("/ai/audience", { prompt: nlPrompt });
      setAudFilter(data.data.filter);
      setAudPreview(data.data.preview);
    } catch {}
    setLoading(false);
  }, [nlPrompt]);

  const runCampaign = useCallback(async () => {
    if (!campGoal.trim()) return;
    setLoading(true);
    setProposal(null);
    setEditedProposal(null);
    setSavedCampaign(false);
    try {
      const { data } = await api.post<{ data: CampaignProposal }>("/ai/campaign", {
        goal: campGoal,
        audienceSummary: campSummary || undefined,
      });
      setProposal(data.data);
      setEditedProposal(data.data);
    } catch {}
    setLoading(false);
  }, [campGoal, campSummary]);

  const runMessage = useCallback(async () => {
    if (!msgGoal.trim()) return;
    setLoading(true);
    setTemplate(null);
    setEditMode(false);
    setCopied(false);
    try {
      const { data } = await api.post<{ data: MessageTemplate }>("/ai/message", {
        channel: msgChannel,
        goal: msgGoal,
      });
      setTemplate(data.data);
      setEditedBody(data.data.body);
    } catch {}
    setLoading(false);
  }, [msgChannel, msgGoal]);

  async function saveDraftCampaign() {
    if (!editedProposal) return;
    setSavingCampaign(true);
    try {
      await api.post("/campaigns", {
        name: editedProposal.name.slice(0, 60),
        goal: campGoal,
        channel: editedProposal.channel,
        messageTemplate: editedProposal.messageTemplate,
        frequencyCapDays: editedProposal.frequencyCapDays ?? 7,
        targetAudience: {},
      });
      setSavedCampaign(true);
    } catch {}
    setSavingCampaign(false);
  }

  async function copyToClipboard() {
    const text = [
      template?.subject ? `Subject: ${template.subject}` : "",
      editMode ? editedBody : template?.body ?? "",
      template?.cta ? `CTA: ${template.cta}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <CrmLayout
      title="AI Studio"
      subtitle="Three AI tools: audience resolution, campaign generation, and message drafting"
    >
      <div className="p-8 max-w-7xl mx-auto space-y-6">

        <div className="flex gap-1.5 bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                tab === t.id
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "audience" && (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Brain size={16} className="text-violet-500" />
                  <p className="text-sm font-bold text-gray-800">Describe your audience</p>
                </div>
                <textarea
                  rows={4}
                  value={nlPrompt}
                  onChange={(e) => setNlPrompt(e.target.value)}
                  placeholder="e.g. loyal dog owners opted in to WhatsApp"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                />
                <div className="mt-3 space-y-1.5">
                  {AUDIENCE_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setNlPrompt(ex)}
                      className="w-full text-xs text-left px-3 py-1.5 bg-gray-50 hover:bg-violet-50 hover:text-violet-700 text-gray-500 border border-gray-100 hover:border-violet-200 rounded-lg transition-all"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <button
                  onClick={runAudience}
                  disabled={!nlPrompt.trim() || loading}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {loading ? "Resolving…" : "Resolve Audience"}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-700 mb-1">
                      {INFO_TEXT.audience.title}
                    </p>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      {INFO_TEXT.audience.body}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              {!audFilter && !loading && (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
                  <Users size={36} />
                  <p className="text-sm font-medium">Audience filters appear here</p>
                  <p className="text-xs">Enter a description and click Resolve</p>
                </div>
              )}
              {loading && (
                <div className="border-2 border-dashed border-violet-200 rounded-2xl flex flex-col items-center justify-center py-20 text-violet-300 gap-2">
                  <Loader2 size={28} className="animate-spin" />
                  <p className="text-sm font-medium">Analysing prompt…</p>
                </div>
              )}
              {audFilter && !loading && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Extracted Audience Filters
                    </p>
                    <FilterTree filter={audFilter} />
                  </div>

                  {audPreview && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                        Audience Preview
                      </p>
                      <div className="flex items-end gap-2 mb-5">
                        <p className="text-4xl font-bold text-violet-600">
                          {audPreview.total}
                        </p>
                        <p className="text-sm text-gray-400 font-medium pb-1">customers matched</p>
                      </div>
                      <div className="space-y-2.5">
                        {Object.entries(audPreview.channelBreakdown).map(([ch, count]) => {
                          const pct =
                            audPreview.total > 0
                              ? Math.round(((count as number) / audPreview.total) * 100)
                              : 0;
                          return (
                            <div key={ch}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-600 capitalize flex items-center gap-1.5">
                                  <span>{CH_EMOJI[ch] ?? "📢"}</span> {ch}
                                </span>
                                <span className="text-xs font-bold text-gray-700">
                                  {count as number}{" "}
                                  <span className="text-gray-400 font-normal">({pct}%)</span>
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full ${CH_COLOR[ch] ?? "bg-gray-400"}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-2 mt-5">
                        <button
                          onClick={() => router.push("/crm/audience")}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all"
                        >
                          <Users size={12} />
                          Save to Audience Builder
                        </button>
                        <button
                          onClick={() => {
                            setTab("campaign");
                            setCampSummary(
                              `${audPreview.total} customers — ${Object.entries(
                                audPreview.channelBreakdown
                              )
                                .map(([ch, n]) => `${n} via ${ch}`)
                                .join(", ")}`
                            );
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all"
                        >
                          <ArrowRight size={12} />
                          Use for Campaign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "campaign" && (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Campaign Goal
                  </label>
                  <textarea
                    rows={3}
                    value={campGoal}
                    onChange={(e) => setCampGoal(e.target.value)}
                    placeholder="e.g. Re-engage inactive customers with a 10% comeback discount"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                  />
                  <div className="mt-2 space-y-1.5">
                    {CAMPAIGN_EXAMPLES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => setCampGoal(ex)}
                        className="w-full text-xs text-left px-3 py-1.5 bg-gray-50 hover:bg-violet-50 hover:text-violet-700 text-gray-500 border border-gray-100 hover:border-violet-200 rounded-lg transition-all"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Audience Summary{" "}
                    <span className="text-gray-300 font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    value={campSummary}
                    onChange={(e) => setCampSummary(e.target.value)}
                    placeholder="e.g. 68 inactive customers, last ordered 60+ days ago"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  onClick={runCampaign}
                  disabled={!campGoal.trim() || loading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Target size={14} />
                  )}
                  {loading ? "Generating…" : "Generate Campaign"}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-700 mb-1">
                      {INFO_TEXT.campaign.title}
                    </p>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      {INFO_TEXT.campaign.body}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              {!proposal && !loading && (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
                  <Target size={36} />
                  <p className="text-sm font-medium">Campaign proposal appears here</p>
                  <p className="text-xs">All fields are editable before saving</p>
                </div>
              )}
              {loading && (
                <div className="border-2 border-dashed border-violet-200 rounded-2xl flex flex-col items-center justify-center py-20 text-violet-300 gap-2">
                  <Loader2 size={28} className="animate-spin" />
                  <p className="text-sm font-medium">Generating campaign plan…</p>
                </div>
              )}
              {editedProposal && !loading && (
                <div className="bg-white rounded-2xl border border-violet-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={15} className="text-violet-500" />
                    <p className="text-sm font-bold text-gray-900">Campaign Proposal</p>
                    <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      Editable
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      Campaign Name
                    </label>
                    <input
                      value={editedProposal.name}
                      onChange={(e) =>
                        setEditedProposal({ ...editedProposal, name: e.target.value })
                      }
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Channel
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {["whatsapp", "sms", "email", "rcs"].map((ch) => (
                          <button
                            key={ch}
                            onClick={() =>
                              setEditedProposal({ ...editedProposal, channel: ch })
                            }
                            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                              editedProposal.channel === ch
                                ? "bg-violet-600 text-white border-violet-600"
                                : "text-gray-500 border-gray-200 hover:border-violet-300"
                            }`}
                          >
                            {CH_EMOJI[ch]} {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                        Frequency Cap (days)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={90}
                        value={editedProposal.frequencyCapDays}
                        onChange={(e) =>
                          setEditedProposal({
                            ...editedProposal,
                            frequencyCapDays: parseInt(e.target.value) || 7,
                          })
                        }
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
                      Message Template
                    </label>
                    <textarea
                      rows={4}
                      value={editedProposal.messageTemplate}
                      onChange={(e) =>
                        setEditedProposal({
                          ...editedProposal,
                          messageTemplate: e.target.value,
                        })
                      }
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                    <p className="text-xs font-bold text-violet-600 mb-1.5">AI Rationale</p>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {editedProposal.rationale}
                    </p>
                  </div>

                  {savedCampaign ? (
                    <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold rounded-xl">
                      <Check size={14} />
                      Saved as draft campaign
                    </div>
                  ) : (
                    <button
                      onClick={saveDraftCampaign}
                      disabled={savingCampaign}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all"
                    >
                      {savingCampaign ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Send size={13} />
                      )}
                      {savingCampaign ? "Saving…" : "Save as Draft Campaign"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "message" && (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                    Channel
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {["whatsapp", "sms", "email", "rcs"].map((ch) => (
                      <button
                        key={ch}
                        onClick={() => setMsgChannel(ch)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-bold transition-all ${
                          msgChannel === ch
                            ? "bg-violet-600 text-white border-violet-600 shadow-sm shadow-violet-200"
                            : "text-gray-500 border-gray-200 hover:border-violet-200 hover:bg-violet-50"
                        }`}
                      >
                        <span className="text-lg">{CH_EMOJI[ch]}</span>
                        <span className="capitalize">{ch}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    Message Goal
                  </label>
                  <input
                    value={msgGoal}
                    onChange={(e) => setMsgGoal(e.target.value)}
                    placeholder="e.g. reorder reminder for pet food"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  onClick={runMessage}
                  disabled={!msgGoal.trim() || loading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all"
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <MessageSquare size={14} />
                  )}
                  {loading ? "Drafting…" : "Draft Message"}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-start gap-2">
                  <Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-blue-700 mb-1">
                      {INFO_TEXT.message.title}
                    </p>
                    <p className="text-xs text-blue-600 leading-relaxed">
                      {INFO_TEXT.message.body}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-3">
              {!template && !loading && (
                <div className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center py-20 text-gray-300 gap-2">
                  <MessageSquare size={36} />
                  <p className="text-sm font-medium">Message preview appears here</p>
                  <p className="text-xs">Select a channel, enter a goal and click Draft</p>
                </div>
              )}
              {loading && (
                <div className="border-2 border-dashed border-violet-200 rounded-2xl flex flex-col items-center justify-center py-20 text-violet-300 gap-2">
                  <Loader2 size={28} className="animate-spin" />
                  <p className="text-sm font-medium">Writing message…</p>
                </div>
              )}
              {template && !loading && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{CH_EMOJI[msgChannel]}</span>
                      <p className="text-sm font-bold text-gray-900 capitalize">
                        {msgChannel} Preview
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditMode(!editMode)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          editMode
                            ? "bg-violet-600 text-white border-violet-600"
                            : "text-gray-500 border-gray-200 hover:border-violet-200"
                        }`}
                      >
                        <Pencil size={11} />
                        Edit
                      </button>
                      <button
                        onClick={copyToClipboard}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-all"
                      >
                        {copied ? (
                          <Check size={11} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} />
                        )}
                        {copied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  {template.subject && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2 flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Subject
                      </span>
                      <ChevronRight size={12} className="text-gray-300" />
                      <span className="text-sm font-semibold text-gray-800">
                        {template.subject}
                      </span>
                    </div>
                  )}

                  <ChannelPreview
                    channel={msgChannel}
                    subject={template.subject}
                    body={editMode ? editedBody : template.body}
                    cta={template.cta}
                    editMode={editMode}
                    onBodyChange={setEditedBody}
                  />

                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Placeholders
                    </span>
                    {["{{name}}", "{{pet_name}}", "{{link}}", "{{product}}"].map((p) => (
                      <span
                        key={p}
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CrmLayout>
  );
}
