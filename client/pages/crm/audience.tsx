import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  Search, Users, Loader2, MessageSquare, Mail, Phone, Rss,
  SlidersHorizontal, X, CheckCircle, Filter, Trash2, Bookmark,
  BookmarkCheck, ChevronRight, AlertCircle, Download, Megaphone,
} from "lucide-react";
import api from "@/lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface Member {
  customerId: string;
  name: string;
  email: string;
  phone?: string;
  segment: string;
  ltv: number;
  orderCount: number;
  daysUntilRunout?: number;
  channelOptIns: { whatsapp: boolean; sms: boolean; email: boolean; rcs: boolean };
}

interface AudienceResult {
  total: number;
  members: Member[];
  channelBreakdown: { whatsapp: number; sms: number; email: number; rcs: number };
}

interface SavedSegment {
  _id: string;
  name: string;
  filterState: FilterState;
  lastTotal: number;
  createdAt: string;
}

interface FilterState {
  segments: string[];
  petType: string;
  channel: string;
  minLtv: string;
  maxLtv: string;
  minOrders: string;
  maxRunout: string;
  inactiveDays: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const SEGMENTS = ["high-ltv", "loyal", "growing", "at-risk", "inactive", "new"] as const;

const SEG_STYLES: Record<string, { active: string; idle: string }> = {
  "high-ltv": { active: "bg-violet-600 text-white border-violet-600",   idle: "bg-violet-50 text-violet-700 border-violet-200 hover:border-violet-400" },
  loyal:      { active: "bg-emerald-600 text-white border-emerald-600", idle: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400" },
  growing:    { active: "bg-blue-600 text-white border-blue-600",       idle: "bg-blue-50 text-blue-700 border-blue-200 hover:border-blue-400" },
  "at-risk":  { active: "bg-amber-600 text-white border-amber-600",     idle: "bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-400" },
  inactive:   { active: "bg-red-600 text-white border-red-600",         idle: "bg-red-50 text-red-600 border-red-200 hover:border-red-400" },
  new:        { active: "bg-gray-600 text-white border-gray-600",       idle: "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-400" },
};

const SEG_TABLE_COLOR: Record<string, string> = {
  "high-ltv": "bg-violet-100 text-violet-700",
  loyal:      "bg-emerald-100 text-emerald-700",
  growing:    "bg-blue-100 text-blue-700",
  "at-risk":  "bg-amber-100 text-amber-700",
  inactive:   "bg-red-100 text-red-600",
  new:        "bg-gray-100 text-gray-600",
};

const CHANNEL_META = [
  { key: "whatsapp" as const, label: "WhatsApp", Icon: MessageSquare, barCls: "bg-emerald-500", iconCls: "text-emerald-500", bgCls: "bg-emerald-50", borderCls: "border-emerald-100", textCls: "text-emerald-700" },
  { key: "sms"      as const, label: "SMS",       Icon: Phone,         barCls: "bg-blue-500",    iconCls: "text-blue-500",    bgCls: "bg-blue-50",    borderCls: "border-blue-100",    textCls: "text-blue-700" },
  { key: "email"    as const, label: "Email",     Icon: Mail,          barCls: "bg-violet-500",  iconCls: "text-violet-500",  bgCls: "bg-violet-50",  borderCls: "border-violet-100",  textCls: "text-violet-700" },
  { key: "rcs"      as const, label: "RCS",       Icon: Rss,           barCls: "bg-amber-500",   iconCls: "text-amber-500",   bgCls: "bg-amber-50",   borderCls: "border-amber-100",   textCls: "text-amber-700" },
];

type PetType = "" | "dog" | "cat" | "bird" | "other";
type Channel = "" | "whatsapp" | "sms" | "email" | "rcs";

// ── Helpers ──────────────────────────────────────────────────────────────────

function runoutDisplay(days?: number): { label: string; cls: string } {
  if (days === undefined || days === null) return { label: "—", cls: "text-gray-300" };
  if (days < 0)   return { label: `${Math.abs(days)}d overdue`, cls: "text-red-600 font-bold" };
  if (days <= 7)  return { label: `${days}d`,                   cls: "text-orange-600 font-semibold" };
  if (days <= 14) return { label: `${days}d`,                   cls: "text-amber-600" };
  return { label: `${days}d`, cls: "text-gray-600" };
}

function downloadCSV(members: Member[]) {
  const header = "Name,Email,Phone,Segment,LTV,Orders,Days Until Runout,WhatsApp,SMS,Email,RCS";
  const rows = members.map(m =>
    [
      `"${m.name}"`, `"${m.email}"`, m.phone ?? "",
      m.segment, m.ltv, m.orderCount,
      m.daysUntilRunout ?? "",
      m.channelOptIns.whatsapp ? "yes" : "no",
      m.channelOptIns.sms      ? "yes" : "no",
      m.channelOptIns.email    ? "yes" : "no",
      m.channelOptIns.rcs      ? "yes" : "no",
    ].join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `audience-${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// Serialise params so arrays use repeat format: segments=a&segments=b
// This is what Express parses into req.query.segments as a proper string[]
function buildQS(f: FilterState): string {
  const sp = new URLSearchParams();
  f.segments.forEach(s => sp.append("segments", s));
  if (f.channel)      sp.set("channelOptIn", f.channel);
  if (f.minLtv)       sp.set("minLtv", f.minLtv);
  if (f.maxLtv)       sp.set("maxLtv", f.maxLtv);
  if (f.maxRunout)    sp.set("maxDaysUntilRunout", f.maxRunout);
  if (f.minOrders)    sp.set("minOrderCount", f.minOrders);
  if (f.inactiveDays) sp.set("lastOrderDaysMin", f.inactiveDays);
  if (f.petType)      sp.set("targetSpecies", f.petType);
  return sp.toString();
}

const BLANK_FILTER: FilterState = {
  segments: [], petType: "", channel: "", minLtv: "",
  maxLtv: "", minOrders: "", maxRunout: "", inactiveDays: "",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function AudiencePage() {
  const router = useRouter();

  const [filters, setFilters]               = useState<FilterState>(BLANK_FILTER);
  const [result,  setResult]                = useState<AudienceResult | null>(null);
  const [loading, setLoading]               = useState(false);
  const [error,   setError]                 = useState("");

  const [savedSegments, setSavedSegments]   = useState<SavedSegment[]>([]);
  const [loadingSaved,  setLoadingSaved]    = useState(true);
  const [saveMode,      setSaveMode]        = useState(false);
  const [saveName,      setSaveName]        = useState("");
  const [saving,        setSaving]          = useState(false);
  const [saveSuccess,   setSaveSuccess]     = useState(false);
  const [deletingId,    setDeletingId]      = useState<string | null>(null);

  const [searchQ, setSearchQ]               = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Saved segments ───────────────────────────────────────────────────────

  async function fetchSavedSegments() {
    try {
      const { data } = await api.get<{ data: SavedSegment[] }>("/segments/");
      setSavedSegments(data.data);
    } catch {
      /* non-fatal */
    } finally {
      setLoadingSaved(false);
    }
  }

  useEffect(() => { fetchSavedSegments(); }, []);

  // ── Preview ──────────────────────────────────────────────────────────────

  const doPreview = useCallback(async (f: FilterState) => {
    setLoading(true);
    setError("");
    try {
      const qs = buildQS(f);
      const { data } = await api.get<{ data: AudienceResult }>(`/segments/preview?${qs}`);
      setResult(data.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to load audience. Please try again.");
    }
    setLoading(false);
  }, []);

  // Auto-preview on mount
  useEffect(() => { doPreview(BLANK_FILTER); }, [doPreview]);

  // Debounced re-preview whenever filters change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doPreview(filters), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, doPreview]);

  // ── Filter helpers ───────────────────────────────────────────────────────

  function toggleSeg(s: string) {
    setFilters(prev => ({
      ...prev,
      segments: prev.segments.includes(s) ? prev.segments.filter(x => x !== s) : [...prev.segments, s],
    }));
  }

  function setField<K extends keyof FilterState>(k: K, v: FilterState[K]) {
    setFilters(prev => ({ ...prev, [k]: v }));
  }

  function clearFilters() { setFilters(BLANK_FILTER); }

  const activeFilterCount = [
    filters.segments.length > 0, filters.petType !== "", filters.channel !== "",
    filters.minLtv !== "", filters.maxLtv !== "", filters.minOrders !== "",
    filters.maxRunout !== "", filters.inactiveDays !== "",
  ].filter(Boolean).length;

  // ── Save / delete segment ────────────────────────────────────────────────

  async function handleSave() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post<{ data: SavedSegment }>("/segments/", {
        name:        saveName.trim(),
        filterState: { ...filters },
        lastTotal:   result?.total ?? 0,
      });
      setSavedSegments(prev => [data.data, ...prev]);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setSaveMode(false);
        setSaveName("");
      }, 2500);
    } catch {
      /* handled silently — rare */
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await api.delete(`/segments/${id}`);
      setSavedSegments(prev => prev.filter(s => s._id !== id));
    } catch {
      /* non-fatal */
    } finally {
      setDeletingId(null);
    }
  }

  function loadSegment(seg: SavedSegment) {
    setFilters({ ...BLANK_FILTER, ...(seg.filterState as Partial<FilterState>), segments: (seg.filterState as FilterState).segments ?? [] });
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const ch    = result?.channelBreakdown;
  const total = result?.total ?? 0;
  function reachPct(count: number) { return total ? Math.round((count / total) * 100) : 0; }

  const filteredMembers = (result?.members ?? []).filter(m =>
    !searchQ ||
    m.name.toLowerCase().includes(searchQ.toLowerCase()) ||
    m.email.toLowerCase().includes(searchQ.toLowerCase()),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <CrmLayout title="Audience Builder" subtitle="Resolve customer segments with smart filters and channel opt-ins">
      <div className="p-6 max-w-screen-2xl mx-auto">
        <div className="flex gap-5 items-start">

          {/* ── Left sidebar ──────────────────────────────────────────────── */}
          <div className="w-[320px] flex-shrink-0 space-y-4">

            {/* Filters card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={15} className="text-violet-500" />
                  <h2 className="text-sm font-bold text-gray-900">Audience Filters</h2>
                  {activeFilterCount > 0 && (
                    <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    title="Clear all filters"
                    className="text-[11px] text-gray-400 hover:text-red-500 font-medium transition-colors flex items-center gap-1"
                  >
                    <X size={11} /> Clear
                  </button>
                )}
              </div>

              {/* Segment multi-select */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                  Segments <span className="normal-case font-normal">(multi-select)</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SEGMENTS.map(s => {
                    const style  = SEG_STYLES[s];
                    const active = filters.segments.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggleSeg(s)}
                        title={`Toggle ${s} segment`}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active ? style.active : style.idle}`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">Select one or more — OR logic (any match)</p>
              </div>

              {/* Pet species */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Pet Species</p>
                <div className="flex flex-wrap gap-1.5">
                  {([["", "All"], ["dog", "🐕 Dogs"], ["cat", "🐈 Cats"], ["bird", "🐦 Birds"], ["other", "Other"]] as [PetType, string][]).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setField("petType", val)}
                      title={`Filter by ${label} owners`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        filters.petType === val
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Channel opt-in */}
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Channel Opt-In</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHANNEL_META.map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      onClick={() => setField("channel", filters.channel === key ? "" : key as Channel)}
                      title={`Only customers opted into ${label}`}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                        filters.channel === key
                          ? "bg-violet-600 text-white border-violet-600"
                          : "bg-white text-gray-500 border-gray-200 hover:border-violet-300 hover:text-violet-600"
                      }`}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">Select one channel to filter opt-ins</p>
              </div>

              {/* Numeric filters */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Min LTV (₹)</p>
                    <input
                      type="number" min="0"
                      value={filters.minLtv}
                      onChange={e => setField("minLtv", e.target.value)}
                      placeholder="e.g. 2000"
                      title="Only customers with LTV ≥ this value"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white"
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Max LTV (₹)</p>
                    <input
                      type="number" min="0"
                      value={filters.maxLtv}
                      onChange={e => setField("maxLtv", e.target.value)}
                      placeholder="e.g. 20000"
                      title="Only customers with LTV ≤ this value"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Min Total Orders</p>
                  <input
                    type="number" min="0"
                    value={filters.minOrders}
                    onChange={e => setField("minOrders", e.target.value)}
                    placeholder="e.g. 3"
                    title="Only customers with at least this many orders"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Max Days Until Runout</p>
                  <input
                    type="number" min="0"
                    value={filters.maxRunout}
                    onChange={e => setField("maxRunout", e.target.value)}
                    placeholder="e.g. 14"
                    title="Show customers whose pet food runs out within this many days"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white"
                  />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">No Order in Last (days)</p>
                  <input
                    type="number" min="0"
                    value={filters.inactiveDays}
                    onChange={e => setField("inactiveDays", e.target.value)}
                    placeholder="e.g. 30"
                    title="Customers whose last order was more than this many days ago"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white"
                  />
                </div>
              </div>

              <button
                onClick={() => doPreview(filters)}
                disabled={loading}
                title="Run the audience query with current filters"
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-all shadow-sm shadow-violet-200"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Filter size={15} />}
                {loading ? "Resolving…" : "Preview Audience"}
              </button>
            </div>

            {/* Save segment card */}
            {result && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                {!saveMode && !saveSuccess && (
                  <button
                    onClick={() => setSaveMode(true)}
                    title="Save the current filter set as a named segment for reuse"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 hover:border-violet-300 text-gray-500 hover:text-violet-600 text-sm font-bold rounded-xl transition-all"
                  >
                    <Bookmark size={14} /> Save as Named Segment
                  </button>
                )}
                {saveMode && !saveSuccess && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-500">Segment name</p>
                    <input
                      type="text"
                      value={saveName}
                      onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") { setSaveMode(false); setSaveName(""); } }}
                      placeholder="e.g. High-LTV Dog Owners on WA"
                      maxLength={100}
                      autoFocus
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={!saveName.trim() || saving}
                        className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : <BookmarkCheck size={12} />}
                        {saving ? "Saving…" : "Save Segment"}
                      </button>
                      <button
                        onClick={() => { setSaveMode(false); setSaveName(""); }}
                        className="px-4 py-2 border border-gray-200 text-gray-500 text-xs font-bold rounded-xl hover:bg-gray-50 transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {saveSuccess && (
                  <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-700">Segment saved!</p>
                      <p className="text-[11px] text-emerald-600">&quot;{saveName}&quot; is now in your saved segments.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saved segments list */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bookmark size={14} className="text-violet-500" />
                <h3 className="text-sm font-bold text-gray-900">Saved Segments</h3>
              </div>
              {loadingSaved ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 size={13} className="animate-spin" /> Loading…
                </div>
              ) : savedSegments.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">
                  No saved segments yet. Build a filter and click "Save as Named Segment" above.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {savedSegments.map(seg => (
                    <div
                      key={seg._id}
                      className="flex items-center justify-between gap-2 group px-3 py-2 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50/40 transition-all"
                    >
                      <button
                        onClick={() => loadSegment(seg)}
                        title={`Load "${seg.name}" filters`}
                        className="flex-1 min-w-0 text-left"
                      >
                        <p className="text-xs font-bold text-gray-800 truncate">{seg.name}</p>
                        <p className="text-[10px] text-gray-400">{seg.lastTotal} customers</p>
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => loadSegment(seg)}
                          title="Apply these filters"
                          className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-500 transition-colors"
                        >
                          <ChevronRight size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(seg._id)}
                          disabled={deletingId === seg._id}
                          title="Delete this saved segment"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors disabled:opacity-50"
                        >
                          {deletingId === seg._id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Main content ─────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-100 text-red-700 rounded-2xl px-5 py-4">
                <AlertCircle size={16} className="flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Active:</span>
                {filters.segments.map(s => (
                  <span key={s} className={`text-xs font-bold px-2.5 py-1 rounded-full border ${SEG_STYLES[s]?.active ?? "bg-violet-100 text-violet-700 border-violet-200"} flex items-center gap-1`}>
                    {s}
                    <button onClick={() => toggleSeg(s)} className="opacity-60 hover:opacity-100"><X size={10} /></button>
                  </span>
                ))}
                {filters.petType   && <Chip label={`${filters.petType} owners`}      onRemove={() => setField("petType", "")} />}
                {filters.channel   && <Chip label={`opt-in: ${filters.channel}`}      onRemove={() => setField("channel", "")} />}
                {filters.minLtv    && <Chip label={`LTV ≥ ₹${filters.minLtv}`}       onRemove={() => setField("minLtv", "")} />}
                {filters.maxLtv    && <Chip label={`LTV ≤ ₹${filters.maxLtv}`}       onRemove={() => setField("maxLtv", "")} />}
                {filters.minOrders && <Chip label={`orders ≥ ${filters.minOrders}`}   onRemove={() => setField("minOrders", "")} />}
                {filters.maxRunout && <Chip label={`runout ≤ ${filters.maxRunout}d`}  onRemove={() => setField("maxRunout", "")} />}
                {filters.inactiveDays && <Chip label={`inactive ${filters.inactiveDays}d+`} onRemove={() => setField("inactiveDays", "")} />}
              </div>
            )}

            {/* Channel KPI cards */}
            {result && (
              <div className="grid grid-cols-4 gap-3">
                {CHANNEL_META.map(({ key, label, Icon, bgCls, borderCls, iconCls, textCls }) => {
                  const count = ch?.[key] ?? 0;
                  return (
                    <div key={key} className={`${bgCls} border ${borderCls} rounded-2xl p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 bg-white/60 rounded-lg flex items-center justify-center">
                          <Icon size={14} className={iconCls} />
                        </div>
                        <p className={`text-xs font-bold ${textCls}`}>{label}</p>
                      </div>
                      <p className={`text-3xl font-bold ${textCls}`}>{count.toLocaleString()}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{total > 0 ? `${reachPct(count)}% reachable` : "—"}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Member table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Users size={15} className="text-violet-500" />
                  <p className="font-bold text-gray-900 text-sm">
                    {loading
                      ? <span className="text-gray-400">Resolving…</span>
                      : <><span className="text-violet-600">{total.toLocaleString()}</span> customers matched</>}
                  </p>
                  {loading && <Loader2 size={13} className="animate-spin text-violet-400" />}
                </div>
                <div className="flex items-center gap-2">
                  {result && total > 0 && (
                    <>
                      {/* Search within results */}
                      <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                          value={searchQ}
                          onChange={e => setSearchQ(e.target.value)}
                          placeholder="Search members…"
                          className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 w-44"
                        />
                      </div>
                      {/* Export CSV */}
                      <button
                        onClick={() => downloadCSV(result.members)}
                        title="Download audience as CSV"
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-50 transition-all"
                      >
                        <Download size={12} /> Export CSV
                      </button>
                      {/* Use in Campaign */}
                      <button
                        onClick={() => router.push("/crm/campaigns")}
                        title="Go to Campaigns to launch a campaign for this audience"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all"
                      >
                        <Megaphone size={12} /> Use in Campaign
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!result && !loading && (
                <div className="py-16 text-center text-gray-400 space-y-2">
                  <Users size={32} className="mx-auto opacity-20" />
                  <p className="font-semibold text-gray-500">Loading audience…</p>
                </div>
              )}

              {result && result.members.length === 0 && !loading && (
                <div className="py-16 text-center text-gray-400 space-y-2">
                  <Users size={32} className="mx-auto opacity-20" />
                  <p className="font-semibold text-gray-500">No customers match these filters</p>
                  <p className="text-sm">Try broadening your criteria or clearing filters</p>
                  <button
                    onClick={clearFilters}
                    className="mt-2 text-xs font-bold text-violet-600 hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {filteredMembers.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {["Name / Email", "Segment", "LTV", "Orders", "Runout", "WA", "SMS", "Email", "RCS"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredMembers.map(m => {
                        const runout = runoutDisplay(m.daysUntilRunout);
                        return (
                          <tr key={m.customerId} className="hover:bg-gray-50/60 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-gray-900">{m.name}</p>
                              <p className="text-[11px] text-gray-400">{m.email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SEG_TABLE_COLOR[m.segment] ?? "bg-gray-100 text-gray-600"}`}>
                                {m.segment}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-700 tabular-nums">
                              ₹{m.ltv.toLocaleString("en-IN")}
                            </td>
                            <td className="px-4 py-3 text-gray-600 tabular-nums">{m.orderCount}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs ${runout.cls}`}>{runout.label}</span>
                            </td>
                            {(["whatsapp", "sms", "email", "rcs"] as const).map(key => (
                              <td key={key} className="px-4 py-3 text-center">
                                <span className={`text-sm font-bold ${m.channelOptIns[key] ? "text-emerald-500" : "text-gray-200"}`}>
                                  {m.channelOptIns[key] ? "✓" : "✗"}
                                </span>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {searchQ && filteredMembers.length < (result?.total ?? 0) && (
                    <p className="px-6 py-3 text-[11px] text-gray-400 border-t border-gray-50">
                      Showing {filteredMembers.length} of {result?.total.toLocaleString()} — clear search to see all
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Channel reachability bars */}
            {result && total > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Channel Reachability</p>
                <div className="space-y-3">
                  {CHANNEL_META.map(({ key, label, Icon, iconCls, bgCls, barCls }) => {
                    const count = ch?.[key] ?? 0;
                    const pct   = reachPct(count);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className={`w-7 h-7 ${bgCls} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <Icon size={13} className={iconCls} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-gray-700">{label}</p>
                            <span className="text-xs font-bold text-gray-500 tabular-nums">{count.toLocaleString()} ({pct}%)</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${barCls}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-4 border-t border-gray-50 pt-3">
                  % of <span className="font-bold text-gray-600">{total.toLocaleString()}</span> matched customers reachable per channel
                </p>
              </div>
            )}

            {/* Legend / help */}
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">How it works</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-500">
                <p><span className="font-bold text-gray-700">Segments</span> — OR-logic: any selected segment matches</p>
                <p><span className="font-bold text-gray-700">Pet Species</span> — customers who own at least one pet of that type</p>
                <p><span className="font-bold text-gray-700">Channel Opt-In</span> — only customers opted into that channel</p>
                <p><span className="font-bold text-gray-700">LTV range</span> — lifetime value between min and max</p>
                <p><span className="font-bold text-gray-700">Min Orders</span> — customers who placed at least N orders</p>
                <p><span className="font-bold text-gray-700">Max Days Until Runout</span> — urgency filter for reorder campaigns</p>
                <p><span className="font-bold text-gray-700">No Order in Last N days</span> — win-back / re-engagement filter</p>
                <p><span className="font-bold text-gray-700">Save Segment</span> — saves filter set for reuse in future campaigns</p>
                <p><span className="font-bold text-gray-700">Export CSV</span> — downloads all matched members for offline use</p>
                <p><span className="font-bold text-gray-700">Use in Campaign</span> — go to Campaigns to launch with this audience</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CrmLayout>
  );
}

// ── Chip helper ───────────────────────────────────────────────────────────────

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-gray-100 text-gray-600 border-gray-200 flex items-center gap-1">
      {label}
      <button onClick={onRemove} className="opacity-60 hover:opacity-100"><X size={10} /></button>
    </span>
  );
}
