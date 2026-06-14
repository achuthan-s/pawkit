import { useEffect, useState } from "react";
import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ArrowRight, ShieldCheck } from "lucide-react";
import { useCart } from "@/customer/context/CartContext";
import api from "@/lib/api";
import type { Product } from "@/types";

const DELIVERY_FEE = 40;

export default function CartPage() {
  const { items, updateQty, removeItem, subtotal } = useCart();
  const [related, setRelated] = useState<Product[]>([]);
  const { addItem } = useCart();

  useEffect(() => {
    if (items.length === 0) return;
    const categoryOfFirst = items[0].product.category;
    api
      .get<{ data: Product[] }>(`/products?category=${categoryOfFirst}&limit=4`)
      .then(({ data }) => {
        const cartIds = new Set(items.map((i) => i.product._id));
        setRelated(data.data.filter((p) => !cartIds.has(p._id)).slice(0, 3));
      })
      .catch(() => {});
  }, [items.length]);

  const total = subtotal + (items.length > 0 ? DELIVERY_FEE : 0);

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <CustomerNavbar />
        <div className="container mx-auto px-4 flex flex-col items-center justify-center min-h-[70vh] text-center">
          <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center text-5xl mb-8 shadow-inner">
            🛒
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">Your cart is feeling light</h2>
          <p className="text-gray-500 text-lg mb-8 max-w-md">Discover premium nutrition and essentials that your pet will absolutely love.</p>
          <Link href="/customer/shop">
            <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 py-6 text-lg font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105">
              Start Shopping
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      <CustomerNavbar />

      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 tracking-tight mb-8">
          Shopping Cart <span className="text-gray-400 font-normal ml-2 text-2xl">({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
        </h1>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Cart Items List */}
          <div className="flex-1 space-y-6">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="hidden lg:grid grid-cols-12 gap-4 px-8 py-4 bg-gray-50/50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className="col-span-6">Product</div>
                <div className="col-span-3 text-center">Quantity</div>
                <div className="col-span-3 text-right">Total</div>
              </div>

              <div className="divide-y divide-gray-100">
                {items.map((item) => (
                  <div
                    key={`${item.product._id}__${item.selectedSize.label}`}
                    className="p-6 lg:px-8 flex flex-col lg:grid lg:grid-cols-12 lg:items-center gap-6 group hover:bg-gray-50/30 transition-colors"
                  >
                    {/* Mobile: Top Row, Desktop: Col 1 */}
                    <div className="col-span-6 flex items-center gap-4 lg:gap-6">
                      <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 overflow-hidden relative">
                        {item.product.images?.[0] ? (
                          <img src={item.product.images[0]} className="w-full h-full object-cover" />
                        ) : (
                          "🥣"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link href={`/customer/product/${item.product._id}`} className="font-bold text-lg text-gray-900 hover:text-primary transition-colors line-clamp-2">
                          {item.product.name}
                        </Link>
                        <p className="text-sm text-gray-500 mt-1 font-medium">{item.selectedSize.label}</p>
                        <p className="text-base font-bold text-gray-900 mt-2 lg:hidden">
                          ₹{(item.selectedSize.price).toLocaleString("en-IN")} each
                        </p>
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div className="col-span-3 flex items-center lg:justify-center">
                      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                          onClick={() => updateQty(item.product._id, item.selectedSize.label, Math.max(1, item.quantity - 1))}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-base font-bold w-6 text-center">{item.quantity}</span>
                        <button
                          className="w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
                          onClick={() => updateQty(item.product._id, item.selectedSize.label, item.quantity + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Price & Delete */}
                    <div className="col-span-3 flex items-center justify-between lg:justify-end gap-6">
                      <p className="text-xl font-bold text-gray-900">
                        ₹{(item.selectedSize.price * item.quantity).toLocaleString("en-IN")}
                      </p>
                      <button
                        onClick={() => removeItem(item.product._id, item.selectedSize.label)}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* You may also like */}
            {related.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-gray-900 mb-6 tracking-tight">Perfect Pairings</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                  {related.map((product) => (
                    <div
                      key={product._id}
                      className="bg-white rounded-3xl border border-gray-100 p-5 flex flex-col shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                          {product.images?.[0] ? (
                            <img src={product.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                          ) : (
                            "🥣"
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/customer/product/${product._id}`}>
                            <h3 className="font-bold text-gray-900 text-sm line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                          </Link>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            ₹{(product.sizes[0]?.price ?? product.price).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                      <button
                        className="w-full py-2.5 rounded-xl border-2 border-gray-100 text-gray-900 font-bold hover:border-primary hover:text-primary transition-colors mt-auto text-sm"
                        onClick={() => {
                          const size = product.sizes[0] ?? { label: "Default", price: product.price };
                          addItem(product, size, 1);
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="w-full lg:w-96 flex-shrink-0">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:p-8 sticky top-28">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Order Summary</h2>

              <div className="space-y-4 mb-6 text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-medium text-gray-900">₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estimated Delivery</span>
                  <span className="font-medium text-gray-900">₹{DELIVERY_FEE}</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6 mb-8">
                <div className="flex justify-between items-end">
                  <span className="text-lg font-bold text-gray-900">Total</span>
                  <span className="text-3xl font-bold text-primary">₹{total.toLocaleString("en-IN")}</span>
                </div>
                <p className="text-xs text-gray-400 mt-2 text-right">Inclusive of all taxes</p>
              </div>

              <Link href="/customer/checkout" className="block w-full">
                <Button className="w-full h-14 bg-gray-900 hover:bg-black text-white rounded-full text-lg font-bold shadow-xl group">
                  Proceed to Checkout
                  <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500 font-medium">
                <ShieldCheck className="w-4 h-4 text-green-500" /> Secure encrypted checkout
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
