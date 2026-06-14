import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard, Megaphone, Users, BarChart3, Settings,
  Bell, LogOut, Clock, Radio, Zap, Brain, Waves,
  AlertTriangle, CheckCircle, Info, X, Loader2,
} from "lucide-react";
import api from "@/lib/api";

const NAV_SECTIONS = [
  {
    label: "INTELLIGENCE",
    items: [
      { href: "/crm/dashboard",      icon: LayoutDashboard, label: "Dashboard",       badge: null },
      { href: "/crm/reorder-clock",  icon: Clock,           label: "Reorder Clock",   badge: null },
      { href: "/crm/audience",       icon: Users,           label: "Audience",        badge: null },
      { href: "/crm/ai-studio",      icon: Brain,           label: "AI Studio",       badge: null },
    ],
  },
  {
    label: "CAMPAIGNS",
    items: [
      { href: "/crm/campaigns",  icon: Megaphone, label: "Campaigns",    badge: null },
      { href: "/crm/events",     icon: Waves,     label: "Event Stream", badge: null },
      { href: "/crm/analytics",  icon: BarChart3, label: "Analytics",    badge: null },
      { href: "/crm/radar",      icon: Radio,     label: "Radar Scan",   badge: null },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/crm/settings", icon: Settings, label: "Settings", badge: null },
    ],
  },
];

interface NotifItem {
  id: string;
  type: "warning" | "success" | "info";
  title: string;
  body: string;
  time: string;
}

function buildNotifications(campaigns: { name: string; status: string }[], urgentCount: number): NotifItem[] {
  const items: NotifItem[] = [];

  if (urgentCount > 0) {
    items.push({
      id: "runout-urgent",
      type: "warning",
      title: `${urgentCount} customer${urgentCount > 1 ? "s" : ""} with urgent runout`,
      body: "Pet food running out within 7 days. Consider launching a reorder campaign.",
      time: "Now",
    });
  }

  const running = campaigns.filter((c) => c.status === "running");
  if (running.length > 0) {
    items.push({
      id: "campaigns-running",
      type: "success",
      title: `${running.length} campaign${running.length > 1 ? "s" : ""} currently live`,
      body: running.slice(0, 2).map((c) => c.name).join(", ") + (running.length > 2 ? ` +${running.length - 2} more` : ""),
      time: "Active",
    });
  }

  const pending = campaigns.filter((c) => c.status === "pending_approval");
  if (pending.length > 0) {
    items.push({
      id: "campaigns-pending",
      type: "info",
      title: `${pending.length} campaign${pending.length > 1 ? "s" : ""} awaiting approval`,
      body: pending.slice(0, 2).map((c) => c.name).join(", "),
      time: "Pending",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-clear",
      type: "success",
      title: "All systems normal",
      body: "No urgent alerts. Campaigns are running smoothly.",
      time: "Now",
    });
  }

  return items;
}

interface CrmLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
}

