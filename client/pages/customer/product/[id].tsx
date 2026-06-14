import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Star, Minus, Plus, Check, ShieldCheck, Heart, RotateCcw } from "lucide-react";
import api from "@/lib/api";
import type { Product, ProductSize } from "@/types";
import { useCart } from "@/customer/context/CartContext";

const FEATURE_ICONS: Record<string, string> = {
  "Real Chicken": "🍗",
  "No Artificial Preservatives": "✅",
  "Supports Healthy Digestion": "💚",
  "High Protein": "💪",
  "Grain Free": "🌾",
  "Vet Recommended": "👨‍⚕️",
};

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { addItem, items } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [qty, setQty] = useState(1);
  const [subscribe, setSubscribe] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      api.get<{ data: Product }>(`/products/${id}`),
      api.get<{ data: Product[] }>(`/products/${id}/related`),
    ])
      .then(([prodRes, relRes]) => {
        const p = prodRes.data.data;
        setProduct(p);
        setSelectedSize(p.sizes[0] ?? { label: "Default", price: p.price });
        setRelated(relRes.data.data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const cartCount = items
    .filter((i) => i.product._id === id && i.selectedSize.label === selectedSize?.label)
    .reduce((s, i) => s + i.quantity, 0);

  function handleAddToCart() {
    if (!product || !selectedSize) return;
    const size = subscribe
      ? { ...selectedSize, price: Math.round(selectedSize.price * 0.9) }
      : selectedSize;
    addItem(product, size, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <CustomerNavbar />
        <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-16">
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
            <div className="w-full lg:w-1/2 aspect-square bg-gray-200 rounded-3xl animate-pulse" />
            <div className="w-full lg:w-1/2 space-y-6 pt-4">
              <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-10 bg-gray-200 rounded animate-pulse w-1/2" />
              <div className="h-24 bg-gray-200 rounded animate-pulse w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <CustomerNavbar />
        <div className="container mx-auto px-4 py-24 text-center">
          <div className="text-6xl mb-6">🐾</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Product not found</h2>
          <p className="text-gray-500 mb-8">This product may have been removed or the link is incorrect.</p>
          <Link href="/customer/shop" className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const displayPrice = subscribe && selectedSize
    ? Math.round(selectedSize.price * 0.9)
    : (selectedSize?.price ?? product.basePrice ?? 0);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-primary/20 selection:text-primary">
      <CustomerNavbar />

      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs lg:text-sm text-gray-500 mb-8 font-medium uppercase tracking-wider">
          <button onClick={() => router.back()} className="hover:text-primary transition-colors flex items-center">
            <ChevronLeft size={16} className="mr-1" /> Back
          </button>
          <span className="text-gray-300">/</span>
          <Link href={`/customer/shop?category=${product.category}`} className="hover:text-primary transition-colors">
            {product.category.replace("-", " ")}
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 truncate max-w-[200px] lg:max-w-none">{product.name}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">
          {/* Product Image Gallery */}
          <div className="w-full lg:w-1/2 lg:sticky lg:top-32 h-fit">
            <div className="aspect-square bg-white border border-gray-100 rounded-[2rem] flex items-center justify-center text-8xl overflow-hidden shadow-sm">
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="scale-150">🥣</div>
              )}
            </div>

            {/* Guarantee mini-banner */}
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-500 font-medium">
              <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-green-500" /> Vet Approved</div>
              <div className="flex items-center gap-2"><Heart className="w-5 h-5 text-red-400" /> Cruelty Free</div>
              <div className="flex items-center gap-2"><RotateCcw className="w-5 h-5 text-blue-500" /> 30-Day Returns</div>
            </div>
          </div>

          {/* Product Details */}
          <div className="w-full lg:w-1/2 pb-24 lg:pb-12">
            {/* Header */}
            <div className="mb-8">
              <p className="text-sm font-bold text-primary uppercase tracking-widest mb-2">{product.category.replace("-", " ")}</p>
              <h1 className="text-3xl lg:text-5xl font-bold text-gray-900 tracking-tight leading-tight mb-4">{product.name}</h1>

              {product.ratings.count > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={18}
                        className={s <= Math.round(product.ratings.average) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"}
                      />
                    ))}
                  </div>
                  <span className="text-base font-bold text-gray-900">{product.ratings.average.toFixed(1)}</span>
                  <span className="text-sm text-gray-500 underline decoration-gray-300 underline-offset-4">Read {product.ratings.count} Reviews</span>
                </div>
              )}
            </div>

            <div className="text-4xl lg:text-5xl font-bold text-gray-900 mb-8">
              ₹{displayPrice.toLocaleString("en-IN")}
            </div>

            <p className="text-lg text-gray-600 leading-relaxed mb-8 font-light">
              Give your pet the balanced, premium nutrition they deserve. Carefully crafted with high-quality ingredients, this formula supports overall health, vibrant energy, and a shiny coat.
            </p>

            {/* Features Grid */}
            {product.features.length > 0 && (
              <div className="mb-10">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest mb-4">Key Benefits</h3>
                <div className="grid grid-cols-2 gap-4">
                  {product.features.map((f) => (
                    <div key={f} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                        {FEATURE_ICONS[f] ?? "✓"}
                      </div>
                      <span className="text-sm font-semibold text-gray-700 leading-tight">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Size selector */}
            {product.sizes.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Select Size</h3>
                  <button className="text-sm text-primary font-medium underline underline-offset-4">Size Guide</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {product.sizes.map((size) => (
                    <button
                      key={size.label}
                      onClick={() => setSelectedSize(size)}
                      className={`py-4 rounded-2xl border-2 text-center transition-all ${
                        selectedSize?.label === size.label
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`text-base font-bold ${selectedSize?.label === size.label ? "text-primary" : "text-gray-900"}`}>{size.label}</div>
                      <div className={`text-sm mt-1 ${selectedSize?.label === size.label ? "text-primary/80 font-semibold" : "text-gray-500"}`}>
                        ₹{size.price.toLocaleString("en-IN")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Subscribe & Save */}
            <div className={`mb-10 rounded-2xl p-6 border-2 transition-all cursor-pointer ${subscribe ? "border-primary bg-primary/5" : "border-gray-200 bg-white"}`} onClick={() => setSubscribe(!subscribe)}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-lg font-bold text-gray-900">Subscribe & Save 10%</p>
                    <div className="bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">Best Value</div>
                  </div>
                  <p className="text-sm text-gray-500">Auto-delivered every 30 days. Cancel anytime.</p>
                </div>
                <div className={`relative w-14 h-8 rounded-full transition-colors ${subscribe ? "bg-primary" : "bg-gray-300"}`}>
                  <span className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${subscribe ? "translate-x-6" : "translate-x-0"}`} />
                </div>
              </div>
            </div>

            {/* Desktop Add to Cart */}
            <div className="hidden lg:flex items-center gap-4">
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-full p-2 w-40">
                <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors" onClick={() => setQty(Math.max(1, qty - 1))}>
                  <Minus size={16} />
                </button>
                <span className="text-lg font-bold text-gray-900">{qty}</span>
                <button className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors" onClick={() => setQty(qty + 1)}>
                  <Plus size={16} />
                </button>
              </div>
              <Button
                className={`flex-1 h-14 rounded-full text-lg font-bold shadow-xl transition-all ${
                  added ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/20" : "bg-primary hover:bg-primary/90 text-white shadow-primary/20"
                }`}
                onClick={handleAddToCart}
              >
                {added ? (
                  <span className="flex items-center gap-2">
                    <Check size={20} /> Added to Cart {cartCount > 0 && `(${cartCount + qty})`}
                  </span>
                ) : (
                  "Add to Cart"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Add to Cart */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-gray-100 p-4 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 border border-gray-200 bg-white rounded-full p-1">
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-600" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus size={14} />
            </button>
            <span className="text-base font-bold w-6 text-center">{qty}</span>
            <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-600" onClick={() => setQty(qty + 1)}>
              <Plus size={14} />
            </button>
          </div>
          <span className="text-2xl font-bold text-gray-900">
            ₹{(displayPrice * qty).toLocaleString("en-IN")}
          </span>
        </div>
        <Button
          className={`w-full h-14 rounded-full text-lg font-bold shadow-xl transition-all ${
            added ? "bg-green-500 text-white" : "bg-primary text-white"
          }`}
          onClick={handleAddToCart}
        >
          {added ? "Added to Cart" : "Add to Cart"}
        </Button>
      </div>
    </div>
  );
}
