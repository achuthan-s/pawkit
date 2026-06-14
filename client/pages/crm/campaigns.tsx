import { useState, useEffect, useCallback } from "react";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  Wand2, Sparkles, RefreshCcw, Send, Loader2, CheckCircle, XCircle,
  Play, BarChart2, Clock, ChevronDown, ChevronUp, TrendingUp, Users,
  Megaphone, AlertCircle,
} from "lucide-react";
import api from "@/lib/api";

interface Campaign {
  _id: string;
  name: string;
  goal: string;
  channel: string;
  status: string;
  audienceCount: number;
  messageTemplate: string;
  frequencyCapDays: number;
  stats: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
  };
  createdAt: string;
}

interface DispatchResult {
  resolved: number;
  dispatched: number;
  excluded: number;
  breakdown: { optedOut: number; frequencyCapped: number };
  exclusions: Array<{ customerId: string; name: string; reason: string }>;
}

type StatusTab = "all" | "pending_approval" | "approved" | "running" | "completed";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  approved: "Approved",
  running: "Running",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  running: "bg-emerald-100 text-emerald-700",
  completed: "bg-violet-100 text-violet-700",
  cancelled: "bg-red-100 text-red-600",
};

const CH_EMOJI: Record<string, string> = {
  whatsapp: "💬",
  sms: "📱",
  email: "📧",
  rcs: "🎯",
};

const EXAMPLE_GOALS = [
  "Win back customers who haven't ordered in 45 days",
  "Remind customers whose pet food is running out soon",
  "Upsell premium products to repeat buyers",
];

const STATUS_TABS: { id: StatusTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending_approval", label: "Pending Approval" },
  { id: "approved", label: "Approved" },
  { id: "running", label: "Running" },
  { id: "completed", label: "Completed" },
];