export default function CrmLayout({ children, title, subtitle, showHeader = true }: CrmLayoutProps) {
  const router = useRouter();
  const [showNotif, setShowNotif]     = useState(false);
  const [notifs,    setNotifs]        = useState<NotifItem[]>([]);
  const [dismissed, setDismissed]     = useState<Set<string>>(new Set());
  const [loadingNotif, setLoadingNotif] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  const fetchNotifications = useCallback(async () => {
    setLoadingNotif(true);
    try {
      const [campRes, clockRes] = await Promise.allSettled([
        api.get<{ data: { name: string; status: string }[] }>("/campaigns"),
        api.get<{ data: { daysUntilRunout?: number }[] }>("/customers/reorder-clock"),
      ]);

      const campaigns = campRes.status === "fulfilled" ? (campRes.value.data?.data ?? []) : [];
      const clock     = clockRes.status === "fulfilled" ? (clockRes.value.data?.data ?? []) : [];
      const urgentCount = clock.filter(
        (c) => c.daysUntilRunout !== undefined && c.daysUntilRunout !== null && c.daysUntilRunout <= 7,
      ).length;

      setNotifs(buildNotifications(campaigns, urgentCount));
    } catch {
      /* non-fatal */
    } finally {
      setLoadingNotif(false);
    }
  }, []);

  // Fetch on first open
  useEffect(() => {
    if (showNotif && notifs.length === 0) fetchNotifications();
  }, [showNotif, notifs.length, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotif(false);
      }
    }
    if (showNotif) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showNotif]);

  const visible = notifs.filter((n) => !dismissed.has(n.id));
  const unreadCount = visible.length;

  const NOTIF_ICON: Record<NotifItem["type"], React.ReactNode> = {
    warning: <AlertTriangle size={14} className="text-amber-500" />,
    success: <CheckCircle   size={14} className="text-emerald-500" />,
    info:    <Info          size={14} className="text-blue-500" />,
  };

  const NOTIF_BG: Record<NotifItem["type"], string> = {
    warning: "bg-amber-50 border-amber-100",
    success: "bg-emerald-50 border-emerald-100",
    info:    "bg-blue-50 border-blue-100",
  };

  return (
    <div className="flex h-screen bg-[#F8F9FA] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0B0F19] flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-violet-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-500/20">
              <span className="text-sm">🐾</span>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">PawKit CRM</p>
              <p className="text-violet-400 text-[10px] font-medium">AI-Native Reorder Intelligence</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 text-[9px] font-bold text-slate-600 uppercase tracking-widest mb-2">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map(({ href, icon: Icon, label, badge }) => {
                  const active = router.pathname === href || router.pathname.startsWith(href + "/");
                  return (
                    <Link key={href} href={href}>
                      <div
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer group ${
                          active
                            ? "bg-violet-500/10 text-violet-400"
                            : "text-slate-400 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon size={16} className={active ? "text-violet-400" : "text-slate-500 group-hover:text-slate-300"} strokeWidth={active ? 2.5 : 2} />
                        <span className="flex-1">{label}</span>
                        {badge && (
                          <span className={`text-[9px] font-black w-4 h-4 rounded flex items-center justify-center ${
                            active ? "bg-violet-500 text-white" : "bg-slate-700 text-slate-400 group-hover:bg-slate-600"
                          }`}>
                            {badge}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          <div className="bg-white/5 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-600 to-violet-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                M
              </div>
              <div className="min-w-0">
                <p className="text-white text-xs font-bold truncate">Maya Sharma</p>
                <p className="text-violet-400 text-[10px] truncate">marketer@pawkit.dev</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-white transition-colors p-1.5" title="Sign out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {showHeader && (
          <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 px-8 py-4 flex items-center justify-between flex-shrink-0 sticky top-0 z-30">
            <div>
              {title    && <h1 className="text-xl font-bold text-gray-900 tracking-tight">{title}</h1>}
              {subtitle && <p className="text-xs text-gray-400 mt-0.5 font-medium">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-3">
              <Zap size={14} className="text-violet-400" />
              <span className="text-xs text-gray-400 font-medium">AI-Native CRM</span>
              <div className="h-4 w-px bg-gray-200" />

              {/* Notification bell */}
              <div className="relative" ref={panelRef}>
                <button
                  onClick={() => setShowNotif((v) => !v)}
                  title="Notifications"
                  className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-all shadow-sm relative"
                >
                  <Bell size={15} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotif && (
                  <div className="absolute right-0 top-10 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-bold text-gray-900">Notifications</p>
                      <div className="flex items-center gap-2">
                        {loadingNotif && <Loader2 size={12} className="animate-spin text-violet-400" />}
                        <button
                          onClick={() => fetchNotifications()}
                          title="Refresh notifications"
                          className="text-xs text-violet-500 hover:text-violet-700 font-bold"
                        >
                          Refresh
                        </button>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                      {loadingNotif && visible.length === 0 ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
                          <Loader2 size={16} className="animate-spin" /> Loading…
                        </div>
                      ) : visible.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-sm">
                          <CheckCircle size={24} className="mx-auto mb-2 text-emerald-400" />
                          All caught up!
                        </div>
                      ) : (
                        visible.map((n) => (
                          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 border ${NOTIF_BG[n.type]}`}>
                            <div className="mt-0.5 flex-shrink-0">{NOTIF_ICON[n.type]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-gray-800">{n.title}</p>
                              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                              <p className="text-[10px] text-gray-400 mt-1 font-medium">{n.time}</p>
                            </div>
                            <button
                              onClick={() => setDismissed((prev) => new Set([...prev, n.id]))}
                              title="Dismiss"
                              className="text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0 mt-0.5"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => setDismissed(new Set(notifs.map((n) => n.id)))}
                        className="text-[11px] text-gray-400 hover:text-gray-600 font-medium transition-colors"
                      >
                        Dismiss all
                      </button>
                      <Link href="/crm/analytics" onClick={() => setShowNotif(false)}>
                        <span className="text-[11px] text-violet-600 hover:text-violet-800 font-bold transition-colors">
                          View Analytics →
                        </span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        )}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
