import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import { ChevronRight, Star, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import api from "@/lib/api";
import type { Product, ProductCategory } from "@/types";
import { useCart } from "@/customer/context/CartContext";

const CATEGORY_LABELS: Record<string, string> = {
  "dog-food": "Premium Dog Food",
  "cat-food": "Gourmet Cat Food",
  treats: "Healthy Treats",
  supplements: "Vital Supplements",
  accessories: "Luxury Accessories",
  health: "Pet Health",
  grooming: "Grooming Essentials",
  other: "All Products",
};

const SUB_FILTERS: Record<string, string[]> = {
  "dog-food": ["All", "Dry Food", "Wet Food", "Puppy", "Senior"],
  "cat-food": ["All", "Dry Food", "Wet Food", "Senior"],
  treats: ["All", "Dog Treats", "Cat Treats", "Dental"],
  supplements: ["All", "Joint Care", "Immunity", "Digestive"],
};

export default function ShopPage() {
  const router = useRouter();
  const { addItem } = useCart();
  const category = (router.query.category as ProductCategory) ?? "dog-food";
  const searchQuery = (router.query.q as string) ?? "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [subFilter, setSubFilter] = useState("All");

  const subFilters = SUB_FILTERS[category] ?? ["All"];
  const categoryLabel = CATEGORY_LABELS[category] ?? "Our Collection";

  useEffect(() => {
    setSubFilter("All");
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== "other") params.set("category", category);
    if (searchQuery) params.set("q", searchQuery);
    api
      .get<{ data: Product[] }>(`/products?${params}`)
      .then(({ data }) => setProducts(data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [category, searchQuery]);

  const filtered =
    subFilter === "All"
      ? products
      : products.filter(
          (p) => p.subcategory?.toLowerCase() === subFilter.toLowerCase()
        );

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans selection:bg-primary/20 selection:text-primary">
      <CustomerNavbar />

      {/* Header Banner */}
      <div className="bg-white border-b border-gray-100">
        <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">
            <Link href="/customer/home" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-gray-900">{searchQuery ? "Search Results" : categoryLabel}</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 tracking-tight">
            {searchQuery ? (
              <>Search Results for "<span className="text-primary">{searchQuery}</span>"</>
            ) : (
              categoryLabel
            )}
          </h1>
          <p className="text-gray-500 mt-3 text-lg max-w-2xl">
            {searchQuery
              ? `Showing results matching your query.`
              : `Explore our carefully curated selection of ${categoryLabel.toLowerCase()}, chosen by experts for your pet's ultimate well-being.`}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 py-8 lg:py-12 flex flex-col lg:flex-row gap-8">
        {/* Sidebar / Filters */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm sticky top-28">
            <div className="flex items-center gap-2 font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
              Filters
            </div>

            {!searchQuery && subFilters.length > 1 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Categories</h3>
                <div className="flex flex-col gap-2">
                  {subFilters.map((f) => (
                    <button
                      key={f}
                      onClick={() => setSubFilter(f)}
                      className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        subFilter === f
                          ? "bg-primary text-white shadow-md shadow-primary/20"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-8">
            <p className="text-gray-500 font-medium">
              Showing <span className="text-gray-900 font-bold">{filtered.length}</span> products
            </p>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="bg-white rounded-3xl h-80 animate-pulse border border-gray-100 p-4 flex flex-col">
                  <div className="w-full aspect-square bg-gray-100 rounded-2xl mb-4" />
                  <div className="h-4 bg-gray-100 rounded-md w-3/4 mb-2" />
                  <div className="h-4 bg-gray-100 rounded-md w-1/2" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 py-24 px-4 text-center shadow-sm">
              <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <SearchIcon className="w-10 h-10 text-gray-300" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No products found</h2>
              <p className="text-gray-500">We couldn't find any products matching your current filters.</p>
              <button
                onClick={() => setSubFilter("All")}
                className="mt-6 font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
              {filtered.map((product) => (
                <Link key={product._id} href={`/customer/product/${product._id}`} className="group flex flex-col bg-white rounded-3xl p-4 lg:p-5 shadow-sm hover:shadow-xl border border-gray-100 transition-all duration-300">
                  <div className="aspect-square bg-gray-50 rounded-2xl mb-4 lg:mb-5 flex items-center justify-center text-5xl lg:text-6xl overflow-hidden relative">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      "🥣"
                    )}
                    <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      {product.ratings?.average ? product.ratings.average.toFixed(1) : "4.9"}
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col">
                    <p className="text-[10px] lg:text-xs text-gray-400 font-bold uppercase tracking-widest mb-1.5">{product.category.replace("-", " ")}</p>
                    <h3 className="font-bold text-gray-900 text-sm lg:text-base leading-tight mb-2 line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-50">
                      <div>
                        <p className="text-[10px] lg:text-xs text-gray-500 mb-0.5">{product.sizes[0]?.label ?? "Standard"}</p>
                        <p className="text-base lg:text-lg font-bold text-gray-900">₹{(product.sizes[0]?.price ?? product.price).toLocaleString("en-IN")}</p>
                      </div>
                      <button
                        className="w-10 h-10 lg:w-11 lg:h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold hover:bg-primary hover:text-white hover:shadow-lg hover:shadow-primary/30 transition-all"
                        onClick={(e) => {
                          e.preventDefault();
                          const size = product.sizes[0] ?? { label: "Default", price: product.price };
                          addItem(product, size, 1);
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