function StatBar({
  sent,
  delivered,
  opened,
  clicked,
}: {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
}) {
  const steps = [
    { label: "Sent", value: sent, color: "bg-blue-400" },
    { label: "Delivered", value: delivered, color: "bg-cyan-400" },
    { label: "Opened", value: opened, color: "bg-violet-400" },
    { label: "Clicked", value: clicked, color: "bg-amber-400" },
  ];
  return (
    <div className="flex items-center gap-3 mt-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300 text-xs">→</span>}
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-xs text-gray-500">{s.label}</span>
            <span className="text-xs font-bold text-gray-700">{s.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FunnelView({ stats }: { stats: Campaign["stats"] }) {
  const steps = [
    { label: "Sent", value: stats.sent, color: "bg-blue-500" },
    { label: "Delivered", value: stats.delivered, color: "bg-cyan-500" },
    { label: "Opened", value: stats.opened, color: "bg-violet-500" },
    { label: "Clicked", value: stats.clicked, color: "bg-amber-500" },
    { label: "Converted", value: stats.converted, color: "bg-emerald-500" },
  ];
  const max = stats.sent || 1;
  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-16 text-right">{step.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full ${step.color} transition-all`}
              style={{ width: `${Math.min(100, (step.value / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-700 w-10">{step.value}</span>
          <span className="text-xs text-gray-400 w-10">
            {max > 0 ? `${Math.round((step.value / max) * 100)}%` : "0%"}
          </span>
        </div>
      ))}
      {stats.revenue > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <TrendingUp size={13} className="text-emerald-500" />
          <span className="text-xs text-gray-500">Attributed Revenue</span>
          <span className="text-sm font-bold text-emerald-600">
            ₹{stats.revenue.toLocaleString("en-IN")}
          </span>
        </div>
      )}
    </div>
  );
}

function DispatchModal({
  result,
  onClose,
}: {
  result: DispatchResult;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 z-10">
        <div className="text-center mb-6">
          {result.dispatched > 0 ? (
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-emerald-600" />
            </div>
          ) : (
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={28} className="text-amber-600" />
            </div>
          )}
          <h3 className="text-xl font-bold text-gray-900">
            {result.dispatched > 0 ? "Campaign Launched!" : "Launch Blocked by Guardrails"}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {result.dispatched > 0
              ? "Messages are being dispatched to your audience."
              : "All recipients were excluded by safety rules."}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Resolved", value: result.resolved, color: "text-gray-700" },
            {
              label: "Dispatched",
              value: result.dispatched,
              color: result.dispatched > 0 ? "text-emerald-600" : "text-amber-600",
            },
            { label: "Excluded", value: result.excluded, color: "text-gray-500" },
          ].map((s) => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-400 font-medium mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {result.excluded > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Exclusion Breakdown
            </p>
            <div className="space-y-2">
              {result.breakdown.optedOut > 0 && (
                <div className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <XCircle size={13} className="text-red-500" />
                    <span className="text-xs font-semibold text-red-700">Opted out</span>
                  </div>
                  <span className="text-xs font-bold text-red-600">{result.breakdown.optedOut}</span>
                </div>
              )}
              {result.breakdown.frequencyCapped > 0 && (
                <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Clock size={13} className="text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700">Frequency capped</span>
                  </div>
                  <span className="text-xs font-bold text-amber-600">
                    {result.breakdown.frequencyCapped}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {result.exclusions.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
              Exclusion Detail
            </p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {result.exclusions.slice(0, 8).map((ex, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                  <XCircle size={11} className="text-amber-400 flex-shrink-0" />
                  <span className="font-semibold">{ex.name}</span>
                  <span className="text-gray-400">—</span>
                  <span className="text-gray-500">{ex.reason}</span>
                </div>
              ))}
              {result.exclusions.length > 8 && (
                <p className="text-xs text-gray-400 pl-4">
                  +{result.exclusions.length - 8} more
                </p>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-xl transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function CampaignCard({
  campaign,
  onSubmit,
  onApprove,
  onLaunch,
  isActing,
}: {
  campaign: Campaign;
  onSubmit: (id: string) => void;
  onApprove: (id: string) => void;
  onLaunch: (id: string) => void;
  isActing: boolean;
}) {
  const [showStats, setShowStats] = useState(false);
  const sent = campaign.stats.sent || 0;
  const delivered = campaign.stats.delivered || 0;
  const deliveryPct = sent > 0 ? Math.round((delivered / sent) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">{CH_EMOJI[campaign.channel] ?? "📢"}</span>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate">{campaign.name}</p>
              <p className="text-xs text-gray-400 truncate mt-0.5">{campaign.goal}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[campaign.status]}`}
            >
              {STATUS_LABEL[campaign.status] ?? campaign.status}
            </span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 mb-3">
          <p className="text-xs text-gray-500 font-mono leading-relaxed line-clamp-2">
            {campaign.messageTemplate}
          </p>
        </div>

        <StatBar
          sent={campaign.stats.sent}
          delivered={campaign.stats.delivered}
          opened={campaign.stats.opened}
          clicked={campaign.stats.clicked}
        />

        {sent > 0 && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Delivery rate</span>
              <span className="font-bold text-gray-600">{deliveryPct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-cyan-400 h-1.5 rounded-full transition-all"
                style={{ width: `${deliveryPct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-400">
            {new Date(campaign.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {" · "}cap {campaign.frequencyCapDays}d
          </p>
          <div className="flex items-center gap-2">
            {campaign.status === "draft" && (
              <button
                onClick={() => onSubmit(campaign._id)}
                disabled={isActing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all"
              >
                {isActing ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Submit for Approval
              </button>
            )}
            {campaign.status === "pending_approval" && (
              <button
                onClick={() => onApprove(campaign._id)}
                disabled={isActing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all"
              >
                {isActing ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <CheckCircle size={11} />
                )}
                Approve
              </button>
            )}
            {campaign.status === "approved" && (
              <button
                onClick={() => onLaunch(campaign._id)}
                disabled={isActing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition-all"
              >
                {isActing ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Play size={11} />
                )}
                {isActing ? "Dispatching…" : "Launch"}
              </button>
            )}
            {(campaign.status === "running" || campaign.status === "completed") && (
              <button
                onClick={() => setShowStats(!showStats)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-bold rounded-xl transition-all border border-violet-200"
              >
                <BarChart2 size={11} />
                View Stats
                {showStats ? (
                  <ChevronUp size={11} />
                ) : (
                  <ChevronDown size={11} />
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {showStats && (
        <div className="border-t border-gray-100 bg-gray-50/50 p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
            Campaign Funnel
          </p>
          <FunnelView stats={campaign.stats} />
        </div>
      )}
    </div>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StatusTab>("all");

  const [builderOpen, setBuilderOpen] = useState(true);
  const [goal, setGoal] = useState("");
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<{
    name: string;
    channel: string;
    messageTemplate: string;
    rationale: string;
    frequencyCapDays: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const [actionId, setActionId] = useState<string | null>(null);
  const [dispatchResult, setDispatchResult] = useState<DispatchResult | null>(null);

  const loadCampaigns = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Campaign[] }>("/campaigns");
      setCampaigns(data.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  async function generatePlan() {
    if (!goal.trim()) return;
    setGenerating(true);
    setPlan(null);
    try {
      const { data } = await api.post<{ data: typeof plan }>("/ai/campaign", {
        goal,
        audienceSummary: "PawKit customers",
      });
      setPlan(data.data);
    } catch {}
    setGenerating(false);
  }

  async function saveCampaign() {
    if (!plan) return;
    setSaving(true);
    try {
      await api.post("/campaigns", {
        name: plan.name.slice(0, 60),
        goal,
        channel: plan.channel,
        messageTemplate: plan.messageTemplate,
        frequencyCapDays: plan.frequencyCapDays ?? 7,
        targetAudience: {},
      });
      setPlan(null);
      setGoal("");
      await loadCampaigns();
    } catch {}
    setSaving(false);
  }

  async function handleSubmit(id: string) {
    setActionId(id);
    try {
      await api.patch(`/campaigns/${id}/status`, { status: "pending_approval" });
      await loadCampaigns();
    } catch {}
    setActionId(null);
  }

  async function handleApprove(id: string) {
    setActionId(id);
    try {
      await api.post(`/campaigns/${id}/approve`);
      await loadCampaigns();
    } catch {}
    setActionId(null);
  }

  async function handleLaunch(id: string) {
    setActionId(id);
    setDispatchResult(null);
    try {
      const { data } = await api.post<{ data: DispatchResult }>(
        `/campaigns/${id}/launch`
      );
      setDispatchResult(data.data);
      await loadCampaigns();
    } catch {}
    setActionId(null);
  }

  const filteredCampaigns =
    activeTab === "all"
      ? campaigns
      : campaigns.filter((c) => c.status === activeTab);

  const totals = campaigns.reduce(
    (acc, c) => ({
      active: acc.active + (c.status === "running" ? 1 : 0),
      sent: acc.sent + c.stats.sent,
      converted: acc.converted + c.stats.converted,
      revenue: acc.revenue + c.stats.revenue,
    }),
    { active: 0, sent: 0, converted: 0, revenue: 0 }
  );

  const tabCounts = STATUS_TABS.reduce((acc, t) => {
    acc[t.id] =
      t.id === "all"
        ? campaigns.length
        : campaigns.filter((c) => c.status === t.id).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <CrmLayout
      title="Campaigns"
      subtitle="AI-powered campaign builder with approval flow and dispatch guardrails"
    >
      <div className="p-8 max-w-6xl mx-auto space-y-6">

        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Active Campaigns",
              value: totals.active,
              icon: Megaphone,
              color: "text-violet-500",
              bg: "bg-violet-50",
            },
            {
              label: "Total Dispatched",
              value: totals.sent.toLocaleString(),
              icon: Send,
              color: "text-blue-500",
              bg: "bg-blue-50",
            },
            {
              label: "Converted",
              value: totals.converted.toLocaleString(),
              icon: TrendingUp,
              color: "text-emerald-500",
              bg: "bg-emerald-50",
            },
            {
              label: "Total Revenue",
              value:
                totals.revenue > 0
                  ? `₹${(totals.revenue / 1000).toFixed(1)}K`
                  : "₹0",
              icon: Users,
              color: "text-amber-500",
              bg: "bg-amber-50",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {s.label}
                </p>
                <div className={`w-8 h-8 ${s.bg} rounded-xl flex items-center justify-center`}>
                  <s.icon size={15} className={s.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setBuilderOpen(!builderOpen)}
            className="w-full flex items-center justify-between p-5 hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
                <Wand2 size={16} className="text-violet-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-gray-900">AI Campaign Builder</p>
                <p className="text-xs text-gray-400">
                  Describe a goal — AI generates name, channel, message & rationale
                </p>
              </div>
            </div>
            {builderOpen ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </button>

          {builderOpen && (
            <div className="border-t border-gray-100 p-5">
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Campaign Goal
                  </label>
                  <textarea
                    rows={4}
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    placeholder="Describe your campaign goal in plain English…"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-transparent transition-all"
                  />
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-400 font-medium">Examples:</p>
                    <div className="flex flex-col gap-1.5">
                      {EXAMPLE_GOALS.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGoal(g)}
                          className="text-xs text-left px-3 py-1.5 bg-gray-50 hover:bg-violet-50 hover:text-violet-700 text-gray-500 border border-gray-100 hover:border-violet-200 rounded-lg transition-all"
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={generatePlan}
                    disabled={!goal.trim() || generating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-violet-200"
                  >
                    {generating ? (
                      <>
                        <RefreshCcw size={14} className="animate-spin" />
                        Generating Strategy…
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        Generate Strategy
                      </>
                    )}
                  </button>
                </div>

                {plan ? (
                  <div className="bg-gradient-to-br from-violet-50 to-white border border-violet-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{CH_EMOJI[plan.channel] ?? "📢"}</span>
                      <div>
                        <p className="font-bold text-gray-900">{plan.name}</p>
                        <p className="text-xs text-gray-400 capitalize">
                          {plan.channel} · {plan.frequencyCapDays}d frequency cap
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-400 mb-1.5">Message Template</p>
                      <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-700 font-mono leading-relaxed">
                        {plan.messageTemplate}
                      </div>
                    </div>
                    <div className="bg-violet-50/80 rounded-xl p-3">
                      <p className="text-xs font-bold text-violet-600 mb-1">AI Rationale</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{plan.rationale}</p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={saveCampaign}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-900 hover:bg-black disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all"
                      >
                        {saving ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        {saving ? "Saving…" : "Save as Draft"}
                      </button>
                      <button
                        onClick={() => {
                          setPlan(null);
                          setGoal("");
                        }}
                        className="px-4 py-2.5 bg-white border border-gray-200 text-gray-500 text-sm font-bold rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center text-gray-300 min-h-[220px] gap-2">
                    <Sparkles size={28} />
                    <p className="text-sm font-medium">Campaign strategy appears here</p>
                    <p className="text-xs">Enter a goal and click Generate</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 bg-white border border-gray-100 rounded-xl p-1 shadow-sm">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === t.id
                      ? "bg-violet-600 text-white shadow-sm"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  }`}
                >
                  {t.label}
                  {tabCounts[t.id] > 0 && (
                    <span
                      className={`text-[10px] font-black w-4 h-4 rounded flex items-center justify-center ${
                        activeTab === t.id ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {tabCounts[t.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={loadCampaigns}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors px-3 py-1.5 hover:bg-gray-50 rounded-lg"
            >
              <RefreshCcw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
              <Megaphone size={36} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-gray-500">
                {activeTab === "all"
                  ? "No campaigns yet — use the AI builder above"
                  : `No campaigns with status "${STATUS_LABEL[activeTab]}"`}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredCampaigns.map((c) => (
                <CampaignCard
                  key={c._id}
                  campaign={c}
                  onSubmit={handleSubmit}
                  onApprove={handleApprove}
                  onLaunch={handleLaunch}
                  isActing={actionId === c._id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {dispatchResult && (
        <DispatchModal
          result={dispatchResult}
          onClose={() => setDispatchResult(null)}
        />
      )}
    </CrmLayout>
  );
}
