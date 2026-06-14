import { useState, useEffect, useCallback, useRef } from "react";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  MousePointerClick,
  ShoppingCart,
  Send,
  Waves,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  Zap,
} from "lucide-react";
import api from "@/lib/api";

interface CommEvent {
  type: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Communication {
  _id: string;
  campaignId: { _id: string; name: string; channel: string } | string;
  customerId: { userId?: { name?: string } } | string;
  channel: string;
  recipient: string;
  message: string;
  status: string;
  events: CommEvent[];
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  clickedAt?: string;
  convertedAt?: string;
  attributedRevenue?: number;
  createdAt: string;
}

type ChannelFilter = "all" | "whatsapp" | "sms" | "email" | "rcs";
type StatusFilter =
  | "all"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "converted"
  | "failed";

const STATUS_COLOR: Record<string, string> = {
  queued: "bg-gray-100 text-gray-500",
  sent: "bg-blue-100 text-blue-700",
  delivered: "bg-cyan-100 text-cyan-700",
  opened: "bg-violet-100 text-violet-700",
  clicked: "bg-amber-100 text-amber-700",
  converted: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-600",
  bounced: "bg-orange-100 text-orange-600",
};

const STATUS_DOT: Record<string, string> = {
  queued: "bg-gray-400",
  sent: "bg-blue-500",
  delivered: "bg-cyan-500",
  opened: "bg-violet-500",
  clicked: "bg-amber-500",
  converted: "bg-emerald-500",
  failed: "bg-red-500",
  bounced: "bg-orange-500",
};

const CH_COLOR: Record<string, string> = {
  whatsapp: "bg-emerald-100 text-emerald-700",
  email: "bg-violet-100 text-violet-700",
  sms: "bg-blue-100 text-blue-700",
  rcs: "bg-amber-100 text-amber-700",
};

const CH_EMOJI: Record<string, string> = {
  whatsapp: "💬",
  email: "📧",
  sms: "📱",
  rcs: "🎯",
};

const FUNNEL_STAGES = ["sent", "delivered", "opened", "clicked", "converted"];

const EVENT_ICON: Record<string, React.ReactNode> = {
  queued: <Clock size={11} />,
  sent: <Send size={11} />,
  delivered: <CheckCircle size={11} />,
  opened: <Eye size={11} />,
  clicked: <MousePointerClick size={11} />,
  converted: <ShoppingCart size={11} />,
  failed: <XCircle size={11} />,
  bounced: <AlertCircle size={11} />,
};

const STAT_CARDS = [
  {
    key: "total",
    label: "Total Events",
    color: "text-gray-700",
    bg: "bg-gray-50",
    icon: Waves,
    iconColor: "text-gray-400",
  },
  {
    key: "delivered",
    label: "Delivered",
    color: "text-cyan-700",
    bg: "bg-cyan-50",
    icon: CheckCircle,
    iconColor: "text-cyan-500",
  },
  {
    key: "opened",
    label: "Opened",
    color: "text-violet-700",
    bg: "bg-violet-50",
    icon: Eye,
    iconColor: "text-violet-500",
  },
  {
    key: "converted",
    label: "Converted",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    icon: ShoppingCart,
    iconColor: "text-emerald-500",
  },
];

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function CommCard({
  comm,
  expanded,
  onToggle,
}: {
  comm: Communication;
  expanded: boolean;
  onToggle: () => void;
}) {
  const campaignName =
    typeof comm.campaignId === "object" && comm.campaignId !== null
      ? (comm.campaignId as { name: string }).name
      : "Unknown Campaign";

  const customerName =
    typeof comm.customerId === "object" && comm.customerId !== null
      ? (comm.customerId as { userId?: { name?: string } }).userId?.name ?? "Customer"
      : "Customer";

  return (
    <div className="bg-white border-b border-gray-50 last:border-b-0">
      <div
        onClick={onToggle}
        className="flex items-start gap-4 p-4 hover:bg-gray-50/50 cursor-pointer transition-colors select-none"
      >
        <div className="flex-shrink-0 mt-0.5">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
              CH_COLOR[comm.channel] ?? "bg-gray-100 text-gray-500"
            }`}
          >
            {CH_EMOJI[comm.channel]} {comm.channel}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-bold text-gray-900 truncate">{customerName}</p>
            <span className="text-xs text-gray-300">·</span>
            <p className="text-xs text-gray-400 truncate">{comm.recipient}</p>
          </div>
          <p className="text-xs text-gray-500 truncate mb-1.5">{comm.message}</p>
          <p className="text-xs text-gray-400 font-medium">{campaignName}</p>

          <div className="flex items-center gap-1 mt-2">
            {FUNNEL_STAGES.map((stage, i) => {
              const reached = comm.events.some((e) => e.type === stage);
              const isCurrent = comm.status === stage;
              return (
                <div key={stage} className="flex items-center gap-1">
                  {i > 0 && (
                    <div
                      className={`w-4 h-px ${reached ? "bg-gray-300" : "bg-gray-100"}`}
                    />
                  )}
                  <div
                    title={stage}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      isCurrent
                        ? "bg-violet-600 text-white ring-2 ring-violet-200"
                        : reached
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-gray-100 text-gray-300"
                    }`}
                  >
                    {EVENT_ICON[stage]}
                  </div>
                </div>
              );
            })}
            {comm.attributedRevenue && comm.attributedRevenue > 0 && (
              <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                ₹{comm.attributedRevenue}
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-right flex flex-col items-end gap-2">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[comm.status] ?? "bg-gray-100 text-gray-500"}`}
          >
            {comm.status}
          </span>
          <p className="text-xs text-gray-400">
            {new Date(comm.createdAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-gray-300">
            {new Date(comm.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </p>
          {expanded ? (
            <ChevronUp size={13} className="text-gray-300" />
          ) : (
            <ChevronDown size={13} className="text-gray-300" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-5 pb-5 pt-4">
          <div className="grid lg:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Full Message
              </p>
              <div className="bg-white border border-gray-200 rounded-xl p-3 text-sm text-gray-700 leading-relaxed">
                {comm.message}
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-gray-400">
                <p>
                  <span className="font-medium">ID:</span>{" "}
                  <span className="font-mono text-gray-500">{comm._id}</span>
                </p>
                <p>
                  <span className="font-medium">Recipient:</span> {comm.recipient}
                </p>
                <p>
                  <span className="font-medium">Campaign:</span> {campaignName}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Event Timeline
              </p>
              {comm.events.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No events recorded yet.</p>
              ) : (
                <div className="space-y-2">
                  {comm.events.map((ev, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          STATUS_COLOR[ev.type] ?? "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {EVENT_ICON[ev.type] ?? <Clock size={11} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-gray-700 capitalize">
                            {ev.type}
                          </span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatTs(ev.timestamp)}
                          </span>
                        </div>
                        {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                          <p className="text-[10px] font-mono text-gray-400 bg-white border border-gray-100 rounded px-1.5 py-0.5 mt-0.5 truncate">
                            {JSON.stringify(ev.metadata)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EventStreamPage() {
  const [comms, setComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: Communication[] }>("/communications");
      setComms(data.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        load();
      }, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, load]);

  const filtered = comms.filter((c) => {
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    return true;
  });

  const stats = {
    total: comms.length,
    delivered: comms.filter((c) => ["delivered", "opened", "clicked", "converted"].includes(c.status)).length,
    opened: comms.filter((c) => ["opened", "clicked", "converted"].includes(c.status)).length,
    converted: comms.filter((c) => c.status === "converted").length,
  };

  return (
    <CrmLayout
      title="Event Stream"
      subtitle="Real-time communication events with monotonic state machine tracking"
    >
      <div className="p-8 max-w-6xl mx-auto space-y-5">

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {autoRefresh ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Live
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400">
                <span className="w-2 h-2 bg-gray-300 rounded-full" />
                Paused
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${
                  autoRefresh ? "bg-emerald-500" : "bg-gray-200"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    autoRefresh ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
              <span className="text-xs font-semibold text-gray-600">Auto-refresh (5s)</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-bold rounded-xl transition-all shadow-sm"
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh Now
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {STAT_CARDS.map((s) => (
            <div
              key={s.key}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {s.label}
                </p>
                <div className={`w-8 h-8 ${s.bg} rounded-xl flex items-center justify-center`}>
                  <s.icon size={15} className={s.iconColor} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>
                {stats[s.key as keyof typeof stats]}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Channel</span>
            <div className="flex gap-1">
              {(["all", "whatsapp", "sms", "email", "rcs"] as ChannelFilter[]).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannelFilter(ch)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    channelFilter === ch
                      ? "bg-violet-600 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {ch === "all" ? "All" : `${CH_EMOJI[ch]} ${ch}`}
                </button>
              ))}
            </div>
          </div>

          <div className="h-5 w-px bg-gray-200" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Status</span>
            <div className="flex gap-1 flex-wrap">
              {(["all", "sent", "delivered", "opened", "clicked", "converted", "failed"] as StatusFilter[]).map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                      statusFilter === s
                        ? "bg-violet-600 text-white"
                        : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                    }`}
                  >
                    {s !== "all" && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          statusFilter === s ? "bg-white" : STATUS_DOT[s]
                        }`}
                      />
                    )}
                    {s}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="ml-auto text-xs text-gray-400 font-medium">
            {filtered.length} of {comms.length} shown
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading && comms.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-violet-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Waves size={40} className="mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-gray-500">No communications match your filters</p>
              <p className="text-sm mt-1">
                {comms.length === 0
                  ? "Launch a campaign to see events here"
                  : "Try adjusting the channel or status filters"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <div className="w-20 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Channel
                </div>
                <div className="flex-1 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Customer / Message
                </div>
                <div className="hidden lg:flex items-center gap-1 w-40 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  <Zap size={10} /> Funnel
                </div>
                <div className="w-24 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">
                  Status
                </div>
              </div>
              {filtered.map((c) => (
                <CommCard
                  key={c._id}
                  comm={c}
                  expanded={expanded === c._id}
                  onToggle={() => setExpanded(expanded === c._id ? null : c._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </CrmLayout>
  );
}
