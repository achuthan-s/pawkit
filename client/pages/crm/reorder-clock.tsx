import { useState, useEffect, useMemo, useCallback } from "react";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  RefreshCw, Clock, TrendingDown, AlertTriangle, CheckCircle,
  Loader2, ChevronUp, ChevronDown, ChevronsUpDown, Users,
  RotateCcw, Info,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Pet     { _id?: string; name: string; species: string }
interface Product { _id?: string; name: string }

interface RunoutPrediction {
  petId:     string;
  productId?: string;
  pet?:     Pet     | null;
  product?: Product | null;
  daysUntilRunout:     number;
  confidence:          number;
  method?:             "cold-start" | "blended" | "empirical";
  predictedRunoutDate: string;
  calculatedAt?:       string;
}

interface Customer {
  _id: string;
  userId: { name: string; email: string };
  segment: string;
  ltv: number;
  orderCount: number;
  daysUntilRunout?: number;
  nextRunoutAt?:    string;
  runoutPredictions: RunoutPrediction[];
}

interface LastRun {
  processed: number;
  errors:    number;
  durationMs: number;
  ranAt:     string;
}

type UrgencyFilter = "all" | "overdue" | "urgent" | "safe" | "pending";
type MethodFilter  = "all" | "cold-start" | "blended" | "empirical";
type SortDir       = "asc" | "desc";
type SortField     = "days" | "confidence" | "ltv";

// ── Style helpers ──────────────────────────────────────────────────────────────

const METHOD_PILL: Record<string, string> = {
  "cold-start": "bg-gray-100 text-gray-600 border border-gray-200",
  blended:      "bg-blue-100 text-blue-700 border border-blue-200",
  empirical:    "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

const SEG_COLOR: Record<string, string> = {
  "high-ltv": "bg-violet-100 text-violet-700",
  loyal:      "bg-emerald-100 text-emerald-700",
  growing:    "bg-blue-100 text-blue-700",
  "at-risk":  "bg-amber-100 text-amber-700",
  inactive:   "bg-red-100 text-red-600",
  new:        "bg-gray-100 text-gray-600",
};

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐶", cat: "🐱", bird: "🐦", rabbit: "🐰", other: "🐾",
};

function rowStyle(days?: number): string {
  if (days === undefined || days === null) return "";
  if (days < 0)   return "bg-red-50 border-l-4 border-l-red-400";
  if (days <= 7)  return "bg-orange-50 border-l-4 border-l-orange-400";
  if (days <= 14) return "bg-amber-50 border-l-4 border-l-amber-400";
  return "";
}

