import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ShieldCheck, Lock, ChevronLeft, CreditCard, Wallet, Banknote, PawPrint } from "lucide-react";
import { useCart } from "@/customer/context/CartContext";
import api from "@/lib/api";
import type { Customer, Address } from "@/types";

type Step = "address" | "payment" | "confirm";
type PaymentMethod = "upi" | "card" | "cod";

const DELIVERY_FEE = 40;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();

  const [step, setStep] = useState<Step>("address");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [address, setAddress] = useState<Address>({
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "India",
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [placing, setPlacing] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const total = subtotal + DELIVERY_FEE;

  useEffect(() => {
    if (items.length === 0 && !orderId) router.replace("/customer/cart");
    api.get<{ data: Customer }>("/customers/me").then(({ data }) => {
      setCustomer(data.data);
      const primary = data.data.addresses?.[0];
      if (primary) setAddress({ street: primary.street, city: primary.city, state: primary.state, zip: primary.zip, country: primary.country ?? "India" });
    }).catch(() => {});
  }, []);

  async function placeOrder() {
    setPlacing(true);
    try {
      const payload = {
        items: items.map((i) => ({
          product: i.product._id,
          productName: i.product.name,
          productImage: i.product.images?.[0] ?? "",
          selectedSize: i.selectedSize.label,
          quantity: i.quantity,
          unitPrice: i.selectedSize.price,
        })),
        subtotal,
        deliveryFee: DELIVERY_FEE,
        total,
        shippingAddress: address,
        paymentMethod,
      };
      const { data } = await api.post<{ data: { _id: string; orderNumber: string } }>("/orders", payload);
      clearCart();
      setOrderId(data.data._id);
      setOrderNumber(data.data.orderNumber);
      setStep("confirm");
    } catch {
      alert("Order placement failed. Please try again.");
    } finally {
      setPlacing(false);
    }
  }

  // Distraction-free header
  const CheckoutHeader = () => (
    <header className="bg-white border-b border-gray-100 py-6">
      <div className="container mx-auto px-4 lg:px-8 flex items-center justify-between">
        <Link href="/customer/cart" className="flex items-center text-gray-500 hover:text-primary transition-colors text-sm font-medium">
          <ChevronLeft className="w-4 h-4 mr-1" /> Return to Cart
        </Link>
        <div className="flex items-center gap-2 group cursor-default">
          <div className="bg-primary/10 p-2 rounded-xl">
            <PawPrint className="w-6 h-6 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-gray-900">PawKit</span>
        </div>
        <div className="flex items-center text-gray-400 text-sm font-medium gap-2">
          <Lock className="w-4 h-4" /> <span className="hidden sm:inline">Secure Checkout</span>
        </div>
      </div>
    </header>
  );

  if (step === "confirm") {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans">
        <CheckoutHeader />
        <div className="container mx-auto px-4 py-16 flex flex-col items-center max-w-2xl text-center">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <Check size={48} className="text-green-500" strokeWidth={3} />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4 tracking-tight">Order Confirmed!</h1>
          <p className="text-lg text-gray-500 mb-8">
            Thank you for shopping with PawKit. Your order <span className="font-bold text-gray-900">#{orderNumber}</span> has been received and is being processed.
          </p>
          
          <div className="bg-white border border-gray-100 shadow-sm rounded-3xl p-8 w-full mb-8 text-left">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Order Details</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-gray-500">Payment Method</span>
                <span className="font-bold text-gray-900 flex items-center gap-2">
                  {paymentMethod === 'upi' ? <Wallet size={16} /> : paymentMethod === 'card' ? <CreditCard size={16} /> : <Banknote size={16} />}
                  {paymentMethod.toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-50 pb-4">
                <span className="text-gray-500">Amount Paid</span>
                <span className="font-bold text-gray-900 text-lg">₹{total.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Expected Delivery</span>
                <span className="font-bold text-primary">3–5 business days</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <Button
              className="flex-1 h-14 bg-primary hover:bg-primary/90 rounded-full text-lg font-bold shadow-xl shadow-primary/20"
              onClick={() => router.push("/customer/orders")}
            >
              Track Order
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-14 rounded-full text-lg font-bold border-2"
              onClick={() => router.push("/customer/home")}
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-primary/20 selection:text-primary">
      <CheckoutHeader />

      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12 max-w-6xl">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
          
          {/* Main Checkout Flow */}
          <div className="flex-1 space-y-8">
            {/* Step 1: Address */}
            <div className={`bg-white rounded-3xl border ${step === 'address' ? 'border-primary/50 shadow-md shadow-primary/5' : 'border-gray-100 shadow-sm'} p-6 lg:p-8 overflow-hidden transition-all duration-300`}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'address' ? 'bg-primary text-white' : 'bg-gray-900 text-white'}`}>1</div>
                  <h2 className="text-xl font-bold text-gray-900">Shipping Address</h2>
                </div>
                {step === 'payment' && (
                  <button onClick={() => setStep('address')} className="text-sm font-bold text-primary hover:underline">Edit</button>
                )}
              </div>

              {step === "address" ? (
                <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                  {customer?.addresses?.[0] ? (
                    <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 relative">
                      <div className="absolute top-5 right-5 text-green-500"><Check size={20} /></div>
                      <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Saved Address</p>
                      <p className="text-base text-gray-900 font-medium">
                        {customer.addresses[0].street}<br />
                        {customer.addresses[0].city}, {customer.addresses[0].state} {customer.addresses[0].zip}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Street Address</label>
                        <Input className="h-12 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-primary/50" placeholder="e.g. 123 Pet Avenue" value={address.street} onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">City</label>
                          <Input className="h-12 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-primary/50" placeholder="City" value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">State</label>
                          <Input className="h-12 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-primary/50" placeholder="State" value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">ZIP Code</label>
                        <Input className="h-12 rounded-xl bg-gray-50 border-transparent focus:bg-white focus:border-primary/50 max-w-[200px]" placeholder="ZIP" value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))} />
                      </div>
                    </div>
                  )}
                  
                  <Button
                    className="w-full sm:w-auto px-8 h-12 bg-gray-900 hover:bg-black text-white rounded-full text-base font-bold shadow-md"
                    onClick={() => setStep("payment")}
                    disabled={!address.street || !address.city}
                  >
                    Continue to Payment
                  </Button>
                </div>
              ) : (
                <div className="pl-12 text-gray-500">
                  {address.street}, {address.city}, {address.state} {address.zip}
                </div>
              )}
            </div>

            {/* Step 2: Payment */}
            <div className={`bg-white rounded-3xl border ${step === 'payment' ? 'border-primary/50 shadow-md shadow-primary/5' : 'border-gray-100 shadow-sm opacity-60'} p-6 lg:p-8 overflow-hidden transition-all duration-300`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'payment' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                <h2 className="text-xl font-bold text-gray-900">Payment Method</h2>
              </div>

              {step === "payment" && (
                <div className="space-y-6 animate-in slide-in-from-top-4 fade-in duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {(
                      [
                        { key: "upi", label: "UPI", icon: Wallet, sub: "GPay, PhonePe" },
                        { key: "card", label: "Card", icon: CreditCard, sub: "Visa, Mastercard" },
                        { key: "cod", label: "Cash", icon: Banknote, sub: "Pay on delivery" },
                      ] as { key: PaymentMethod; label: string; icon: any; sub: string }[]
                    ).map(({ key, label, icon: Icon, sub }) => (
                      <div
                        key={key}
                        onClick={() => setPaymentMethod(key)}
                        className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all ${
                          paymentMethod === key
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-gray-100 hover:border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {paymentMethod === key && <div className="absolute top-3 right-3 text-primary"><Check size={16} /></div>}
                        <Icon size={28} className="mb-3" strokeWidth={1.5} />
                        <p className={`font-bold ${paymentMethod === key ? "text-gray-900" : ""}`}>{label}</p>
                        <p className="text-xs text-gray-400 mt-1">{sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldCheck className="text-blue-500 w-8 h-8 flex-shrink-0" />
                    <p className="text-sm text-blue-900/80 leading-snug">
                      Your payment is securely processed. We do not store your full card details.
                    </p>
                  </div>

                  <Button
                    className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-full text-lg font-bold shadow-xl shadow-primary/20"
                    onClick={placeOrder}
                    disabled={placing}
                  >
                    {placing ? "Processing..." : `Pay ₹${total.toLocaleString("en-IN")}`}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar: Order Summary */}
          <div className="w-full lg:w-96 flex-shrink-0 lg:sticky lg:top-8 h-fit">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Order Summary</h3>
              
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={`${item.product._id}__${item.selectedSize.label}`} className="flex gap-4">
                    <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 border border-gray-100 overflow-hidden relative">
                      {item.product.images?.[0] ? <img src={item.product.images[0]} className="w-full h-full object-cover" /> : "🥣"}
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-gray-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10">{item.quantity}</div>
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-bold text-gray-900 line-clamp-1">{item.product.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.selectedSize.label}</p>
                    </div>
                    <div className="text-sm font-bold text-gray-900 pt-1">
                      ₹{(item.selectedSize.price * item.quantity).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-6 space-y-4">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-900">₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className="font-medium text-gray-900">₹{DELIVERY_FEE}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-2xl font-bold text-gray-900">₹{total.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
