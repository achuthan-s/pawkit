import { useState, useEffect } from "react";
import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import { ChevronRight, Package, UserCircle } from "lucide-react";
import api from "@/lib/api";
import type { Order, OrderStatus, TrackingStatus } from "@/types";

type TabKey = "all" | "upcoming" | "delivered" | "cancelled";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "upcoming",  label: "In Progress" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending:   { label: "Processing",  cls: "bg-amber-50  text-amber-700  border-amber-200" },
  confirmed: { label: "Confirmed",   cls: "bg-blue-50   text-blue-700   border-blue-200" },
  packed:    { label: "Packed",      cls: "bg-cyan-50   text-cyan-700   border-cyan-200" },
  shipped:   { label: "In Transit",  cls: "bg-violet-50 text-violet-700 border-violet-200" },
  delivered: { label: "Delivered",   cls: "bg-green-50  text-green-700  border-green-200" },
  cancelled: { label: "Cancelled",   cls: "bg-red-50    text-red-700    border-red-200" },
};

const TRACKING_STEPS: { key: TrackingStatus; label: string }[] = [
  { key: "ordered",          label: "Ordered" },
  { key: "packed",           label: "Packed" },
  { key: "shipped",          label: "Shipped" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered",        label: "Delivered" },
];

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrackingTimeline({ order }: { order: Order }) {
  // Use actual tracking timeline events instead of static steps
  const events = order.trackingTimeline || [];

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Tracking</p>
      <div className="relative">
        <div className="absolute left-3.5 top-0 bottom-0 w-0.5 bg-gray-100" />
        <div className="space-y-4">
          {events.map((event, index) => {
            const isLast = index === events.length - 1;
            const isCancelled = event.status === "cancelled";
            return (
              <div key={index} className="flex items-start gap-3 relative">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                    isCancelled 
                      ? "bg-red-500 border-red-500 text-white" 
                      : isLast && order.status !== "delivered"
                      ? "bg-white border-primary shadow-[0_0_0_3px_rgba(249,115,22,0.15)]"
                      : "bg-primary border-primary text-white"
                  }`}
                >
                  {!isCancelled && (isLast && order.status !== "delivered" ? null : <CheckIcon />)}
                </div>
                <div className="pt-0.5 flex-1">
                  <p className={`text-sm font-bold text-gray-900`}>
                    {event.description || event.status}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {new Date(event.timestamp).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const style = STATUS_STYLE[order.status];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-start justify-between p-4 border-b border-gray-50">
        <div>
          <p className="text-sm font-bold text-gray-900">Order #{order.orderNumber}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${style.cls}`}>
            {style.label}
          </span>
          <p className="text-sm font-bold text-gray-900">₹{order.total.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {/* Items */}
      <div className="p-4 space-y-3">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 flex-shrink-0">
              <img 
                src={item.productImage || "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=150&q=80"} 
                className="w-full h-full object-cover" 
                alt={item.productName}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{item.productName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.selectedSize} · Qty {item.quantity}</p>
            </div>
            <p className="text-sm font-bold text-gray-900 flex-shrink-0">
              ₹{(item.unitPrice * item.quantity).toLocaleString("en-IN")}
            </p>
          </div>
        ))}
      </div>

      {/* Order Summary & Rating & Expand toggle */}
      <div className="px-4 pb-4">
        {expanded && (
          <div className="mb-4 p-3 bg-gray-50 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>₹{order.items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0).toLocaleString("en-IN")}</span>
            </div>
            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Delivery Fee</span>
                <span>₹{order.deliveryFee.toLocaleString("en-IN")}</span>
              </div>
            )}
            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount</span>
                <span>-₹{(order.discount ?? 0).toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total Amount</span>
              <span>₹{order.total.toLocaleString("en-IN")}</span>
            </div>
          </div>
        )}

        {order.status === "delivered" && expanded && (
          <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-xl text-center">
            <p className="text-sm font-bold text-gray-900 mb-2">Rate your order</p>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className="w-6 h-6 text-gray-300 hover:text-amber-400 cursor-pointer transition-colors" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Your feedback helps us improve.</p>
          </div>
        )}

        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-gray-700 transition-colors flex items-center justify-center gap-1.5"
        >
          {expanded ? "Hide Details" : "View Order Details"}
          <ChevronRight size={14} className={`transition-transform duration-300 ${expanded ? "rotate-90" : ""}`} />
        </button>
        {expanded && (
          <div className="animate-in slide-in-from-top-2 fade-in duration-200">
            <TrackingTimeline order={order} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerOrders() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<TabKey>("all");

  useEffect(() => {
    api.get<{ data: Order[] }>("/orders/my")
      .then(({ data }) => {
        setOrders(data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = orders.filter((o) => {
    if (tab === "all")       return true;
    if (tab === "upcoming")  return ["pending", "confirmed", "shipped"].includes(o.status);
    if (tab === "delivered") return o.status === "delivered";
    if (tab === "cancelled") return o.status === "cancelled";
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      <CustomerNavbar />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* Account Sidebar Nav */}
        <div className="flex gap-2 mb-6">
          <Link
            href="/customer/profile"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-white border border-gray-200 hover:border-primary/40 hover:text-primary transition-colors"
          >
            <UserCircle size={14} /> Profile
          </Link>
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-primary bg-primary/5 border border-primary/20">
            <Package size={14} /> Orders
          </div>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-5">My Orders</h1>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                tab === t.key
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Order list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="bg-white rounded-2xl h-40 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 px-4 text-center">
            <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-900 mb-1">No orders found</p>
            <p className="text-xs text-gray-400 mb-5">Treat your pet to something special!</p>
            <Link href="/customer/shop">
              <button className="bg-primary text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-md shadow-primary/20 hover:bg-primary/90 transition-colors">
                Start Shopping
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => <OrderCard key={order._id} order={order} />)}
          </div>
        )}
      </div>
    </div>
  );
}
