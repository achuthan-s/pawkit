import Link from "next/link";
import { Search, ShoppingBag, User, PawPrint } from "lucide-react";
import { useCart } from "@/customer/context/CartContext";
import { useState } from "react";
import { useRouter } from "next/router";

export default function CustomerNavbar() {
  const { itemCount } = useCart();
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) router.push(`/customer/shop?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
      <div className="container mx-auto px-4 lg:px-8 flex items-center justify-between h-20">
        
        {/* Logo */}
        <Link href="/customer/home" className="flex items-center gap-2 group">
          <div className="bg-primary/10 p-2 rounded-xl group-hover:bg-primary/20 transition-colors">
            <PawPrint className="w-6 h-6 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-gray-900 group-hover:text-primary transition-colors">
            PawKit
          </span>
        </Link>

        {/* Centered Search Bar (Desktop) */}
        <div className="hidden md:flex flex-1 max-w-xl mx-8">
          <form onSubmit={handleSearch} className="w-full relative group">
            <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search premium food, treats, and more..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-transparent rounded-full text-sm outline-none focus:border-primary/20 focus:bg-white focus:ring-4 focus:ring-primary/10 transition-all"
            />
          </form>
        </div>

        {/* Icons & Actions */}
        <div className="flex items-center gap-6">
          <Link href="/customer/profile" className="hidden md:flex flex-col items-center text-gray-500 hover:text-primary transition-colors">
            <User className="w-6 h-6" />
            <span className="text-[10px] font-semibold uppercase tracking-widest mt-1">Profile</span>
          </Link>
          
          <Link href="/customer/cart" className="relative flex flex-col items-center text-gray-500 hover:text-primary transition-colors group">
            <ShoppingBag className="w-6 h-6 transition-transform group-hover:-translate-y-1" />
            <span className="text-[10px] font-semibold uppercase tracking-widest mt-1 hidden md:block">Cart</span>
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 md:top-[-8px] md:right-1 bg-primary text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md animate-in zoom-in">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            )}
          </Link>
        </div>
      </div>
      
      {/* Mobile Search Bar */}
      <div className="md:hidden px-4 pb-4">
        <form onSubmit={handleSearch} className="w-full relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-gray-50 rounded-full text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </form>
      </div>
    </header>
  );
}
