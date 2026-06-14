import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import { Button } from "@/components/ui/button";
import { ArrowRight, RotateCcw, ShieldCheck, Heart, Sparkles, Star } from "lucide-react";
import api from "@/lib/api";
import type { Product, Customer, Pet } from "@/types";
import { useCart } from "@/customer/context/CartContext";

const CATEGORIES = [
  { label: "Premium Dog Food", key: "dog-food", img: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=400&q=80" },
  { label: "Gourmet Cat Food", key: "cat-food", img: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=400&q=80" },
  { label: "Healthy Treats", key: "treats", img: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=400&q=80" },
  { label: "Vital Supplements", key: "supplements", img: "https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=400&q=80" },
];

export default function CustomerHome() {
  const { addItem } = useCart();
  const [featured, setFeatured] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [reorderProduct, setReorderProduct] = useState<Product | null>(null);

  useEffect(() => {
    api
      .get<{ data: Product[] }>("/products?category=dog-food&limit=8")
      .then(({ data }) => {
        setFeatured(data.data);
        if (data.data.length > 0) setReorderProduct(data.data[0]);
      })
      .catch(() => {});

    api.get<{ data: Customer }>("/customers/me").then(({ data }) => setCustomer(data.data)).catch(() => {});
    api.get<{ data: Pet[] }>("/customers/me/pets").then(({ data }) => setPets(data.data)).catch(() => {});
  }, []);

  const petName = pets[0]?.name ?? "your pet";

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-primary/20 selection:text-primary">
      <CustomerNavbar />

      <main>
        {/* Hero Section */}
        <section className="relative w-full h-[600px] flex items-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img
              src="https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=2000&q=80"
              alt="Happy dog"
              className="w-full h-full object-cover object-center"
            />
            {/* Gradient overlay for text legibility */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
          </div>

          <div className="container mx-auto px-4 lg:px-8 relative z-10">
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold text-white mb-6 uppercase tracking-widest">
                <Sparkles className="w-4 h-4 text-primary" />
                Veterinarian Approved
              </div>
              <h1 className="text-5xl lg:text-7xl font-bold text-white leading-tight mb-6 tracking-tight">
                Nutrition tailored <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200">
                  for their prime.
                </span>
              </h1>
              <p className="text-lg text-gray-200 mb-8 max-w-xl leading-relaxed font-light">
                Discover scientifically formulated, premium nutrition and holistic wellness products designed to elevate your pet's health and happiness.
              </p>
              <Link href="/customer/shop">
                <Button className="bg-primary hover:bg-primary/90 text-white rounded-full px-8 py-6 text-lg font-semibold shadow-xl shadow-primary/20 transition-all hover:scale-105 group">
                  Explore Collection
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <div className="container mx-auto px-4 lg:px-8 py-16 space-y-24">

          {/* Shop by Category */}
          <section>
            <div className="flex items-end justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Curated Categories</h2>
                <p className="text-gray-500 mt-2">Shop our exclusive selection of premium essentials.</p>
              </div>
              <Link href="/customer/shop" className="hidden sm:flex items-center text-primary font-semibold hover:text-primary/80 transition-colors group">
                View All Categories <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8">
              {CATEGORIES.map(({ label, key, img }) => (
                <Link key={key} href={`/customer/shop?category=${key}`} className="group relative rounded-3xl overflow-hidden aspect-[4/5] bg-gray-100 shadow-sm hover:shadow-xl transition-all duration-500">
                  <img src={img} alt={label} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-6">
                    <h3 className="text-white font-semibold text-lg lg:text-xl leading-tight group-hover:text-primary transition-colors">{label}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* AI Reorder Recommendation (If available) */}
          {reorderProduct && (
            <section className="bg-white rounded-3xl p-8 lg:p-12 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>

              <div className="flex flex-col lg:flex-row gap-8 items-center relative z-10">
                <div className="flex-1 space-y-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                    <Heart className="w-4 h-4 fill-primary/20" /> Smart Prediction
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900">
                    It looks like {petName.charAt(0).toUpperCase() + petName.slice(1)} is running low!
                  </h2>
                  <p className="text-gray-600 text-lg">
                    Based on your previous orders, we estimate that you have about 4 days of food left. Reorder now to ensure uninterrupted nutrition.
                  </p>

                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center gap-6 border border-gray-100 max-w-md">
                    <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center text-4xl shadow-sm border border-gray-100 shrink-0 overflow-hidden">
                      {reorderProduct.images?.[0] ? (
                        <img src={reorderProduct.images[0]} className="w-full h-full object-cover" />
                      ) : (
                        "🥣"
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{reorderProduct.name}</p>
                      <p className="text-sm text-gray-500 mt-1">{reorderProduct.sizes[0]?.label ?? "Standard Size"}</p>
                      <p className="text-lg font-bold text-primary mt-2">
                        ₹{(reorderProduct.sizes[0]?.price ?? reorderProduct.price).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <Button
                    className="bg-gray-900 hover:bg-black text-white rounded-full px-8 py-6 h-auto text-base font-semibold shadow-lg group"
                    onClick={() => {
                      if (reorderProduct.sizes.length > 0) {
                        addItem(reorderProduct, reorderProduct.sizes[0], 1);
                      }
                    }}
                  >
                    <RotateCcw className="w-5 h-5 mr-2 group-hover:-rotate-180 transition-transform duration-500" />
                    Quick Reorder
                  </Button>
                </div>

                <div className="hidden lg:block w-1/3">
                  <img src="https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=800&q=80" alt="Happy Dogs" className="rounded-2xl shadow-xl rotate-3 hover:rotate-0 transition-transform duration-500" />
                </div>
              </div>
            </section>
          )}

          {/* Best Sellers Grid */}
          {featured.length > 0 && (
            <section>
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Best Sellers</h2>
                  <p className="text-gray-500 mt-2">Loved by pets, trusted by parents.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-8">
                {featured.slice(0, 8).map((product) => (
                  <Link key={product._id} href={`/customer/product/${product._id}`} className="group flex flex-col bg-white rounded-3xl p-4 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300">
                    <div className="aspect-square bg-gray-50 rounded-2xl mb-4 flex items-center justify-center text-5xl overflow-hidden relative">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        "🥣"
                      )}
                      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.9
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">{product.category.replace("-", " ")}</p>
                      <h3 className="font-bold text-gray-900 text-sm lg:text-base leading-tight mb-2 line-clamp-2">{product.name}</h3>
                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">{product.sizes[0]?.label ?? "Standard"}</p>
                          <p className="text-lg font-bold text-primary">₹{(product.sizes[0]?.price ?? product.price).toLocaleString("en-IN")}</p>
                        </div>
                        <button
                          className="w-10 h-10 rounded-full bg-gray-100 text-gray-900 flex items-center justify-center font-bold hover:bg-primary hover:text-white transition-colors shadow-sm"
                          onClick={(e) => {
                            e.preventDefault();
                            if (product.sizes.length > 0) addItem(product, product.sizes[0], 1);
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Trust Banner */}
          <section className="bg-gray-900 rounded-3xl p-8 lg:p-12 text-center text-white mb-16">
            <h2 className="text-2xl lg:text-3xl font-bold mb-8">The PawKit Standard</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Vet Approved</h3>
                <p className="text-gray-400 text-sm">Every product passes strict veterinary screening for quality.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Heart className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Cruelty Free</h3>
                <p className="text-gray-400 text-sm">Ethically sourced ingredients with no animal testing.</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <RotateCcw className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold text-lg mb-2">Easy Returns</h3>
                <p className="text-gray-400 text-sm">Not happy? Return it within 30 days, no questions asked.</p>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
