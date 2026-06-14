import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  Radio, Loader2, CheckCircle, ArrowRight, Clock, AlertTriangle,
  Flame, XCircle, ShieldAlert, MoonStar, Gem, Zap,
  RefreshCw, ChevronRight, Info,
} from "lucide-react";
import api from "@/lib/api";

interface RadarGroup {
  signal: string;
  label: string;
  count: number;
  segment?: string;
  maxDaysUntilRunout?: number;
}

interface RadarResult {
  scannedAt: string;
  groups: RadarGroup[];
  campaignsCreated: number;
  campaignIds: string[];
}

interface CustomerData {
  daysUntilRunout?: number;
  segment?: string;
  ltv?: number;
  lastOrderAt?: string;
}

interface SignalMeta {
  color: string;
  icon: React.ElementType;
  label: string;
  description: string;
  urgency: string;
  urgencyColor: string;
}

const SIGNAL_META: Record<string, SignalMeta> = {
  runout_imminent: {
    color: "orange", icon: Flame,
    label: "Runout Imminent",
    description: "Customers whose food supply runs out within 7 days",
    urgency: "Act today",
    urgencyColor: "text-orange-600",
  },
  runout_overdue: {
    color: "red", icon: XCircle,
    label: "Overdue Reorder",
    description: "Customers already past their predicted runout date",
    urgency: "Critical — overdue",
    urgencyColor: "text-red-600",
  },
  at_risk: {
    color: "amber", icon: ShieldAlert,
    label: "At-Risk Customers",
    description: "Customers inactive between 45–90 days — potential churn",
    urgency: "Re-engage soon",
    urgencyColor: "text-amber-600",
  },
  inactive: {
    color: "slate", icon: MoonStar,
    label: "Inactive Customers",
    description: "No order in 90+ days — highest churn risk",
    urgency: "Churn risk",
    urgencyColor: "text-slate-500",
  },
  high_ltv_runout: {
    color: "violet", icon: Gem,
    label: "High-Value Expiring",
    description: "High-LTV customers overdue for reorder — protect revenue",
    urgency: "High priority",
    urgencyColor: "text-violet-600",
  },
};

const CARD_STYLES: Record<string, { card: string; badge: string; count: string; urgencyBg: string }> = {
  orange: { card: "border-orange-200 bg-orange-50/60", badge: "bg-orange-100 text-orange-700", count: "text-orange-600", urgencyBg: "bg-orange-100/60" },
  red:    { card: "border-red-200 bg-red-50/60",       badge: "bg-red-100 text-red-700",       count: "text-red-600",    urgencyBg: "bg-red-100/60"    },
  amber:  { card: "border-amber-200 bg-amber-50/60",   badge: "bg-amber-100 text-amber-700",   count: "text-amber-600",  urgencyBg: "bg-amber-100/60"  },
  slate:  { card: "border-slate-200 bg-slate-50/60",   badge: "bg-slate-100 text-slate-600",   count: "text-slate-500",  urgencyBg: "bg-slate-100/60"  },
  violet: { card: "border-violet-200 bg-violet-50/60", badge: "bg-violet-100 text-violet-700", count: "text-violet-600", urgencyBg: "bg-violet-100/60" },
};

const SIGNAL_ORDER = ["runout_overdue", "runout_imminent", "high_ltv_runout", "at_risk", "inactive"];

