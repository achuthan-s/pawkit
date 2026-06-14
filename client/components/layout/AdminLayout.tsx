import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingBag,
  Bell,
  Search,
  LogOut,
  ShieldAlert
} from "lucide-react";

const NAV = [
  { href: "/admin/overview",   icon: LayoutDashboard, label: "Overview"  },
  { href: "/admin/customers",  icon: Users,            label: "Customers" },
  { href: "/admin/orders",     icon: Package,          label: "Orders"    },
  { href: "/admin/products",   icon: ShoppingBag,      label: "Products"  },
  { href: "/admin/system",     icon: ShieldAlert,      label: "System"    },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
}

export default function AdminLayout({ children, title, subtitle, showHeader = true }: AdminLayoutProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div className="flex h-screen bg-[#F4F5F7] overflow-hidden font-sans selection:bg-blue-500/20 selection:text-blue-700">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        {/* Logo */}
        <div className="px-6 py-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <span className="text-sm">⚙️</span>
            </div>
            <div>
              <p className="text-gray-900 font-bold text-base leading-tight tracking-wide">PawKit Admin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          <p className="px-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Management</p>
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = router.pathname.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon size={18} className={active ? "text-blue-600" : "text-gray-400"} strokeWidth={active ? 2.5 : 2} />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-inner">
                A
              </div>
              <div className="min-w-0">
                <p className="text-gray-900 text-sm font-bold truncate">Admin</p>
                <p className="text-gray-500 text-xs truncate font-medium">System Manager</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-700 transition-colors p-2" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {showHeader && (
          <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-5 flex items-center justify-between flex-shrink-0 sticky top-0 z-30 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
            <div>
              {title && <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{title}</h1>}
              {subtitle && <p className="text-sm text-gray-500 mt-1 font-medium">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Global search..." 
                  className="pl-9 pr-4 py-2 w-64 bg-gray-100 border border-transparent rounded-full text-sm focus:bg-white focus:border-blue-200 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
              <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
              <button className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 hover:bg-white hover:border-gray-300 hover:shadow-sm transition-all relative group">
                <Bell size={18} className="group-hover:text-blue-600 transition-colors" />
                <span className="absolute top-2 right-2.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white" />
              </button>
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
