import { useState, useEffect } from "react";
import Link from "next/link";
import CrmLayout from "@/components/layout/CrmLayout";
import { Search, Mail, Phone, ShoppingBag, Star, MoreVertical, Send, Clock, Users, ExternalLink } from "lucide-react";
import api from "@/lib/api";

interface Pet {
  name: string;
  species: string;
  breed: string;
  age: number;
  weight: number;
}

interface Customer {
  _id: string;
  userId: { name: string; email: string };
  phone?: string;
  pets: Pet[];
  ltv: number;
  orderCount: number;
  lastOrderDays: number;
  daysUntilRunout?: number;
  confidence?: number;
  segment?: string;
}


const SEGMENT_STYLE: Record<string, string> = {
  "High LTV": "bg-violet-100 text-violet-700 border-violet-200",
  Loyal: "bg-emerald-100 text-emerald-700 border-emerald-200",
  "At Risk": "bg-red-100 text-red-700 border-red-200",
  Growing: "bg-blue-100 text-blue-700 border-blue-200",
};

type TabKey = "overview" | "orders" | "pets" | "communications" | "activity";
const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "orders", label: "Orders" },
  { key: "pets", label: "Pets" },
  { key: "communications", label: "Communications" },
];

function RunoutRing({ days, confidence }: { days: number; confidence: number }) {
  const pct = Math.max(0, Math.min(1, days / 30));
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = circ * (1 - pct);

  const getColor = () => {
    if (days <= 7) return "#EF4444"; // Red
    if (days <= 14) return "#F97316"; // Orange
    return "#8B5CF6"; // Violet
  };

  return (
    <div className="flex flex-col items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90 drop-shadow-sm" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#F3F4F6" strokeWidth="6" />
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={getColor()}
            strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 tracking-tight">{days}</span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">days left</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3 text-center font-medium">
        Predicted run-out<br />
        <span className="text-violet-600 font-bold bg-violet-50 px-2 py-0.5 rounded-full mt-1 inline-block">{confidence}% confidence</span>
      </p>
    </div>
  );
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const [tab, setTab] = useState<TabKey>("overview");
  const pet = customer.pets[0];
  const speciesEmoji = pet?.species === "Dog" ? "🐶" : pet?.species === "Cat" ? "🐱" : "🐾";

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#F8F9FA]">
      {/* Header Profile */}
      <div className="p-8 border-b border-gray-100 bg-white shadow-sm z-10 relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none opacity-50"></div>
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-violet-500/30">
              {customer.userId.name[0]}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{customer.userId.name}</h2>
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                <Mail size={14} /> {customer.userId.email}
              </p>
              {customer.segment && (
                <span className={`inline-block text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider border mt-3 ${SEGMENT_STYLE[customer.segment] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                  {customer.segment}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/crm/customers/${customer._id}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <ExternalLink size={13} /> View 360°
            </Link>
            <button className="w-9 h-9 bg-white border border-gray-200 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-50 transition-colors shadow-sm">
              <MoreVertical size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-8 flex border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto custom-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-4 text-sm font-bold whitespace-nowrap border-b-[3px] transition-all -mb-px ${
              tab === t.key ? "border-violet-600 text-violet-700" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar relative">
        {tab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { icon: ShoppingBag, label: "Total Orders", value: customer.orderCount, color: "blue" },
                { icon: Star, label: "Lifetime Value", value: `₹${customer.ltv.toLocaleString("en-IN")}`, color: "amber" },
                { icon: Clock, label: "Last Order", value: `${customer.lastOrderDays} days ago`, color: "emerald" },
                { icon: Phone, label: "Phone", value: customer.phone ?? "Not provided", color: "slate" },
              ].map(({ icon: Icon, label, value, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow group">
                  <div className={`w-8 h-8 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon size={16} />
                  </div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-lg font-bold text-gray-900 truncate">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Pet Info & Prediction */}
              {pet && (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><span className="text-xl">{speciesEmoji}</span> Primary Pet</h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Name</p>
                        <p className="text-base font-bold text-gray-900">{pet.name}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Breed</p>
                          <p className="text-sm font-semibold text-gray-700">{pet.breed}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stats</p>
                          <p className="text-sm font-semibold text-gray-700">{pet.age}yr · {pet.weight}kg</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {customer.daysUntilRunout !== undefined && (
                    <RunoutRing days={customer.daysUntilRunout} confidence={customer.confidence ?? 80} />
                  )}
                </div>
              )}

              {/* Smart Actions */}
              <div className="bg-gradient-to-br from-violet-900 to-indigo-900 rounded-3xl p-6 text-white shadow-xl shadow-violet-900/20 relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
                <div>
                  <h3 className="text-sm font-bold text-violet-200 uppercase tracking-wider mb-2">Recommended Action</h3>
                  <p className="text-lg font-bold leading-tight mb-4">Send a highly personalized restock reminder to secure retention.</p>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 py-3 bg-white text-violet-900 text-sm font-bold rounded-xl hover:scale-[1.02] transition-transform shadow-lg flex items-center justify-center gap-2">
                    <Send size={16} /> Auto-Send
                  </button>
                  <button className="flex-1 py-3 bg-violet-800 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition-colors border border-violet-700">
                    Draft Manual
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "pets" && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
            {customer.pets.map((p, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner">
                    {p.species === "Dog" ? "🐶" : p.species === "Cat" ? "🐱" : "🐾"}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-gray-900">{p.name}</p>
                    <p className="text-sm font-medium text-gray-500">{p.breed}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-xl p-3">
                  <div className="text-center border-r border-gray-200">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Age</p>
                    <p className="text-sm font-bold text-gray-800">{p.age} years</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Weight</p>
                    <p className="text-sm font-bold text-gray-800">{p.weight} kg</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(tab === "orders" || tab === "communications") && (
          <div className="flex flex-col items-center justify-center h-64 text-center animate-in fade-in duration-300 bg-white rounded-3xl border border-gray-100 border-dashed">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 mb-4 shadow-sm">
              <Search size={24} />
            </div>
            <p className="text-lg font-bold text-gray-900 mb-1">No data available yet</p>
            <p className="text-sm text-gray-500">History will appear here once connected to live backend systems.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);

  useEffect(() => {
    api.get<{ data: Customer[] }>("/customers").then(({ data }) => {
      if (data.data?.length) {
        setCustomers(data.data);
        setSelected(data.data[0]);
      }
    }).catch(() => {});
  }, []);

  const filtered = customers.filter((c) =>
    c.userId.name.toLowerCase().includes(search.toLowerCase()) ||
    c.userId.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <CrmLayout title="Customer Directory" subtitle="Manage and view detailed customer profiles">
      <div className="flex h-[calc(100vh-85px)] overflow-hidden m-4 lg:m-8 rounded-3xl border border-gray-200 bg-white shadow-sm">
        
        {/* Left: customer list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-[#FDFDFD] flex flex-col overflow-hidden relative z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-4 border-b border-gray-100 bg-white">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100 bg-gray-50 transition-all font-medium"
                placeholder="Search customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filtered.map((c) => (
              <button
                key={c._id}
                onClick={() => setSelected(c)}
                className={`w-full text-left p-3 rounded-2xl transition-all ${
                  selected?._id === c._id 
                  ? "bg-violet-600 shadow-md shadow-violet-500/20 translate-x-1" 
                  : "bg-transparent hover:bg-gray-100 text-gray-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-inner ${selected?._id === c._id ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>
                    {c.userId.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold truncate ${selected?._id === c._id ? 'text-white' : 'text-gray-900'}`}>{c.userId.name}</p>
                    <p className={`text-xs truncate font-medium ${selected?._id === c._id ? 'text-violet-200' : 'text-gray-500'}`}>{c.userId.email}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-hidden bg-[#F8F9FA] relative z-10">
          {selected ? (
            <CustomerDetail customer={selected} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-20 h-20 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm text-gray-300 mb-4">
                <Users size={32} />
              </div>
              <p className="text-xl font-bold text-gray-900 mb-1">Select a customer</p>
              <p className="text-sm text-gray-500">Click on a customer from the left sidebar to view their full profile, pet details, and AI predictions.</p>
            </div>
          )}
        </div>
        
      </div>
    </CrmLayout>
  );
}