export default function RadarPage() {
  const router = useRouter();
  const [result,         setResult]         = useState<RadarResult | null>(null);
  const [loading,        setLoading]        = useState(false);
  const [sessionHistory, setSessionHistory] = useState<RadarResult[]>([]);
  const [customerCounts, setCustomerCounts] = useState({
    overdue: 0, urgent: 0, atRisk: 0, inactive: 0, highLtv: 0, total: 0,
  });
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    setLoadingCounts(true);
    api.get("/customers").then(({ data }) => {
      const list: CustomerData[] = data?.data ?? [];
      const now = Date.now();
      let overdue = 0, urgent = 0, atRisk = 0, inactive = 0, highLtv = 0;
      list.forEach((c) => {
        const days = c.daysUntilRunout;
        const lastOrder = c.lastOrderAt ? new Date(c.lastOrderAt).getTime() : 0;
        const daysSinceOrder = lastOrder ? Math.floor((now - lastOrder) / 86_400_000) : 999;
        if (typeof days === "number") {
          if (days < 0) overdue++;
          if (days >= 0 && days <= 7) urgent++;
        }
        if (c.segment === "at_risk" || (daysSinceOrder >= 45 && daysSinceOrder < 90)) atRisk++;
        if (c.segment === "inactive" || daysSinceOrder >= 90) inactive++;
        if ((c.ltv ?? 0) >= 5000 && (typeof days === "number" ? days < 14 : false)) highLtv++;
      });
      setCustomerCounts({ overdue, urgent, atRisk, inactive, highLtv, total: list.length });
    }).catch(() => {}).finally(() => setLoadingCounts(false));
  }, []);

  async function runScan() {
    setLoading(true);
    try {
      const { data } = await api.post<{ data: RadarResult }>("/ai/radar/scan");
      const r = data.data;
      setResult(r);
      setSessionHistory((prev) => [r, ...prev].slice(0, 10));
    } catch {}
    setLoading(false);
  }

  const orderedGroups = SIGNAL_ORDER.map((sig) => {
    const group = result?.groups.find((g) => g.signal === sig);
    return group ?? { signal: sig, label: SIGNAL_META[sig]?.label ?? sig, count: 0 };
  });

  const totalFlagged  = result?.groups.reduce((s, g) => s + g.count, 0) ?? 0;
  const hasResult     = result !== null;

  const liveSignals = [
    { signal: "runout_overdue", count: customerCounts.overdue },
    { signal: "runout_imminent", count: customerCounts.urgent },
    { signal: "at_risk", count: customerCounts.atRisk },
    { signal: "inactive", count: customerCounts.inactive },
    { signal: "high_ltv_runout", count: customerCounts.highLtv },
  ];

  return (
    <CrmLayout title="Reorder Radar" subtitle="Autonomous signal detection & campaign queuing">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 lg:p-8 text-white overflow-hidden relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #7C3AED 0%, transparent 50%), radial-gradient(circle at 80% 20%, #F59E0B 0%, transparent 40%)" }} />
          <div className="relative">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center border border-amber-500/20">
                    <Radio size={20} className="text-amber-400" />
                  </div>
                  <div>
                    <p className="font-bold text-lg leading-tight">Reorder Radar</p>
                    <p className="text-slate-400 text-xs font-medium mt-0.5">Autonomous signal detection &amp; campaign queuing</p>
                  </div>
                </div>
                {result && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <Clock size={12} />
                    Last scan: {new Date(result.scannedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                {!result && (
                  <p className="text-slate-400 text-xs font-medium">No scan run yet — click to begin</p>
                )}
              </div>
              <button
                onClick={runScan}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed text-black text-sm font-bold rounded-xl transition-all shadow-lg shadow-amber-500/25 active:scale-95"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Radio size={16} />}
                {loading ? "Scanning…" : "Run Full Scan"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {SIGNAL_ORDER.map((sig) => {
                const meta = SIGNAL_META[sig];
                const Icon = meta.icon;
                return (
                  <div key={sig} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <Icon size={16} className={`mx-auto mb-1.5 ${meta.color === "orange" ? "text-orange-400" : meta.color === "red" ? "text-red-400" : meta.color === "amber" ? "text-amber-400" : meta.color === "violet" ? "text-violet-400" : "text-slate-400"}`} />
                    <p className="text-[9px] font-bold text-white leading-tight">{meta.label}</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-tight">{meta.description.split(" ").slice(0, 5).join(" ")}…</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-gray-900">Live Customer Signals</p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">Current counts from customer database ({customerCounts.total} total)</p>
            </div>
            {loadingCounts && <RefreshCw size={14} className="text-gray-300 animate-spin" />}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {liveSignals.map(({ signal, count }) => {
              const meta   = SIGNAL_META[signal];
              const styles = CARD_STYLES[meta.color];
              const Icon   = meta.icon;
              return (
                <div key={signal} className={`rounded-xl border p-3 ${styles.card}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Icon size={14} className={`${meta.color === "orange" ? "text-orange-500" : meta.color === "red" ? "text-red-500" : meta.color === "amber" ? "text-amber-500" : meta.color === "violet" ? "text-violet-500" : "text-slate-400"}`} />
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${styles.badge}`}>{meta.urgency}</span>
                  </div>
                  <p className={`text-3xl font-black ${styles.count}`}>{count}</p>
                  <p className="text-[10px] font-bold text-gray-600 mt-0.5 leading-tight">{meta.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {hasResult && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center flex-wrap gap-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle size={18} />
                  <p className="font-bold text-sm">Scan complete</p>
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <p className="text-sm text-gray-600">
                  <span className="font-bold text-gray-900">{totalFlagged}</span> customers flagged across {result!.groups.filter((g) => g.count > 0).length} signals
                </p>
                {result!.campaignsCreated > 0 && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
                      <Zap size={14} />
                      {result!.campaignsCreated} campaign{result!.campaignsCreated !== 1 ? "s" : ""} queued for review
                    </div>
                  </>
                )}
                {result!.campaignsCreated === 0 && (
                  <>
                    <div className="h-4 w-px bg-gray-200" />
                    <p className="text-sm text-gray-400 font-medium">No new campaigns created (already queued today)</p>
                  </>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">
                    {new Date(result!.scannedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  {result!.campaignsCreated > 0 && (
                    <button
                      onClick={() => router.push("/crm/campaigns")}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                      Review Queued Campaigns <ChevronRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orderedGroups.map((group) => {
                const meta   = SIGNAL_META[group.signal];
                const styles = CARD_STYLES[meta?.color ?? "slate"];
                const Icon   = meta?.icon ?? Radio;
                return (
                  <div key={group.signal} className={`rounded-2xl border p-5 ${styles.card}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${styles.badge}`}>
                          {group.signal.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <p className="text-sm font-bold text-gray-900 mt-2">{meta?.label ?? group.label}</p>
                        {meta && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{meta.description}</p>}
                      </div>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${styles.urgencyBg}`}>
                        <Icon size={18} className={styles.count} />
                      </div>
                    </div>

                    <p className={`text-5xl font-black ${styles.count} leading-none`}>{group.count}</p>
                    <p className="text-xs text-gray-400 mt-1 font-medium">customers</p>

                    {group.count === 0 ? (
                      <p className="text-xs text-gray-300 italic mt-3">No customers in this segment</p>
                    ) : (
                      <div className={`mt-3 flex items-center gap-1.5 text-xs font-bold ${meta?.urgencyColor ?? "text-gray-600"}`}>
                        <AlertTriangle size={11} />
                        {meta?.urgency ?? "Action recommended"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {result!.campaignIds.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-900">Auto-Created Campaigns</p>
                  <span className="text-xs bg-violet-50 text-violet-600 font-bold px-2.5 py-1 rounded-full">{result!.campaignIds.length} queued</span>
                </div>
                <div className="space-y-2">
                  {orderedGroups.filter((g) => g.count > 0).map((g) => {
                    const meta = SIGNAL_META[g.signal];
                    const styles = CARD_STYLES[meta?.color ?? "slate"];
                    return (
                      <div key={g.signal} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100/60 transition-colors">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${styles.urgencyBg}`}>
                          {meta?.icon ? <meta.icon size={13} className={styles.count} /> : <Radio size={13} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">
                            {g.signal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} — {g.count} customers
                          </p>
                          <p className="text-[10px] text-gray-400 font-medium">WhatsApp · pending_approval</p>
                        </div>
                        <button
                          onClick={() => router.push("/crm/campaigns")}
                          className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
                        >
                          Review <ArrowRight size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 rounded-xl">
                  <Info size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 font-medium">All queued campaigns require human approval before any message is sent.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {!hasResult && !loading && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10">
            <div className="max-w-lg mx-auto">
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Radio size={28} className="text-amber-500" />
                </div>
                <p className="font-bold text-gray-900 text-base mb-1">How Reorder Radar Works</p>
                <p className="text-sm text-gray-400">Run your first scan to detect reorder signals and queue campaigns</p>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-8">
                {[
                  { step: "1", title: "Scan",    icon: Radio,        desc: "Analyses all customers against 5 predictive signals using reorder clock data" },
                  { step: "2", title: "Detect",  icon: AlertTriangle, desc: "Identifies runout-imminent, overdue, at-risk, inactive and high-LTV segments" },
                  { step: "3", title: "Queue",   icon: Zap,          desc: "Auto-creates campaigns in pending_approval — zero messages sent without approval" },
                ].map(({ step, title, desc }) => (
                  <div key={step} className="text-center">
                    <div className="w-10 h-10 bg-violet-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3 font-black text-sm">
                      {step}
                    </div>
                    <p className="font-bold text-gray-900 text-xs mb-1">{title}</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-8">
                {SIGNAL_ORDER.map((sig) => {
                  const meta   = SIGNAL_META[sig];
                  const styles = CARD_STYLES[meta.color];
                  const Icon   = meta.icon;
                  return (
                    <div key={sig} className={`flex items-center gap-3 p-3 rounded-xl border ${styles.card}`}>
                      <Icon size={15} className={styles.count} />
                      <div className="flex-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full mr-2 ${styles.badge}`}>{meta.label}</span>
                        <span className="text-xs text-gray-500">{meta.description}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-center">
                <button
                  onClick={runScan}
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold rounded-xl transition-all shadow-lg active:scale-95"
                >
                  <Radio size={16} /> Run First Scan
                </button>
              </div>
            </div>
          </div>
        )}

        {sessionHistory.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={13} className="text-gray-400" />
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Session History</p>
            </div>
            <div className="space-y-2">
              {sessionHistory.slice(1, 6).map((h, i) => (
                <div key={i} className="flex items-center gap-4 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-xs">
                  <span className="text-gray-400 font-medium w-24">
                    {new Date(h.scannedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <span className="font-bold text-gray-700">{h.groups.reduce((s, g) => s + g.count, 0)} flagged</span>
                  <span className="text-gray-400">{h.campaignsCreated} campaigns created</span>
                  <div className="ml-auto flex gap-2">
                    {h.groups.filter((g) => g.count > 0).map((g) => {
                      const meta = SIGNAL_META[g.signal];
                      const styles = CARD_STYLES[meta?.color ?? "slate"];
                      return (
                        <span key={g.signal} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${styles.badge}`}>
                          {g.count} {g.signal.replace(/_/g, " ")}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </CrmLayout>
  );
}
