import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import CrmLayout from "@/components/layout/CrmLayout";
import Link from "next/link";
import {
  Users, Radio, Brain, Megaphone, TrendingUp, AlertTriangle,
  RefreshCw, ArrowRight, Clock, BarChart3, Settings, Waves,
  Zap, Target, Sparkles, ChevronRight,
} from "lucide-react";
import api from "@/lib/api";

interface OverviewData {
  totalCustomers: number;
  totalOrders: number;
  activeCampaigns: number;
  totalRevenue: number;
}

interface SummaryData {
  revenue: number;
  captureRate: number;
  captureChange: number;
  activeCampaigns: number;
}

interface RunoutPrediction {
  petId: string;
  productId?: string;
  daysUntilRunout: number;
  confidence: number;
  method?: "cold-start" | "blended" | "empirical";
  predictedRunoutDate: string;
}

interface Customer {
  _id: string;
  userId: { name: string; email: string };
  segment: string;
  ltv: number;
  orderCount: number;
  daysUntilRunout?: number;
  nextRunoutAt?: string;
  runoutPredictions: RunoutPrediction[];
}

interface RadarGroup {
  signal: string;
  label: string;
  count: number;
}

interface RadarResult {
  groups: RadarGroup[];
  campaignsCreated: number;
}

const SIGNAL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  runout_imminent: { bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/30" },
  runout_overdue:  { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/30" },
  at_risk:         { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30" },
  inactive:        { bg: "bg-slate-500/15",  text: "text-slate-300",  border: "border-slate-500/30" },
  high_value:      { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/30" },
};

const MODULE_CARDS = [
  { label: "Reorder Clock", desc: "Runout predictions per customer", href: "/crm/reorder-clock", badge: "A", color: "orange", Icon: Clock },
  { label: "Audience",      desc: "Resolve segments with smart filters", href: "/crm/audience",  badge: "B", color: "blue",   Icon: Users },
  { label: "AI Studio",     desc: "NL → filter, goal → campaign, message draft", href: "/crm/ai-studio", badge: "C", color: "violet", Icon: Brain },
  { label: "Campaigns",     desc: "Approve, dispatch, guardrails", href: "/crm/campaigns", badge: "D", color: "emerald", Icon: Megaphone },
  { label: "Event Stream",  desc: "Webhook events, idempotency, state machine", href: "/crm/events", badge: "E", color: "cyan", Icon: Waves },
  { label: "Analytics",     desc: "Attribution & real capture rate", href: "/crm/analytics", badge: "F", color: "pink", Icon: BarChart3 },
  { label: "Radar Scan",    desc: "Auto-detect signals, queue campaigns", href: "/crm/radar", badge: "G", color: "amber", Icon: Radio },
  { label: "Settings",      desc: "Batch jobs, validation, system config", href: "/crm/settings", badge: "H", color: "slate", Icon: Settings },
];

const MODULE_STYLES: Record<string, { card: string; badge: string; icon: string }> = {
  orange:  { card: "bg-orange-50 border-orange-100 hover:border-orange-200",   badge: "bg-orange-500",   icon: "text-orange-500" },
  blue:    { card: "bg-blue-50 border-blue-100 hover:border-blue-200",         badge: "bg-blue-500",     icon: "text-blue-500" },
  violet:  { card: "bg-violet-50 border-violet-100 hover:border-violet-200",   badge: "bg-violet-500",   icon: "text-violet-500" },
  emerald: { card: "bg-emerald-50 border-emerald-100 hover:border-emerald-200",badge: "bg-emerald-500",  icon: "text-emerald-500" },
  cyan:    { card: "bg-cyan-50 border-cyan-100 hover:border-cyan-200",         badge: "bg-cyan-500",     icon: "text-cyan-500" },
  pink:    { card: "bg-pink-50 border-pink-100 hover:border-pink-200",         badge: "bg-pink-500",     icon: "text-pink-500" },
  amber:   { card: "bg-amber-50 border-amber-100 hover:border-amber-200",      badge: "bg-amber-500",    icon: "text-amber-500" },
  slate:   { card: "bg-slate-50 border-slate-100 hover:border-slate-200",      badge: "bg-slate-500",    icon: "text-slate-500" },
};

const METHOD_COLOR: Record<string, string> = {
  "cold-start": "bg-gray-100 text-gray-600",
  blended:      "bg-blue-100 text-blue-700",
  empirical:    "bg-emerald-100 text-emerald-700",
};

function urgencyBadge(days?: number): { text: string; textCls: string; bgCls: string } {
  if (days === undefined || days === null) return { text: "—", textCls: "text-gray-400", bgCls: "bg-gray-50" };
  if (days < 0)   return { text: `${Math.abs(days)}d overdue`, textCls: "text-red-600",    bgCls: "bg-red-50" };
  if (days <= 7)  return { text: `${days}d`,                   textCls: "text-orange-600", bgCls: "bg-orange-50" };
  if (days <= 14) return { text: `${days}d`,                   textCls: "text-amber-600",  bgCls: "bg-amber-50" };
  return { text: `${days}d`, textCls: "text-emerald-600", bgCls: "bg-emerald-50" };
}

function fmtRs(v: number): string {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function CrmDashboard() {
  const router = useRouter();
  const [overview, setOverview]         = useState<OverviewData | null>(null);
  const [summary, setSummary]           = useState<SummaryData | null>(null);
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [radar, setRadar]               = useState<RadarResult | null>(null);
  const [radarLoading, setRadarLoading] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    api.get<{ data: OverviewData }>("/analytics/overview").then(r => setOverview(r.data.data)).catch(() => {});
    api.get<{ data: SummaryData }>("/analytics/summary").then(r => setSummary(r.data.data)).catch(() => {});
    api.get<{ data: Customer[] }>("/customers").then(r => setCustomers(r.data.data)).catch(() => {});
  }, []);

  async function runRadar() {
    setRadarLoading(true);
    try {
      const { data } = await api.post<{ data: RadarResult }>("/ai/radar/scan");
      setRadar(data.data);
    } catch {}
    setRadarLoading(false);
  }

  const urgentCustomers = [...customers]
    .filter(c => c.daysUntilRunout !== undefined)
    .sort((a, b) => (a.daysUntilRunout ?? 999) - (b.daysUntilRunout ?? 999))
    .slice(0, 5);

  const captureChange = summary?.captureChange ?? 0;

  const statCards = [
    {
      label: "Total Customers",
      value: overview ? overview.totalCustomers.toLocaleString("en-IN") : "—",
      Icon: Users,
      highlight: false,
      trend: null as null | { value: number; positive: boolean },
      sub: "registered accounts",
    },
    {
      label: "Total Orders",
      value: overview ? overview.totalOrders.toLocaleString("en-IN") : "—",
      Icon: Megaphone,
      highlight: false,
      trend: null,
      sub: "lifetime orders",
    },
    {
      label: "Total Revenue",
      value: overview ? fmtRs(overview.totalRevenue) : "—",
      Icon: TrendingUp,
      highlight: true,
      trend: null,
      sub: "lifetime GMV",
    },
    {
      label: "Reorder Capture Rate",
      value: summary ? `${summary.captureRate}%` : "—",
      Icon: Radio,
      highlight: false,
      trend: { value: captureChange, positive: captureChange >= 0 },
      sub: "reorders captured",
    },
  ];

  return (
    <CrmLayout title={`${greeting}, Maya`} subtitle={dateStr}>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <div
              key={s.label}
              className={`rounded-2xl p-5 border ${
                s.highlight
                  ? "bg-gradient-to-br from-violet-600 to-violet-800 border-transparent text-white shadow-lg shadow-violet-200"
                  : "bg-white border-gray-100 shadow-sm"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className={`text-[10px] font-bold uppercase tracking-widest ${s.highlight ? "text-violet-200" : "text-gray-400"}`}>
                  {s.label}
                </p>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${s.highlight ? "bg-white/10" : "bg-gray-50"}`}>
                  <s.Icon size={15} className={s.highlight ? "text-violet-200" : "text-gray-400"} />
                </div>
              </div>
              <p className={`text-3xl font-bold tracking-tight ${s.highlight ? "text-white" : "text-gray-900"}`}>
                {s.value}
              </p>
              <div className="flex items-center justify-between mt-2">
                <p className={`text-[11px] ${s.highlight ? "text-violet-300" : "text-gray-400"}`}>{s.sub}</p>
                {s.trend && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      s.trend.positive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {s.trend.positive ? "+" : ""}{s.trend.value}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Quick Actions</p>
          <div className="flex-1 h-px bg-gray-100" />
          <div className="flex items-center gap-2">
            <Link href="/crm/reorder-clock">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all shadow-sm">
                <Clock size={13} />
                Reorder Clock
              </button>
            </Link>
            <Link href="/crm/ai-studio">
              <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 transition-all shadow-sm">
                <Brain size={13} />
                AI Studio
              </button>
            </Link>
            <button
              onClick={runRadar}
              disabled={radarLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              {radarLoading ? <RefreshCw size={13} className="animate-spin" /> : <Radio size={13} />}
              Radar Scan
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center">
                <AlertTriangle size={14} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Reorder Urgency</p>
                <p className="text-[11px] text-gray-400">Top 5 customers by runout proximity</p>
              </div>
            </div>
            <Link href="/crm/reorder-clock">
              <button className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 transition-colors">
                View all <ChevronRight size={13} />
              </button>
            </Link>
          </div>
          {urgentCustomers.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              <Clock size={28} className="mx-auto mb-2 opacity-30" />
              <p>No runout data available — run recompute to generate predictions.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Days Remaining</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Method</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Runout Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Segment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {urgentCustomers.map((c) => {
                  const badge = urgencyBadge(c.daysUntilRunout);
                  const pred = c.runoutPredictions?.[0];
                  return (
                    <tr key={c._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-gray-900 text-sm">{c.userId?.name ?? "—"}</p>
                        <p className="text-[11px] text-gray-400">{c.userId?.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${badge.bgCls} ${badge.textCls}`}>
                          {badge.text}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {pred?.method ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${METHOD_COLOR[pred.method] ?? "bg-gray-100 text-gray-500"}`}>
                            {pred.method}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500 font-medium">
                        {c.nextRunoutAt ? fmtDate(c.nextRunoutAt) : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {c.segment}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/30">
                <Radio size={18} className="text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-sm">Reorder Radar — Quick Scan</p>
                <p className="text-slate-400 text-[11px] mt-0.5">Autonomously scans all customers for reorder signals and queues campaigns</p>
              </div>
            </div>
            <button
              onClick={runRadar}
              disabled={radarLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-black text-xs font-bold rounded-xl transition-all shadow-lg shadow-amber-500/20"
            >
              {radarLoading ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {radarLoading ? "Scanning…" : "Run Radar Scan"}
            </button>
          </div>

          {!radar && !radarLoading && (
            <div className="border border-white/5 rounded-xl p-5 flex items-center gap-4 bg-white/3">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                <Zap size={18} className="text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300">Ready to scan</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Click "Run Radar Scan" to detect overdue reorders, at-risk customers, and high-value opportunities.</p>
              </div>
            </div>
          )}

          {radarLoading && (
            <div className="border border-white/5 rounded-xl p-5 flex items-center gap-4 bg-white/3">
              <RefreshCw size={20} className="animate-spin text-amber-400 flex-shrink-0" />
              <p className="text-sm text-slate-300 font-medium">Scanning customer signals…</p>
            </div>
          )}

          {radar && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {radar.groups.map((g) => {
                  const style = SIGNAL_COLORS[g.signal] ?? { bg: "bg-white/5", text: "text-slate-300", border: "border-white/10" };
                  return (
                    <div key={g.signal} className={`rounded-xl p-4 border ${style.bg} ${style.border}`}>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${style.text} opacity-80`}>{g.label}</p>
                      <p className={`text-3xl font-bold ${style.text}`}>{g.count}</p>
                      <p className="text-[10px] text-slate-500 mt-1">customers</p>
                    </div>
                  );
                })}
              </div>
              {radar.campaignsCreated > 0 && (
                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                      <Megaphone size={13} className="text-emerald-400" />
                    </div>
                    <p className="text-sm text-emerald-300 font-semibold">
                      {radar.campaignsCreated} new campaign{radar.campaignsCreated !== 1 ? "s" : ""} queued for approval
                    </p>
                  </div>
                  <button
                    onClick={() => router.push("/crm/campaigns")}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-200 hover:text-white transition-colors"
                  >
                    Review in Campaigns <ArrowRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Module Overview</p>
            <div className="flex-1 h-px bg-gray-100" />
            <p className="text-[10px] text-gray-400">8 sections</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {MODULE_CARDS.map((m) => {
              const style = MODULE_STYLES[m.color];
              return (
                <Link key={m.href} href={m.href}>
                  <div className={`rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all group ${style.card}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center">
                          <m.Icon size={14} className={style.icon} />
                        </div>
                        <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded ${style.badge}`}>
                          {m.badge}
                        </span>
                      </div>
                      <ArrowRight size={13} className="opacity-0 group-hover:opacity-60 transition-opacity text-gray-500 mt-0.5" />
                    </div>
                    <p className="text-sm font-bold text-gray-900 mb-1">{m.label}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed">{m.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border border-violet-100 p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                <Brain size={18} className="text-violet-600" />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">AI Studio</p>
                <p className="text-xs text-gray-500">Natural language → audience, campaign, and message generation</p>
              </div>
            </div>
            <Link href="/crm/ai-studio">
              <button className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-violet-200">
                Open Studio <ArrowRight size={12} />
              </button>
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { title: "NL → Audience", desc: "\"loyal dog owners on WhatsApp\"", Icon: Users, color: "text-violet-600", bg: "bg-violet-100/60" },
              { title: "Goal → Campaign", desc: "\"re-engage at-risk customers\"", Icon: Target, color: "text-indigo-600", bg: "bg-indigo-100/60" },
              { title: "Message Draft", desc: "channel-specific templates", Icon: Sparkles, color: "text-fuchsia-600", bg: "bg-fuchsia-100/60" },
            ].map((item) => (
              <div key={item.title} className="bg-white/70 rounded-xl p-4 border border-white/80 shadow-sm">
                <div className={`w-8 h-8 ${item.bg} rounded-lg flex items-center justify-center mb-3`}>
                  <item.Icon size={15} className={item.color} />
                </div>
                <p className="text-xs font-bold text-gray-900 mb-1.5">{item.title}</p>
                <p className="text-[11px] text-gray-400 font-mono leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </CrmLayout>
  );
}
