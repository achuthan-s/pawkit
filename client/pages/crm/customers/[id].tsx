import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import CrmLayout from "@/components/layout/CrmLayout";
import {
  ArrowLeft, Mail, Phone, MapPin, Tag, PawPrint, ShoppingBag,
  MessageSquare, TrendingUp, Clock, Calendar, Check, ChevronDown,
  ChevronRight, AlertTriangle, Shield, Package, Zap, Send,
  ExternalLink, RefreshCw, Activity, Star,
} from "lucide-react";
import api from "@/lib/api";
import type {
  CrmCustomer, CrmPet, CrmOrder, CrmCommunication,
  RunoutPrediction, CustomerSegment,
} from "@/types";

// ── Config maps ─────────────────────────────────────────────────────────────

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐶", cat: "🐱", bird: "🐦", rabbit: "🐰", other: "🐾",
};

type SegmentKey = CustomerSegment;
const SEGMENT: Record<SegmentKey, { label: string; color: string; bg: string; border: string; dot: string }> = {
  "high-ltv": { label: "High LTV",  color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200",  dot: "bg-violet-500"  },
  loyal:       { label: "Loyal",     color: "text-emerald-700",bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  "at-risk":   { label: "At Risk",   color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500"     },
  new:         { label: "New",       color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",    dot: "bg-blue-500"    },
  growing:     { label: "Growing",   color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-500"   },
  inactive:    { label: "Inactive",  color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-200",    dot: "bg-gray-400"    },
};

const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Processing", cls: "bg-amber-50  text-amber-700  border-amber-200"  },
  confirmed: { label: "Confirmed",  cls: "bg-blue-50   text-blue-700   border-blue-200"   },
  packed:    { label: "Packed",     cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  shipped:   { label: "In Transit", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  delivered: { label: "Delivered",  cls: "bg-green-50  text-green-700  border-green-200"  },
  cancelled: { label: "Cancelled",  cls: "bg-red-50    text-red-700    border-red-200"    },
};

const CHANNEL: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  whatsapp: { label: "WhatsApp", color: "text-green-700",  bg: "bg-green-50",  icon: "💬" },
  email:    { label: "Email",    color: "text-blue-700",   bg: "bg-blue-50",   icon: "📧" },
  sms:      { label: "SMS",      color: "text-violet-700", bg: "bg-violet-50", icon: "📱" },
  rcs:      { label: "RCS",      color: "text-indigo-700", bg: "bg-indigo-50", icon: "💎" },
};

const COMM_STATUS: Record<string, { label: string; cls: string }> = {
  queued:    { label: "Queued",    cls: "bg-gray-100    text-gray-600"    },
  sent:      { label: "Sent",      cls: "bg-blue-50     text-blue-600"    },
  delivered: { label: "Delivered", cls: "bg-teal-50     text-teal-700"    },
  opened:    { label: "Opened",    cls: "bg-emerald-50  text-emerald-700" },
  clicked:   { label: "Clicked",   cls: "bg-violet-50   text-violet-700"  },
  failed:    { label: "Failed",    cls: "bg-red-50      text-red-700"     },
  bounced:   { label: "Bounced",   cls: "bg-orange-50   text-orange-700"  },
};

const TRACKING_STEPS = [
  { key: "ordered",          label: "Ordered"     },
  { key: "packed",           label: "Packed"      },
  { key: "shipped",          label: "Shipped"     },
  { key: "out_for_delivery", label: "In Transit"  },
  { key: "delivered",        label: "Delivered"   },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ago(d?: string) {
  if (!d) return "Never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function petAge(pet: CrmPet) {
  if (pet.dob) {
    const yrs = Math.floor((Date.now() - new Date(pet.dob).getTime()) / (365.25 * 86_400_000));
    return `${yrs} yr${yrs !== 1 ? "s" : ""}`;
  }
  if (pet.age != null) return `${pet.age} yr${pet.age !== 1 ? "s" : ""}`;
  return "—";
}

// ── RunoutRing ───────────────────────────────────────────────────────────────

function RunoutRing({ days, confidence, size = 88 }: { days: number; confidence: number; size?: number }) {
  const r      = size * 0.38;
  const circ   = 2 * Math.PI * r;
  const offset = circ * Math.max(0, 1 - days / 30);
  const color  = days <= 5 ? "#EF4444" : days <= 14 ? "#F97316" : "#8B5CF6";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={size * 0.065} />
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color}
            strokeWidth={size * 0.065}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-bold text-gray-900 leading-none" style={{ fontSize: size * 0.21 }}>{days}</span>
          <span className="font-bold text-gray-400 uppercase tracking-widest leading-none mt-0.5" style={{ fontSize: size * 0.1 }}>days</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-gray-400">{confidence}% conf.</span>
    </div>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
      <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4 shadow-sm">{icon}</div>
      <p className="text-base font-bold text-gray-900 mb-1">{title}</p>
      <p className="text-sm text-gray-400 max-w-xs leading-relaxed">{desc}</p>
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="w-9 h-9 bg-gray-50 rounded-xl flex items-center justify-center mb-3 text-gray-500">{icon}</div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-gray-900 mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5 font-medium">{sub}</p>}
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ customer, orders, onTabSwitch }: { customer: CrmCustomer; orders: CrmOrder[]; onTabSwitch: (t: string) => void }) {
  const seg         = SEGMENT[customer.segment] ?? SEGMENT.inactive;
  const defaultAddr = customer.addresses.find((a) => a.isDefault) ?? customer.addresses[0];
  const avgOrder    = customer.orderCount > 0 ? Math.round(customer.ltv / customer.orderCount) : 0;
  const recent      = orders.slice(0, 3);
  const urgentPred  = customer.runoutPredictions.find((p) => p.daysUntilRunout <= 7);

  return (
    <div className="space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={<TrendingUp size={17} />} label="Lifetime Value"  value={`₹${customer.ltv.toLocaleString("en-IN")}`} sub={`avg ₹${avgOrder.toLocaleString("en-IN")} per order`} />
        <StatCard icon={<ShoppingBag size={17} />} label="Total Orders"   value={customer.orderCount} sub={customer.orderCount === 0 ? "no orders yet" : "all time"} />
        <StatCard icon={<Clock size={17} />}        label="Last Order"     value={ago(customer.lastOrderAt)} sub={customer.lastOrderAt ? fmt(customer.lastOrderAt) : undefined} />
        <StatCard icon={<Calendar size={17} />}     label="Member Since"  value={fmt(customer.createdAt)} sub={`${Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / 86_400_000)} days`} />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Segment + Tags */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Segment & Tags</p>
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${seg.bg} ${seg.border}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${seg.dot} flex-shrink-0`} />
            <div>
              <p className={`text-sm font-bold ${seg.color}`}>{seg.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">Customer segment</p>
            </div>
          </div>
          {customer.isBlocked && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle size={14} className="text-red-500" />
              <p className="text-xs font-bold text-red-600">Account Blocked</p>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {customer.tags.length > 0
              ? customer.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                    <Tag size={9} /> {tag}
                  </span>
                ))
              : <p className="text-xs text-gray-400">No tags assigned</p>}
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Delivery Addresses</p>
          {customer.addresses.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <MapPin size={20} className="text-gray-200 mb-2" />
              <p className="text-xs text-gray-400">No addresses saved</p>
            </div>
          ) : (
            customer.addresses.map((addr, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${addr.isDefault ? "border-violet-200 bg-violet-50/30" : "border-gray-100 bg-gray-50"}`}>
                <MapPin size={13} className={`mt-0.5 flex-shrink-0 ${addr.isDefault ? "text-violet-500" : "text-gray-400"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{addr.label ?? "Address"}</span>
                    {addr.isDefault && <span className="text-[10px] font-bold bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full">Default</span>}
                  </div>
                  <p className="text-xs text-gray-700 font-medium leading-relaxed">
                    {addr.street}, {addr.city}<br />{addr.state} {addr.zip}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* AI Recommendation */}
        <div className="bg-gradient-to-br from-violet-900 to-indigo-900 rounded-2xl p-5 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.2),transparent_60%)] pointer-events-none" />
          <div className="relative z-10 space-y-3 mb-4">
            <div className="flex items-center gap-2">
              <Zap size={13} className="text-violet-300" />
              <p className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">AI Recommendation</p>
            </div>
            {urgentPred ? (
              <p className="text-sm font-semibold text-violet-100 leading-relaxed">
                Food predicted to run out in <span className="text-white font-bold">{urgentPred.daysUntilRunout} days</span>. Send a restock reminder now to prevent churn.
              </p>
            ) : customer.segment === "at-risk" ? (
              <p className="text-sm font-semibold text-violet-100 leading-relaxed">
                At-risk customer. Last order {ago(customer.lastOrderAt).toLowerCase()}. Launch a re-engagement campaign.
              </p>
            ) : (
              <p className="text-sm font-semibold text-violet-100 leading-relaxed">
                Loyal customer with strong LTV. A personalized thank-you offer can deepen retention.
              </p>
            )}
          </div>
          <div className="flex gap-2 relative z-10">
            <button className="flex-1 py-2.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5">
              <Send size={12} /> Send Now
            </button>
            <Link href="/crm/campaigns" className="flex-1 py-2.5 bg-white text-violet-900 text-xs font-bold rounded-xl hover:bg-violet-50 transition-colors flex items-center justify-center gap-1.5">
              <ExternalLink size={12} /> Campaign
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      {recent.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <p className="text-sm font-bold text-gray-900">Recent Orders</p>
            <button onClick={() => onTabSwitch("orders")} className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1">
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {recent.map((order) => {
              const sc = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending;
              return (
                <div key={order._id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Package size={15} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">#{order.orderNumber}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">₹{order.total.toLocaleString("en-IN")}</p>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${sc.cls}`}>{sc.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recent.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-10 text-center">
          <ShoppingBag size={24} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">No orders placed yet</p>
        </div>
      )}
    </div>
  );
}

// ── Pets Tab ─────────────────────────────────────────────────────────────────

function PetsTab({ pets, predictions }: { pets: CrmPet[]; predictions: RunoutPrediction[] }) {
  if (pets.length === 0) {
    return <EmptyState icon={<PawPrint size={22} />} title="No pets registered" desc="No pets have been added to this customer account yet." />;
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      {pets.map((pet) => {
        const pred    = predictions.find((p) => p.petId === pet._id);
        const nextVax = [...pet.vaccinations]
          .filter((v) => v.nextDueAt)
          .sort((a, b) => new Date(a.nextDueAt!).getTime() - new Date(b.nextDueAt!).getTime())[0];

        return (
          <div key={pet._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-3xl border border-violet-100 flex-shrink-0">
                    {SPECIES_EMOJI[pet.species] ?? "🐾"}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{pet.name}</h3>
                    <p className="text-sm text-gray-500 font-medium capitalize">{pet.breed ?? pet.species}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{pet.gender}</span>
                      {pet.isNeutered && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100">Neutered</span>
                      )}
                      {!pet.isActive && (
                        <span className="text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                  </div>
                </div>
                {pred && <RunoutRing days={pred.daysUntilRunout} confidence={pred.confidence} size={68} />}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-50 bg-gray-50/30">
              {[
                { label: "Age",      value: petAge(pet) },
                { label: "Weight",   value: pet.weight ? `${pet.weight} kg` : "—" },
                { label: "Vaccines", value: pet.vaccinations.length },
              ].map(({ label, value }) => (
                <div key={label} className="py-3 text-center">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-5 space-y-4">
              {/* Food prefs */}
              {(pet.foodPreferences?.brand || pet.foodPreferences?.dailyAmountGrams) && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Food Preferences</p>
                  <div className="flex flex-wrap gap-2">
                    {pet.foodPreferences.brand && (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-semibold border border-amber-100">
                        {pet.foodPreferences.brand}
                      </span>
                    )}
                    {pet.foodPreferences.dailyAmountGrams && (
                      <span className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-lg font-semibold border border-gray-200">
                        {pet.foodPreferences.dailyAmountGrams}g / day
                      </span>
                    )}
                    {pet.foodPreferences.feedingsPerDay && (
                      <span className="text-xs bg-gray-50 text-gray-600 px-2.5 py-1 rounded-lg font-semibold border border-gray-200">
                        {pet.foodPreferences.feedingsPerDay}× daily
                      </span>
                    )}
                  </div>
                  {pet.foodPreferences.dietaryNotes && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed italic">{pet.foodPreferences.dietaryNotes}</p>
                  )}
                </div>
              )}

              {/* Next vaccination */}
              {nextVax && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <Shield size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Upcoming Vaccination</p>
                    <p className="text-xs text-amber-600 font-medium mt-0.5">{nextVax.name} · Due {fmt(nextVax.nextDueAt!)}</p>
                    {nextVax.veterinarian && <p className="text-xs text-amber-500 mt-0.5">Dr. {nextVax.veterinarian}</p>}
                  </div>
                </div>
              )}

              {/* Medical notes */}
              {pet.medicalNotes && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Medical Notes</p>
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                    {pet.medicalNotes}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab({ orders, ltv, orderCount }: { orders: CrmOrder[]; ltv: number; orderCount: number }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (orders.length === 0) {
    return <EmptyState icon={<ShoppingBag size={22} />} title="No orders yet" desc="This customer hasn't placed any orders through the platform." />;
  }

  const delivered  = orders.filter((o) => o.status === "delivered").length;
  const avgVal     = orderCount > 0 ? Math.round(ltv / orderCount) : 0;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Orders",     value: orders.length              },
          { label: "Lifetime Value",   value: `₹${ltv.toLocaleString("en-IN")}` },
          { label: "Avg Order Value",  value: `₹${avgVal.toLocaleString("en-IN")}` },
          { label: "Delivered",        value: `${delivered} / ${orders.length}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
        ))}
      </div>

      {/* Order list */}
      <div className="space-y-3">
        {orders.map((order) => {
          const sc         = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending;
          const isExpanded = expandedId === order._id;

          return (
            <div key={order._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50/40 transition-colors select-none"
                onClick={() => setExpandedId(isExpanded ? null : order._id)}
              >
                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Package size={16} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-bold text-gray-900">#{order.orderNumber}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sc.cls}`}>{sc.label}</span>
                    {order.paymentStatus && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${order.paymentStatus === "paid" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {order.paymentStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-medium mt-0.5">
                    {fmt(order.createdAt)} · {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {order.paymentMethod.toUpperCase()}
                  </p>
                </div>
                <div className="text-right mr-2">
                  <p className="text-base font-bold text-gray-900">₹{order.total.toLocaleString("en-IN")}</p>
                  {order.discount > 0 && (
                    <p className="text-xs text-emerald-600 font-semibold">-₹{order.discount} off</p>
                  )}
                </div>
                <ChevronDown size={15} className={`text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
              </div>

              {/* Expanded */}
              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50/30 px-6 py-5 space-y-6">
                  {/* Items */}
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Order Items</p>
                    <div className="space-y-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-100">
                          <div className="w-10 h-10 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {item.productImage
                              ? <img src={item.productImage} className="w-full h-full object-cover" alt="" />
                              : <span className="text-lg">🥣</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{item.productName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{item.selectedSize} · Qty {item.quantity}</p>
                          </div>
                          <p className="text-sm font-bold text-gray-900 flex-shrink-0">
                            ₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Shipping Address</p>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-xs text-gray-700 font-medium leading-relaxed">
                        {order.shippingAddress?.street}, {order.shippingAddress?.city}<br />
                        {order.shippingAddress?.state} {order.shippingAddress?.zip}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Price Breakdown</p>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 space-y-1.5 text-xs">
                        <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="font-semibold text-gray-900">₹{order.subtotal.toLocaleString("en-IN")}</span></div>
                        <div className="flex justify-between text-gray-500"><span>Delivery</span><span className="font-semibold text-gray-900">₹{order.deliveryFee}</span></div>
                        {order.discount > 0 && (
                          <div className="flex justify-between text-emerald-600"><span>Discount</span><span className="font-semibold">-₹{order.discount}</span></div>
                        )}
                        <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100">
                          <span>Total</span><span>₹{order.total.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tracking */}
                  {order.trackingTimeline.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-4">Tracking Progress</p>
                      <div className="flex items-start">
                        {TRACKING_STEPS.map((step, idx) => {
                          const done = order.trackingTimeline.some((e) => e.status === step.key);
                          const nextDone = idx < TRACKING_STEPS.length - 1 && order.trackingTimeline.some((e) => e.status === TRACKING_STEPS[idx + 1].key);
                          return (
                            <div key={step.key} className="flex-1 flex flex-col items-center">
                              <div className="flex items-center w-full">
                                {idx > 0 && <div className={`h-0.5 flex-1 ${done ? "bg-violet-500" : "bg-gray-200"}`} />}
                                <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${done ? "bg-violet-500 border-violet-500 text-white" : "bg-white border-gray-200 text-gray-400"}`}>
                                  {done ? <Check size={12} /> : <span className="text-[10px] font-bold">{idx + 1}</span>}
                                </div>
                                {idx < TRACKING_STEPS.length - 1 && <div className={`h-0.5 flex-1 ${nextDone ? "bg-violet-500" : "bg-gray-200"}`} />}
                              </div>
                              <p className={`text-[9px] font-bold mt-2 text-center leading-tight ${done ? "text-violet-700" : "text-gray-300"}`}>{step.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {order.notes && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Notes</p>
                      <p className="text-xs text-gray-600 bg-white rounded-xl p-3 border border-gray-100 italic">{order.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Communications Tab ───────────────────────────────────────────────────────

function CommunicationsTab({ communications }: { communications: CrmCommunication[] }) {
  const [channelFilter, setChannelFilter] = useState("all");

  if (communications.length === 0) {
    return <EmptyState icon={<MessageSquare size={22} />} title="No messages sent" desc="No campaigns have targeted this customer yet." />;
  }

  const channels  = [...new Set(communications.map((c) => c.channel))];
  const filtered  = channelFilter === "all" ? communications : communications.filter((c) => c.channel === channelFilter);

  const totalSent  = communications.filter((c) => ["sent","delivered","opened","clicked"].includes(c.status)).length;
  const totalDel   = communications.filter((c) => ["delivered","opened","clicked"].includes(c.status)).length;
  const totalOpen  = communications.filter((c) => ["opened","clicked"].includes(c.status)).length;
  const totalClick = communications.filter((c) => c.status === "clicked").length;
  const delRate    = totalSent  > 0 ? Math.round((totalDel  / totalSent)  * 100) : 0;
  const openRate   = totalDel   > 0 ? Math.round((totalOpen / totalDel)   * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Messages",        value: communications.length },
          { label: "Delivery Rate",   value: `${delRate}%`         },
          { label: "Open Rate",       value: `${openRate}%`        },
          { label: "Clicks",          value: totalClick            },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-2">{value}</p>
          </div>
        ))}
      </div>

      {/* Channel filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", ...channels].map((ch) => {
          const cfg = ch === "all" ? null : CHANNEL[ch];
          return (
            <button
              key={ch}
              onClick={() => setChannelFilter(ch)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                channelFilter === ch
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {cfg ? `${cfg.icon} ${cfg.label}` : "All Channels"}
            </button>
          );
        })}
      </div>

      {/* Message timeline */}
      <div className="space-y-3">
        {filtered.map((comm) => {
          const chCfg = CHANNEL[comm.channel] ?? { label: comm.channel, color: "text-gray-600", bg: "bg-gray-50", icon: "💬" };
          const stCfg = COMM_STATUS[comm.status] ?? { label: comm.status, cls: "bg-gray-100 text-gray-600" };
          const campName = typeof comm.campaignId === "object" && comm.campaignId ? comm.campaignId.name : null;

          return (
            <div key={comm._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl ${chCfg.bg} flex items-center justify-center text-xl flex-shrink-0`}>
                  {chCfg.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs font-bold ${chCfg.color}`}>{chCfg.label}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${stCfg.cls}`}>{stCfg.label}</span>
                    {campName && (
                      <span className="text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full border border-violet-100">
                        {campName}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-medium ml-auto">{fmt(comm.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium leading-relaxed line-clamp-2">{comm.message}</p>
                  <p className="text-xs text-gray-400 mt-1.5">To: {comm.recipient}</p>

                  {comm.errorMessage && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <AlertTriangle size={11} /> {comm.errorMessage}
                    </div>
                  )}

                  {comm.events && comm.events.length > 1 && (
                    <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                      {comm.events.map((ev, i) => (
                        <div key={i} className="flex items-center gap-1">
                          {i > 0 && <ChevronRight size={9} className="text-gray-300" />}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${COMM_STATUS[ev.type]?.cls ?? "bg-gray-100 text-gray-500"}`}>
                            {ev.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Predictions Tab ──────────────────────────────────────────────────────────

function PredictionsTab({ predictions, pets }: { predictions: RunoutPrediction[]; pets: CrmPet[] }) {
  if (predictions.length === 0) {
    return (
      <div className="space-y-5">
        <EmptyState icon={<Activity size={22} />} title="No predictions available" desc="Predictions are generated after sufficient order history has been established." />
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp size={15} className="text-violet-500" /> How Runout Predictions Work
          </p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { n: "1", title: "Track Orders", desc: "We monitor purchase frequency and pack sizes to estimate stock." },
              { n: "2", title: "Analyze Patterns", desc: "ML models estimate daily consumption from pet weight and reorder cadence." },
              { n: "3", title: "Predict & Alert", desc: "Alerts fire before runout, enabling proactive personalised outreach." },
            ].map(({ n, title, desc }) => (
              <div key={n} className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-violet-100 text-violet-700 font-bold text-sm rounded-full flex items-center justify-center mx-auto mb-3">{n}</div>
                <p className="text-sm font-bold text-gray-900 mb-1">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const urgent = predictions.filter((p) => p.daysUntilRunout <= 7);

  return (
    <div className="space-y-5">
      {/* Urgency banner */}
      {urgent.length > 0 && (
        <div className="flex items-center gap-4 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-700">Urgent — Food Runout Imminent</p>
            <p className="text-xs text-red-600 mt-0.5">{urgent.length} pet{urgent.length > 1 ? "s" : ""} will run out within 7 days. Send a restock reminder immediately.</p>
          </div>
          <button className="ml-auto px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors flex-shrink-0">
            <Send size={12} /> Send Alert Now
          </button>
        </div>
      )}

      {/* Prediction cards */}
      <div className="grid grid-cols-2 gap-5">
        {predictions.map((pred) => {
          const pet     = pets.find((p) => p._id === pred.petId);
          const urgency = pred.daysUntilRunout <= 5 ? "critical" : pred.daysUntilRunout <= 14 ? "warning" : "normal";
          const uCfg    = {
            critical: { bg: "bg-red-50",    border: "border-red-200",    badge: "bg-red-500",    label: "Critical", bar: "bg-red-500"    },
            warning:  { bg: "bg-amber-50",  border: "border-amber-200",  badge: "bg-amber-500",  label: "Warning",  bar: "bg-amber-500"  },
            normal:   { bg: "bg-violet-50", border: "border-violet-200", badge: "bg-violet-500", label: "On Track", bar: "bg-violet-500" },
          }[urgency];

          return (
            <div key={pred.petId} className={`rounded-2xl border ${uCfg.border} ${uCfg.bg} p-6`}>
              <div className="flex items-start justify-between mb-5">
                <div>
                  <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${uCfg.badge}`}>{uCfg.label}</span>
                  <p className="text-lg font-bold text-gray-900 mt-2">{pet?.name ?? "Unknown Pet"}</p>
                  <p className="text-sm text-gray-500 font-medium capitalize">{pet?.breed ?? pet?.species ?? "—"}</p>
                </div>
                <RunoutRing days={pred.daysUntilRunout} confidence={pred.confidence} size={76} />
              </div>

              <div className="space-y-2.5 mb-5 text-xs">
                {[
                  { label: "Predicted Runout",  value: fmt(pred.predictedRunoutDate)     },
                  { label: "Confidence",        value: `${pred.confidence}%`            },
                  { label: "Last Calculated",   value: ago(pred.calculatedAt)           },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="font-bold text-gray-400 uppercase tracking-wider text-[10px]">{label}</span>
                    <span className="font-bold text-gray-900">{value}</span>
                  </div>
                ))}
              </div>

              {/* Confidence bar */}
              <div className="h-1.5 bg-white/60 rounded-full mb-5 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${uCfg.bar}`} style={{ width: `${pred.confidence}%` }} />
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-900 text-xs font-bold rounded-xl hover:border-gray-300 transition-colors flex items-center justify-center gap-1.5">
                  <Send size={11} /> Send Reminder
                </button>
                <button className="flex-1 py-2.5 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-black transition-colors flex items-center justify-center gap-1.5">
                  <RefreshCw size={11} /> Recalculate
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <p className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Star size={15} className="text-violet-500 fill-violet-500" /> Prediction Summary
        </p>
        <div className="grid grid-cols-3 gap-4 text-center divide-x divide-gray-100">
          <div>
            <p className="text-3xl font-bold text-gray-900">{predictions.length}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">Active Predictions</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {Math.round(predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length)}%
            </p>
            <p className="text-xs text-gray-400 font-medium mt-1">Avg Confidence</p>
          </div>
          <div>
            <p className={`text-3xl font-bold ${urgent.length > 0 ? "text-red-500" : "text-emerald-500"}`}>{urgent.length}</p>
            <p className="text-xs text-gray-400 font-medium mt-1">Urgent (≤ 7 days)</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type TabKey = "overview" | "pets" | "orders" | "communications" | "predictions";
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview",        label: "Overview",        icon: Activity       },
  { key: "pets",            label: "Pets",            icon: PawPrint       },
  { key: "orders",          label: "Orders",          icon: ShoppingBag    },
  { key: "communications",  label: "Communications",  icon: MessageSquare  },
  { key: "predictions",     label: "Predictions",     icon: TrendingUp     },
];

export default function Customer360Page() {
  const router = useRouter();
  const { id } = router.query;

  const [customer, setCustomer]           = useState<CrmCustomer | null>(null);
  const [orders, setOrders]               = useState<CrmOrder[]>([]);
  const [communications, setCommunications] = useState<CrmCommunication[]>([]);
  const [loading, setLoading]             = useState(true);
  const [notFound, setNotFound]           = useState(false);
  const [tab, setTab]                     = useState<TabKey>("overview");

  useEffect(() => {
    if (!id || typeof id !== "string") return;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      api.get<{ data: CrmCustomer }>(`/customers/${id}`),
      api.get<{ data: CrmOrder[] }>(`/customers/${id}/orders`).catch(() => ({ data: { data: [] as CrmOrder[] } })),
      api.get<{ data: CrmCommunication[] }>(`/customers/${id}/communications`).catch(() => ({ data: { data: [] as CrmCommunication[] } })),
    ])
      .then(([cRes, oRes, comRes]) => {
        setCustomer(cRes.data.data);
        setOrders(oRes.data.data ?? []);
        setCommunications(comRes.data.data ?? []);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const customerName  = customer ? (typeof customer.userId === "object" ? customer.userId.name  : "Customer") : "";
  const customerEmail = customer ? (typeof customer.userId === "object" ? customer.userId.email : "")         : "";
  const seg           = customer ? (SEGMENT[customer.segment] ?? SEGMENT.inactive) : null;
  const pets          = (customer?.pets ?? []) as CrmPet[];

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <CrmLayout showHeader={false}>
        <div className="h-14 bg-white border-b border-gray-100 animate-pulse" />
        <div className="p-8 space-y-5">
          <div className="h-44 bg-white rounded-3xl animate-pulse border border-gray-100" />
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map((n) => <div key={n} className="h-28 bg-white rounded-2xl animate-pulse border border-gray-100" />)}
          </div>
          <div className="h-64 bg-white rounded-2xl animate-pulse border border-gray-100" />
        </div>
      </CrmLayout>
    );
  }

  // ── Error / not found ─────────────────────────────────────────────────
  if (notFound || !customer) {
    return (
      <CrmLayout title="Customer 360" subtitle="Customer not found">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
          <AlertTriangle size={40} className="text-red-300 mb-4" />
          <p className="text-xl font-bold text-gray-900 mb-1">Customer not found</p>
          <p className="text-sm text-gray-400 mb-6">The customer with this ID doesn't exist or you don't have access.</p>
          <Link href="/crm/customers" className="text-violet-600 font-semibold text-sm hover:underline flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Customers
          </Link>
        </div>
      </CrmLayout>
    );
  }

  return (
    <CrmLayout showHeader={false}>
      {/* Sticky top nav */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between px-8 py-3.5">
          <Link
            href="/crm/customers"
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            All Customers
          </Link>
          <div className="flex items-center gap-2">
            <button className="px-3.5 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5">
              <Send size={13} /> Send Message
            </button>
            <Link
              href="/crm/campaigns"
              className="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <Zap size={13} /> Create Campaign
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-5 max-w-[1400px] mx-auto">
        {/* Identity card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="relative p-8">
            {/* Decorative gradient */}
            <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-violet-50/60 to-transparent pointer-events-none" />

            <div className="flex items-start gap-6 relative z-10">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-400 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-violet-500/20">
                  {customerName[0] ?? "?"}
                </div>
                {customer.isBlocked && (
                  <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 rounded-full border-2 border-white flex items-center justify-center">
                    <AlertTriangle size={10} className="text-white" />
                  </div>
                )}
              </div>

              {/* Identity info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{customerName}</h1>
                  {seg && (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${seg.bg} ${seg.border} ${seg.color}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${seg.dot}`} />
                      {seg.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-5 mt-2 text-sm text-gray-500 font-medium flex-wrap">
                  <span className="flex items-center gap-1.5"><Mail size={13} /> {customerEmail}</span>
                  {customer.phone && <span className="flex items-center gap-1.5"><Phone size={13} /> {customer.phone}</span>}
                  <span className="flex items-center gap-1.5"><Calendar size={13} /> Joined {fmt(customer.createdAt)}</span>
                </div>
                {customer.tags.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {customer.tags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        <Tag size={8} /> {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick stats pill row */}
              <div className="hidden xl:flex items-stretch gap-px bg-gray-100 rounded-2xl overflow-hidden flex-shrink-0 self-start border border-gray-200">
                {[
                  { label: "LTV",        value: `₹${customer.ltv.toLocaleString("en-IN")}`},
                  { label: "Orders",     value: customer.orderCount                         },
                  { label: "Last Order", value: ago(customer.lastOrderAt)                   },
                  { label: "Pets",       value: pets.length                                 },
                  { label: "Alerts",     value: customer.runoutPredictions.filter((p) => p.daysUntilRunout <= 7).length },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white px-5 py-3.5 text-center min-w-[80px]">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">{label}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1 whitespace-nowrap">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="border-t border-gray-100 px-8 flex overflow-x-auto">
            {TABS.map(({ key, label, icon: Icon }) => {
              const badge =
                key === "orders"           ? orders.length            :
                key === "communications"   ? communications.length    :
                key === "predictions"      ? customer.runoutPredictions.length :
                key === "pets"             ? pets.length              : 0;

              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-5 py-4 text-sm font-bold whitespace-nowrap border-b-[3px] transition-all -mb-px ${
                    tab === key
                      ? "border-violet-600 text-violet-700"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  <Icon size={14} className={tab === key ? "text-violet-600" : "text-gray-400"} />
                  {label}
                  {badge > 0 && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      tab === key
                        ? key === "predictions" && customer.runoutPredictions.some((p) => p.daysUntilRunout <= 7)
                          ? "bg-red-500 text-white"
                          : "bg-violet-100 text-violet-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div>
          {tab === "overview"       && <OverviewTab customer={customer} orders={orders} onTabSwitch={(t) => setTab(t as TabKey)} />}
          {tab === "pets"           && <PetsTab pets={pets} predictions={customer.runoutPredictions} />}
          {tab === "orders"         && <OrdersTab orders={orders} ltv={customer.ltv} orderCount={customer.orderCount} />}
          {tab === "communications" && <CommunicationsTab communications={communications} />}
          {tab === "predictions"    && <PredictionsTab predictions={customer.runoutPredictions} pets={pets} />}
        </div>
      </div>
    </CrmLayout>
  );
}
