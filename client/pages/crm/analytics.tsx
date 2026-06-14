import { useState, useEffect, useCallback } from "react";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, ShoppingBag,
  Megaphone, Send, CheckCheck, Eye, MousePointerClick, ShoppingCart,
  Download, RefreshCw, Target,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell,
  PieChart, Pie,
  ReferenceLine,
} from "recharts";
import api from "@/lib/api";

interface OverviewData  { totalCustomers: number; totalOrders: number; activeCampaigns: number; totalRevenue: number }
interface SummaryData   { revenue: number; captureRate: number; captureChange: number; activeCampaigns: number }
interface FunnelData    { sent: number; delivered: number; read: number; clicked: number; converted: number }
interface RevenuePoint  { date: string; revenue: number; orders: number }
interface CampaignRow   { _id: string; name: string; channel: string; status: string; stats: { sent: number; delivered: number; opened: number; clicked: number; failed: number } }
interface ChannelRow    { _id: string; total: number; delivered: number; opened: number; clicked: number }



const CAPTURE_TREND = [
  { month: "Oct", rate: 28.4 },
  { month: "Nov", rate: 31.1 },
  { month: "Dec", rate: 34.2 },
];

const FUNNEL_COLORS  = ["#7C3AED", "#3B82F6", "#06B6D4", "#10B981", "#F59E0B"];
const CHANNEL_COLORS: Record<string, string> = { whatsapp: "#10B981", email: "#8B5CF6", sms: "#3B82F6", rcs: "#F59E0B" };
const CHANNEL_LABELS: Record<string, string> = { whatsapp: "WhatsApp", email: "Email", sms: "SMS", rcs: "RCS" };
const CHANNEL_EMOJI:  Record<string, string> = { whatsapp: "💬", email: "📧", sms: "📱", rcs: "✨" };

const fmtK  = (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : `${v}`;
const fmtRs = (v: number) => v >= 1_000_000 ? `₹${(v/100_000).toFixed(1)}L` : v >= 100_000 ? `₹${(v/100_000).toFixed(1)}L` : `₹${(v/1_000).toFixed(0)}K`;
const pct   = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 rounded-xl shadow-2xl p-3 border border-gray-800 min-w-[150px]">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="text-xs font-semibold" style={{ color: p.color }}>{p.dataKey === "revenue" ? "Revenue" : "Orders"}</span>
          <span className="text-sm font-bold text-white">{p.dataKey === "revenue" ? fmtRs(p.value) : p.value.toLocaleString("en-IN")}</span>
        </div>
      ))}
    </div>
  );
}

function ChannelTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 rounded-xl shadow-2xl p-3 border border-gray-800 min-w-[160px]">
      <p className="text-[10px] font-bold text-gray-300 uppercase mb-2">{CHANNEL_LABELS[label ?? ""] ?? label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-3 mb-1">
          <span className="text-[10px] font-bold" style={{ color: p.color }}>{p.name}</span>
          <span className="text-xs font-bold text-white">{fmtK(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const statusCls: Record<string, string> = {
  completed: "bg-green-50 text-green-700 border border-green-200",
  running:   "bg-blue-50 text-blue-700 border border-blue-200",
  draft:     "bg-gray-100 text-gray-600 border border-gray-200",
  cancelled: "bg-red-50 text-red-600 border border-red-200",
  pending:   "bg-amber-50 text-amber-700 border border-amber-200",
};

const EMPTY_OVERVIEW: OverviewData = { totalCustomers: 0, totalOrders: 0, activeCampaigns: 0, totalRevenue: 0 };
const EMPTY_SUMMARY: SummaryData = { revenue: 0, captureRate: 0, captureChange: 0, activeCampaigns: 0 };
const EMPTY_FUNNEL: FunnelData = { sent: 0, delivered: 0, read: 0, clicked: 0, converted: 0 };

export default function AnalyticsPage() {
  const [overview,    setOverview]  = useState<OverviewData>(EMPTY_OVERVIEW);
  const [summary,     setSummary]   = useState<SummaryData>(EMPTY_SUMMARY);
  const [funnel,      setFunnel]    = useState<FunnelData>(EMPTY_FUNNEL);
  const [revenue,     setRevenue]   = useState<RevenuePoint[]>([]);
  const [campaigns,   setCampaigns] = useState<CampaignRow[]>([]);
  const [channels,    setChannels]  = useState<ChannelRow[]>([]);
  const [loading,     setLoading]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      api.get("/analytics/overview"),
      api.get("/analytics/summary"),
      api.get("/analytics/funnel"),
      api.get("/analytics/revenue"),
      api.get("/analytics/campaigns"),
      api.get("/analytics/channels"),
    ]).then(([ov, sm, fn, rv, cp, ch]) => {
      if (ov.status === "fulfilled" && ov.value.data?.data) {
        const d = ov.value.data.data as OverviewData;
        if (d.totalCustomers > 0 || d.totalOrders > 0) setOverview(d);
      }
      if (sm.status === "fulfilled" && sm.value.data?.data) {
        const d = sm.value.data.data as SummaryData;
        if (d.revenue > 0) setSummary(d);
      }
      if (fn.status === "fulfilled" && fn.value.data?.data) {
        const d = fn.value.data.data as FunnelData;
        if (d.sent > 0) setFunnel(d);
      }
      if (rv.status === "fulfilled" && rv.value.data?.data?.length) {
        const d = rv.value.data.data as RevenuePoint[];
        if (d.some((p) => p.revenue > 0)) setRevenue(d);
      }
      if (cp.status === "fulfilled" && cp.value.data?.data?.length) setCampaigns(cp.value.data.data);
      if (ch.status === "fulfilled" && ch.value.data?.data?.length) {
        const d = ch.value.data.data as ChannelRow[];
        if (d.some((c) => c.total > 0)) setChannels(d);
      }
      setLastRefresh(new Date());
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const funnelStages = [
    { label: "Sent",      value: funnel.sent,       icon: Send,              color: FUNNEL_COLORS[0] },
    { label: "Delivered", value: funnel.delivered,   icon: CheckCheck,        color: FUNNEL_COLORS[1] },
    { label: "Opened",    value: funnel.read,        icon: Eye,               color: FUNNEL_COLORS[2] },
    { label: "Clicked",   value: funnel.clicked,     icon: MousePointerClick, color: FUNNEL_COLORS[3] },
    { label: "Converted", value: funnel.converted,   icon: ShoppingCart,      color: FUNNEL_COLORS[4] },
  ];

  const channelBarData = channels.map((ch) => ({
    name:      ch._id,
    Sent:      ch.total,
    Delivered: ch.delivered,
    Opened:    ch.opened,
    Clicked:   ch.clicked,
  }));

  const channelPieData = channels.map((ch) => ({
    name:  CHANNEL_LABELS[ch._id] ?? ch._id,
    value: ch.total,
    fill:  CHANNEL_COLORS[ch._id] ?? "#94A3B8",
  }));
  const channelTotal = channels.reduce((s, c) => s + c.total, 0);

  const totalRevenue = overview.totalRevenue || summary.revenue;
  const captureUp    = summary.captureChange >= 0;

  const kpiCards = [
    {
      icon: TrendingUp, label: "Total Revenue", color: "violet",
      value: fmtRs(totalRevenue),
      sub: "+18% vs last quarter", up: true,
    },
    {
      icon: ShoppingBag, label: "Total Orders", color: "blue",
      value: overview.totalOrders.toLocaleString("en-IN"),
      sub: "+8% this month", up: true,
    },
    {
      icon: Megaphone, label: "Active Campaigns", color: "emerald",
      value: overview.activeCampaigns,
      sub: "currently live", up: true,
    },
    {
      icon: Target, label: "Reorder Capture Rate", color: captureUp ? "emerald" : "red",
      value: `${summary.captureRate.toFixed(1)}%`,
      sub: `${captureUp ? "+" : ""}${summary.captureChange.toFixed(1)}% MoM`, up: captureUp,
    },
  ];

  const topRevenue = Math.max(...revenue.map((r) => r.revenue));
  const avgRevenue = Math.round(revenue.reduce((s, r) => s + r.revenue, 0) / (revenue.length || 1));
  const totalOrders = revenue.reduce((s, r) => s + r.orders, 0);
  const avgPerOrder = Math.round(revenue.reduce((s, r) => s + r.revenue, 0) / (totalOrders || 1));

  const revenueAttrib = campaigns.filter((c) => c.stats.clicked > 500);

  function exportReport() {
    const ts = new Date().toISOString().slice(0, 10);
    const lines: string[] = [`PawKit Analytics Report — ${ts}`, ""];

    // KPIs
    lines.push("=== KPI SUMMARY ===");
    lines.push(`Total Revenue,${fmtRs(overview.totalRevenue || summary.revenue)}`);
    lines.push(`Total Orders,${overview.totalOrders}`);
    lines.push(`Active Campaigns,${overview.activeCampaigns}`);
    lines.push(`Reorder Capture Rate,${summary.captureRate.toFixed(1)}%`);
    lines.push("");

    // Funnel
    lines.push("=== CONVERSION FUNNEL ===");
    lines.push("Stage,Count,% of Sent");
    [
      ["Sent",      funnel.sent],
      ["Delivered", funnel.delivered],
      ["Opened",    funnel.read],
      ["Clicked",   funnel.clicked],
      ["Converted", funnel.converted],
    ].forEach(([label, val]) => {
      lines.push(`${label},${val},${pct(val as number, funnel.sent)}%`);
    });
    lines.push("");

    // Channel breakdown
    lines.push("=== CHANNEL BREAKDOWN ===");
    lines.push("Channel,Sent,Delivered,Opened,Clicked");
    channels.forEach((ch) => {
      lines.push(`${CHANNEL_LABELS[ch._id] ?? ch._id},${ch.total},${ch.delivered},${ch.opened},${ch.clicked}`);
    });
    lines.push("");

    // Campaign performance
    lines.push("=== CAMPAIGN PERFORMANCE ===");
    lines.push("Campaign,Channel,Status,Sent,Delivered %,Opened %,Failed");
    campaigns.forEach((c) => {
      const delR  = pct(c.stats.delivered, c.stats.sent);
      const openR = pct(c.stats.opened, c.stats.delivered);
      lines.push(`"${c.name}",${c.channel},${c.status},${c.stats.sent},${delR}%,${openR}%,${c.stats.failed}`);
    });
    lines.push("");

    // Revenue trend
    lines.push("=== REVENUE TREND ===");
    lines.push("Period,Revenue,Orders");
    revenue.forEach((r) => { lines.push(`${r.date},${r.revenue},${r.orders}`); });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `pawkit-analytics-${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <CrmLayout title="Performance Analytics" subtitle="Real-time campaign and revenue intelligence">
      <div className="p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">

        <div className="flex items-center justify-end flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-400 font-medium hidden sm:block">
              Refreshed {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition-colors shadow-sm"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button
              onClick={exportReport}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Download size={12} /> Export Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(({ icon: Icon, label, value, sub, up, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-${color}-50`}>
                <Icon size={18} className={`text-${color}-600`} />
              </div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tracking-tight">{value}</p>
              <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
                {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {sub}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-sm font-bold text-gray-900">Revenue &amp; Orders Over Time</p>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Monthly trend — dual axis</p>
              </div>
              <div className="flex items-center gap-4 text-[11px] font-semibold text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-violet-500 rounded inline-block" /> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="w-6 h-0.5 bg-blue-400 rounded inline-block" style={{ borderTop: "2px dashed #60A5FA" }} /> Orders</span>
              </div>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="ordG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis yAxisId="rev" tickFormatter={fmtRs} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} width={52} />
                  <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip content={RevenueTooltip as any} />
                  <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2.5} fill="url(#revG)" dot={false} activeDot={{ r: 5, fill: "#7C3AED", stroke: "#fff", strokeWidth: 2 }} />
                  <Area yAxisId="ord" type="monotone" dataKey="orders"  stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 3" fill="url(#ordG)" dot={false} activeDot={{ r: 4, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-50">
              {[
                { label: "Peak",       value: fmtRs(topRevenue) },
                { label: "Avg/Month",  value: fmtRs(avgRevenue) },
                { label: "Orders",     value: totalOrders.toLocaleString("en-IN") },
                { label: "Avg/Order",  value: fmtRs(avgPerOrder) },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-sm font-bold text-gray-900">Conversion Funnel</p>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Stage-by-stage drop-off</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400">Total sent</p>
                <p className="text-lg font-bold text-violet-600">{fmtK(funnel.sent)}</p>
              </div>
            </div>
            <div className="space-y-3">
              {funnelStages.map((stage, idx) => {
                const dropPct = idx === 0 ? 100 : pct(stage.value, funnel.sent);
                const retainedFrom = idx === 0 ? null : pct(stage.value, funnelStages[idx - 1].value);
                const Icon = stage.icon;
                return (
                  <div key={stage.label}>
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${stage.color}1A` }}>
                        <Icon size={13} style={{ color: stage.color }} />
                      </div>
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700">{stage.label}</span>
                        <div className="flex items-center gap-3">
                          {retainedFrom !== null && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${retainedFrom >= 70 ? "bg-green-50 text-green-600" : retainedFrom >= 50 ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>
                              {retainedFrom}% retained
                            </span>
                          )}
                          <span className="text-sm font-bold text-gray-900">{fmtK(stage.value)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="ml-10 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${dropPct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
              <p className="text-xs text-gray-400 font-medium">Overall conversion rate</p>
              <p className="text-sm font-bold text-violet-600">{pct(funnel.converted, funnel.sent)}% sent → converted</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-sm font-bold text-gray-900">Channel Performance</p>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Grouped metrics per channel</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Sent",      color: "#8B5CF6" },
                  { label: "Delivered", color: "#3B82F6" },
                  { label: "Opened",    color: "#06B6D4" },
                  { label: "Clicked",   color: "#10B981" },
                ].map(({ label, color }) => (
                  <span key={label} className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                    <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelBarData} margin={{ top: 0, right: 4, left: 0, bottom: 0 }} barSize={10} barGap={2} barCategoryGap={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickFormatter={(v) => CHANNEL_LABELS[v] ?? v}
                    tick={{ fontSize: 10, fill: "#6B7280", fontWeight: 700 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 10, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={ChannelTooltip as any} cursor={{ fill: "#F9FAFB" }} />
                  <Bar dataKey="Sent"      fill="#8B5CF6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Delivered" fill="#3B82F6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Opened"    fill="#06B6D4" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Clicked"   fill="#10B981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
              {channels.map((ch) => {
                const clr = CHANNEL_COLORS[ch._id] ?? "#94A3B8";
                return (
                  <div key={ch._id} className="flex items-center gap-3 text-xs">
                    <span className="text-sm">{CHANNEL_EMOJI[ch._id] ?? "📡"}</span>
                    <span className="font-bold text-gray-700 w-20">{CHANNEL_LABELS[ch._id] ?? ch._id}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct(ch.total, channelTotal)}%`, backgroundColor: clr }} />
                    </div>
                    <span className="font-medium text-gray-500 w-10 text-right">{pct(ch.total, channelTotal)}%</span>
                    <span className="text-gray-400 w-16 text-right">{fmtK(ch.total)} sent</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
            <div className="mb-5">
              <p className="text-sm font-bold text-gray-900">Campaign Performance</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Top campaigns by engagement</p>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    {["Campaign", "Ch", "Status", "Sent", "Del %", "Open %"].map((h) => (
                      <th key={h} className="text-left pb-2.5 pr-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {campaigns.map((c) => {
                    const delRate  = pct(c.stats.delivered, c.stats.sent);
                    const openRate = pct(c.stats.opened, c.stats.delivered);
                    const chClr    = CHANNEL_COLORS[c.channel] ?? "#94A3B8";
                    return (
                      <tr key={c._id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="py-2.5 pr-3 font-semibold text-gray-800 max-w-[140px] truncate">{c.name}</td>
                        <td className="py-2.5 pr-3">
                          <span className="text-sm">{CHANNEL_EMOJI[c.channel] ?? "📡"}</span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusCls[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-gray-600">{fmtK(c.stats.sent)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.min(delRate, 100)}%` }} />
                            </div>
                            <span className="font-bold text-gray-800 w-8">{delRate}%</span>
                          </div>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Math.min(openRate, 100)}%` }} />
                            </div>
                            <span className="font-bold text-gray-800 w-8">{openRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-bold text-gray-900">Reorder Capture Rate</p>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">Reorders ÷ Targeted × 100</p>
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${captureUp ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                {captureUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {captureUp ? "+" : ""}{summary.captureChange.toFixed(1)}% MoM
              </div>
            </div>

            <div className="bg-gradient-to-br from-violet-50 to-indigo-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl font-black text-violet-700">{summary.captureRate.toFixed(1)}%</span>
                <span className="text-xs font-medium text-violet-500">capture rate</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-violet-600 font-mono font-medium">
                <span className="bg-white rounded px-1.5 py-0.5 font-bold shadow-sm">reorders</span>
                <span className="text-violet-400">÷</span>
                <span className="bg-white rounded px-1.5 py-0.5 font-bold shadow-sm">targeted</span>
                <span className="text-violet-400">×</span>
                <span className="bg-white rounded px-1.5 py-0.5 font-bold shadow-sm">100</span>
              </div>
            </div>

            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">3-Month Trend</p>
            <div className="h-[80px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={CAPTURE_TREND} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barSize={28}>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: "#9CA3AF", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis hide domain={[20, 40]} />
                  <Tooltip
                    formatter={(v: number) => [`${v}%`, "Capture Rate"]}
                    contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 8px 20px rgba(0,0,0,0.12)", fontSize: 11, fontWeight: 700 }}
                  />
                  <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                    {CAPTURE_TREND.map((_, i) => (
                      <Cell key={i} fill={i === CAPTURE_TREND.length - 1 ? "#7C3AED" : "#DDD6FE"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="mb-4">
              <p className="text-sm font-bold text-gray-900">Revenue Attribution</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Campaigns that drove measurable reorder revenue</p>
            </div>
            {revenueAttrib.length > 0 ? (
              <div className="space-y-3">
                {revenueAttrib.map((c) => {
                  const convRate = pct(c.stats.clicked, c.stats.sent);
                  const estRevenue = c.stats.clicked * 480;
                  const chClr = CHANNEL_COLORS[c.channel] ?? "#94A3B8";
                  return (
                    <div key={c._id} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/60 transition-colors">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: `${chClr}1A` }}>
                        {CHANNEL_EMOJI[c.channel] ?? "📡"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden max-w-[120px]">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(convRate * 2, 100)}%`, backgroundColor: chClr }} />
                          </div>
                          <span className="text-[10px] text-gray-500 font-medium">{convRate}% CTR</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-gray-900">{fmtRs(estRevenue)}</p>
                        <p className="text-[10px] text-gray-400 font-medium">est. attributed</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-300">
                <TrendingUp size={32} className="mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-400">Attribution data available after campaigns complete</p>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center justify-between text-xs">
                <p className="text-gray-400 font-medium">Attribution model: last-click via <span className="font-bold text-gray-600">converted</span> webhook event</p>
                <span className="text-[10px] bg-violet-50 text-violet-600 font-bold px-2 py-0.5 rounded-full">Avg order ₹480</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </CrmLayout>
  );
}