function daysBadge(days?: number): { label: string; cls: string } {
  if (days === undefined || days === null) return { label: "—", cls: "text-gray-400" };
  if (days < 0)   return { label: `${Math.abs(days)}d overdue`, cls: "text-red-600 font-bold" };
  if (days <= 7)  return { label: `${days}d left`,              cls: "text-orange-600 font-bold" };
  if (days <= 14) return { label: `${days}d left`,              cls: "text-amber-600 font-semibold" };
  return { label: `${days}d left`, cls: "text-emerald-600" };
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function freshnessLabel(calculatedAt?: string): string {
  if (!calculatedAt) return "";
  const ms   = Date.now() - new Date(calculatedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1)    return "just now";
  if (mins < 60)   return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ReorderClockPage() {
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [loading, setLoading]           = useState(true);
  const [recomputingAll, setRecomputingAll]     = useState(false);
  const [recomputingRow, setRecomputingRow]     = useState<string | null>(null);
  const [lastRun, setLastRun]           = useState<LastRun | null>(null);

  const [search, setSearch]             = useState("");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [methodFilter, setMethodFilter]   = useState<MethodFilter>("all");
  const [sortField, setSortField]         = useState<SortField>("days");
  const [sortDir, setSortDir]             = useState<SortDir>("asc");

  // ── Data fetch ────────────────────────────────────────────────────────────
  const fetchCustomers = useCallback(async () => {
    try {
      const { data } = await api.get<{ data: Customer[] }>("/customers/reorder-clock");
      setCustomers(data.data);
    } catch {
      // fallback: use plain /customers (no pet/product names but at least shows data)
      try {
        const { data } = await api.get<{ data: Customer[] }>("/customers");
        setCustomers(data.data);
      } catch {}
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // ── Batch recompute ───────────────────────────────────────────────────────
  async function recomputeAll() {
    setRecomputingAll(true);
    try {
      const { data } = await api.post<{ data: LastRun }>("/jobs/recompute-clock");
      setLastRun(data.data);
      setLoading(true);
      await fetchCustomers();
    } catch {}
    setRecomputingAll(false);
  }

  // ── Single-customer recompute ─────────────────────────────────────────────
  async function recomputeOne(customerId: string) {
    setRecomputingRow(customerId);
    try {
      await api.post(`/jobs/recompute-clock/${customerId}`);
      // Refresh just that customer by re-fetching the full list (keeps state simple)
      await fetchCustomers();
    } catch {}
    setRecomputingRow(null);
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const withPredictions = customers.filter(c => c.daysUntilRunout !== undefined);
  const noPredictions   = customers.filter(c => c.daysUntilRunout === undefined);
  const overdue         = withPredictions.filter(c => (c.daysUntilRunout ?? 0) < 0);
  const urgent          = withPredictions.filter(c => { const d = c.daysUntilRunout ?? 99; return d >= 0 && d <= 7; });

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = urgencyFilter === "pending"
      ? [...noPredictions]
      : [...withPredictions];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.userId?.name?.toLowerCase().includes(q) ||
        c.userId?.email?.toLowerCase().includes(q)
      );
    }

    if (urgencyFilter === "overdue") list = list.filter(c => (c.daysUntilRunout ?? 0) < 0);
    if (urgencyFilter === "urgent")  list = list.filter(c => { const d = c.daysUntilRunout ?? 99; return d >= 0 && d <= 7; });
    if (urgencyFilter === "safe")    list = list.filter(c => (c.daysUntilRunout ?? -1) > 14);

    if (methodFilter !== "all" && urgencyFilter !== "pending") {
      list = list.filter(c => c.runoutPredictions?.[0]?.method === methodFilter);
    }

    list = [...list].sort((a, b) => {
      let diff = 0;
      if (sortField === "days") {
        diff = (a.daysUntilRunout ?? 9999) - (b.daysUntilRunout ?? 9999);
      } else if (sortField === "confidence") {
        diff = (b.runoutPredictions?.[0]?.confidence ?? 0) - (a.runoutPredictions?.[0]?.confidence ?? 0);
      } else if (sortField === "ltv") {
        diff = b.ltv - a.ltv;
      }
      return sortDir === "asc" ? diff : -diff;
    });

    return list;
  }, [customers, search, urgencyFilter, methodFilter, sortField, sortDir, withPredictions, noPredictions]);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronsUpDown size={12} className="text-gray-300" />;
    return sortDir === "asc" ? <ChevronUp size={12} className="text-violet-500" /> : <ChevronDown size={12} className="text-violet-500" />;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <CrmLayout title="Reorder Clock" subtitle="Section A — cold-start · blended · empirical runout predictions per customer">
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-5">

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Overdue",          value: overdue.length,         Icon: AlertTriangle,  textCls: "text-red-600",     bgCls: "bg-red-50",     borderCls: "border-red-100",     desc: "runout date passed" },
            { label: "Urgent ≤7 days",   value: urgent.length,          Icon: TrendingDown,   textCls: "text-orange-600",  bgCls: "bg-orange-50",  borderCls: "border-orange-100",  desc: "needs action now" },
            { label: "With Predictions", value: withPredictions.length, Icon: CheckCircle,    textCls: "text-emerald-600", bgCls: "bg-emerald-50", borderCls: "border-emerald-100", desc: "clock computed" },
            { label: "Pending Compute",  value: noPredictions.length,   Icon: Users,          textCls: "text-gray-500",    bgCls: "bg-gray-50",    borderCls: "border-gray-200",    desc: "no orders yet" },
          ].map(s => (
            <div key={s.label} className={`${s.bgCls} border ${s.borderCls} rounded-2xl p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <s.Icon size={15} className={s.textCls} />
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{s.label}</p>
              </div>
              <p className={`text-4xl font-bold tracking-tight ${s.textCls}`}>{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-2 font-medium">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {/* Search */}
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customers…"
                className="border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white w-52"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" strokeWidth="2" />
                <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>

            {/* Urgency filter */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 flex-wrap">
              {(["all", "overdue", "urgent", "safe", "pending"] as UrgencyFilter[]).map(u => (
                <button
                  key={u}
                  onClick={() => setUrgencyFilter(u)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    urgencyFilter === u ? "bg-violet-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {u === "all" ? "All" : u === "pending" ? "No Data" : u}
                </button>
              ))}
            </div>

            {/* Method filter (hidden when showing pending) */}
            {urgencyFilter !== "pending" && (
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1">
                {(["all", "cold-start", "blended", "empirical"] as MethodFilter[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMethodFilter(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      methodFilter === m ? "bg-violet-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {m === "all" ? "All methods" : m}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {lastRun && (
              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl leading-tight">
                <span className="font-bold">{lastRun.processed}</span> processed · <span className="font-bold">{lastRun.errors}</span> errors
                <span className="text-emerald-500 ml-1">({Math.round(lastRun.durationMs / 1000)}s)</span>
              </div>
            )}
            <button
              onClick={recomputeAll}
              disabled={recomputingAll}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-violet-200"
            >
              {recomputingAll ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {recomputingAll ? "Recomputing…" : "Recompute All"}
            </button>
          </div>
        </div>

        {/* ── Summary line ── */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Clock size={13} className="text-violet-400" />
          <span>
            Showing <span className="font-bold text-gray-700">{filtered.length}</span>
            {" "}of{" "}
            <span className="font-bold text-gray-700">
              {urgencyFilter === "pending" ? noPredictions.length : withPredictions.length}
            </span>
            {" "}customers
            {customers.length > 0 && <span className="text-gray-300 ml-1">({customers.length} total)</span>}
          </span>
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm text-gray-400 font-medium">Loading reorder clock data…</p>
            </div>
          ) : filtered.length === 0 && urgencyFilter === "pending" && noPredictions.length === 0 ? (
            // All customers have predictions — great state
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <CheckCircle size={40} className="text-emerald-400 opacity-70" />
              <p className="font-semibold text-emerald-600">All customers have predictions</p>
              <p className="text-sm">Click "Recompute All" to refresh stale values</p>
            </div>
          ) : filtered.length === 0 && withPredictions.length === 0 ? (
            // Clock has never been run
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Clock size={44} className="text-violet-300" />
              <div className="text-center">
                <p className="font-bold text-gray-700 text-base">No predictions computed yet</p>
                <p className="text-sm text-gray-400 mt-1">Click "Recompute All" to run the clock for all customers</p>
              </div>
              <button
                onClick={recomputeAll}
                disabled={recomputingAll}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all"
              >
                {recomputingAll ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {recomputingAll ? "Running…" : "Run Reorder Clock"}
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-2">
              <Clock size={40} className="opacity-25" />
              <p className="font-semibold text-gray-500">No customers match the current filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Segment</th>
                    {urgencyFilter !== "pending" && (
                      <>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none group" onClick={() => toggleSort("days")}>
                          <span className="flex items-center gap-1">Days Remaining <SortIcon field="days" /></span>
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pet · Product</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Method</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none group" onClick={() => toggleSort("confidence")}>
                          <span className="flex items-center gap-1">Confidence <SortIcon field="confidence" /></span>
                        </th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Runout Date</th>
                        <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Computed</th>
                      </>
                    )}
                    {urgencyFilter === "pending" && (
                      <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Orders</th>
                    )}
                    <th className="px-5 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(c => {
                    const pred   = c.runoutPredictions?.[0];
                    const badge  = daysBadge(c.daysUntilRunout);
                    const rStyle = rowStyle(c.daysUntilRunout);
                    const isRecomputing = recomputingRow === c._id;

                    return (
                      <tr key={c._id} className={`transition-colors hover:brightness-[0.97] ${rStyle}`}>
                        {/* Customer */}
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-gray-900">{c.userId?.name ?? "—"}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{c.userId?.email}</p>
                          <p className="text-[10px] text-gray-300 mt-0.5">LTV ₹{c.ltv.toLocaleString("en-IN")}</p>
                        </td>

                        {/* Segment */}
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEG_COLOR[c.segment] ?? "bg-gray-100 text-gray-600"}`}>
                            {c.segment}
                          </span>
                        </td>

                        {/* Days / urgency (only when not in "pending" view) */}
                        {urgencyFilter !== "pending" && (
                          <>
                            <td className="px-5 py-3.5">
                              <span className={`text-sm ${badge.cls}`}>{badge.label}</span>
                            </td>

                            {/* Pet · Product */}
                            <td className="px-5 py-3.5">
                              {pred?.pet ? (
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">
                                    {SPECIES_EMOJI[pred.pet.species] ?? "🐾"} {pred.pet.name}
                                  </p>
                                  {pred.product && (
                                    <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[140px]" title={pred.product.name}>
                                      {pred.product.name}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-xs">—</span>
                              )}
                            </td>

                            {/* Method */}
                            <td className="px-5 py-3.5">
                              {pred?.method ? (
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${METHOD_PILL[pred.method] ?? "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                                  {pred.method}
                                </span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>

                            {/* Confidence */}
                            <td className="px-5 py-3.5">
                              {pred?.confidence !== undefined ? (
                                <div className="flex items-center gap-2 min-w-[90px]">
                                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${pred.confidence >= 80 ? "bg-emerald-500" : pred.confidence >= 50 ? "bg-violet-500" : "bg-amber-400"}`}
                                      style={{ width: `${pred.confidence}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 font-medium tabular-nums w-8 text-right">{pred.confidence}%</span>
                                </div>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>

                            {/* Runout Date */}
                            <td className="px-5 py-3.5 text-xs text-gray-500 font-medium">
                              {fmtDate(c.nextRunoutAt)}
                            </td>

                            {/* Freshness */}
                            <td className="px-5 py-3.5">
                              {pred?.calculatedAt ? (
                                <span className="text-[11px] text-gray-400">{freshnessLabel(pred.calculatedAt)}</span>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                          </>
                        )}

                        {/* Orders count (pending view) */}
                        {urgencyFilter === "pending" && (
                          <td className="px-5 py-3.5 text-xs text-gray-500">
                            {c.orderCount} order{c.orderCount !== 1 ? "s" : ""}
                          </td>
                        )}

                        {/* Recompute action */}
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => recomputeOne(c._id)}
                            disabled={isRecomputing || recomputingAll}
                            title="Recompute this customer's clock"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 disabled:opacity-50 rounded-xl transition-all"
                          >
                            {isRecomputing
                              ? <Loader2 size={12} className="animate-spin" />
                              : <RotateCcw size={12} />}
                            {isRecomputing ? "…" : "Sync"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Info size={13} className="text-gray-400" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">How Predictions Work</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                pill: "cold-start", pillCls: "bg-gray-100 text-gray-600 border border-gray-200",
                title: "Feeding Guide × Pack Size",
                desc: "Used for customers with ≤1 order. Relies entirely on product specs and standard feeding guides. Confidence: 40–65%.",
              },
              {
                pill: "blended", pillCls: "bg-blue-100 text-blue-700 border border-blue-200",
                title: "Weighted Mix",
                desc: "Used for 2–3 orders. Blends empirical order intervals with the feeding-guide estimate. Confidence grows with each new order.",
              },
              {
                pill: "empirical", pillCls: "bg-emerald-100 text-emerald-700 border border-emerald-200",
                title: "Median Order Interval",
                desc: "Used for 4+ orders. Derived from the customer's real purchase cadence — most accurate prediction method.",
              },
            ].map(m => (
              <div key={m.pill} className="flex items-start gap-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 mt-0.5 ${m.pillCls}`}>{m.pill}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{m.title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Urgency Colors</p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded font-semibold">Red border — overdue (past runout date)</span>
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold">Orange — ≤7 days remaining</span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-semibold">Amber — 8–14 days remaining</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Buttons</p>
              <div className="space-y-1 text-[11px] text-gray-500">
                <p><span className="font-bold text-gray-700">Recompute All</span> — runs the clock for every customer in one batch. Use after new orders arrive.</p>
                <p><span className="font-bold text-gray-700">Sync</span> — recomputes the clock for a single customer row, instantly refreshing that customer's prediction.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </CrmLayout>
  );
}
