import { useState, useEffect } from "react";
import Link from "next/link";
import CustomerNavbar from "@/components/layout/CustomerNavbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCircle, Package, Plus, MapPin, PawPrint, LogOut, ChevronRight } from "lucide-react";
import api from "@/lib/api";
import type { Customer, Pet } from "@/types";

const SPECIES_EMOJI: Record<string, string> = {
  dog: "🐶", cat: "🐱", bird: "🐦", rabbit: "🐰", other: "🐾",
};

export default function CustomerProfile() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pets, setPets]         = useState<Pet[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newPet, setNewPet]     = useState({ name: "", species: "dog", age: "" });
  const [adding, setAdding]     = useState(false);
  const [showAddPet, setShowAddPet] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<{ data: Customer }>("/customers/me"),
      api.get<{ data: Pet[] }>("/customers/me/pets"),
    ])
      .then(([pRes, petRes]) => {
        setCustomer(pRes.data.data);
        setPets(petRes.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAddPet(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const { data } = await api.post<{ data: Pet }>("/customers/me/pets", {
        ...newPet,
        age: Number(newPet.age),
      });
      setPets((prev) => [...prev, data.data]);
      setNewPet({ name: "", species: "dog", age: "" });
      setShowAddPet(false);
    } finally {
      setAdding(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  const userName = typeof customer?.userId === "object"
    ? customer.userId.name
    : "Customer";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <CustomerNavbar />
        <div className="flex justify-center items-center min-h-[60vh]">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans">
      <CustomerNavbar />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-4">

        {/* Account nav */}
        <div className="flex gap-2 mb-2">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-primary bg-primary/5 border border-primary/20">
            <UserCircle size={14} /> Profile
          </div>
          <Link
            href="/customer/orders"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-500 bg-white border border-gray-200 hover:border-primary/40 hover:text-primary transition-colors"
          >
            <Package size={14} /> Orders
          </Link>
        </div>

        {/* Profile Header Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            <UserCircle size={32} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base">{userName}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {typeof customer?.userId === "object" ? customer.userId.email : ""}
            </p>
            <span className="inline-block mt-1.5 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
              Premium Member
            </span>
          </div>
          <button className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:border-primary/30 hover:text-primary transition-colors flex-shrink-0">
            Edit
          </button>
        </div>

        {/* My Pets */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <PawPrint className="w-4 h-4 text-primary" />
              <p className="font-bold text-sm text-gray-900">My Pets</p>
            </div>
            {!showAddPet && (
              <button
                onClick={() => setShowAddPet(true)}
                className="flex items-center gap-1 text-xs font-bold text-primary border border-primary/30 px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors"
              >
                <Plus size={12} /> Add Pet
              </button>
            )}
          </div>

          <div className="p-4">
            {/* Add Pet Form */}
            {showAddPet && (
              <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4 mb-4 animate-in slide-in-from-top-2 fade-in">
                <p className="text-sm font-bold text-gray-900 mb-3">Add a new family member</p>
                <form onSubmit={handleAddPet} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Name</label>
                      <Input
                        placeholder="e.g. Max"
                        value={newPet.name}
                        onChange={(e) => setNewPet((p) => ({ ...p, name: e.target.value }))}
                        required
                        className="h-10 rounded-xl bg-white border-gray-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Age (yrs)</label>
                      <Input
                        type="number"
                        placeholder="0"
                        min={0}
                        value={newPet.age}
                        onChange={(e) => setNewPet((p) => ({ ...p, age: e.target.value }))}
                        required
                        className="h-10 rounded-xl bg-white border-gray-200 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Species</label>
                    <select
                      value={newPet.species}
                      onChange={(e) => setNewPet((p) => ({ ...p, species: e.target.value }))}
                      className="w-full h-10 rounded-xl bg-white border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    >
                      {["dog", "cat", "bird", "rabbit", "other"].map((s) => (
                        <option key={s} value={s} className="capitalize">{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" onClick={() => setShowAddPet(false)} className="flex-1 h-10 rounded-xl text-xs font-bold">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={adding} className="flex-1 h-10 rounded-xl bg-primary text-white text-xs font-bold">
                      {adding ? "Saving..." : "Save Pet"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* Pet List */}
            {pets.length === 0 && !showAddPet ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-300">
                  <PawPrint size={20} />
                </div>
                <p className="text-sm text-gray-400 font-medium">No pets added yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pets.map((pet) => (
                  <div key={pet._id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl border border-gray-100 flex-shrink-0">
                      {SPECIES_EMOJI[pet.species] ?? "🐾"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{pet.name}</p>
                      <p className="text-xs text-gray-400 capitalize mt-0.5">{pet.species} · {pet.age} yrs</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              <p className="font-bold text-sm text-gray-900">Delivery Address</p>
            </div>
            <button className="text-xs font-semibold text-gray-500 border border-gray-200 px-3 py-1.5 rounded-full hover:border-primary/30 hover:text-primary transition-colors">
              Edit
            </button>
          </div>
          <div className="p-4">
            {customer?.addresses?.[0] ? (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    {customer.addresses[0].label ?? "Home"}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed font-medium">
                    {customer.addresses[0].street}, {customer.addresses[0].city},<br />
                    {customer.addresses[0].state} {customer.addresses[0].zip}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">
                <p className="text-sm text-gray-400 font-medium">No address saved.</p>
                <button className="mt-2 text-xs text-primary font-bold hover:underline">+ Add Address</button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden divide-y divide-gray-50">
          {[
            { label: "Order History", href: "/customer/orders", icon: <Package size={16} /> },
            { label: "Continue Shopping", href: "/customer/shop", icon: <PawPrint size={16} /> },
          ].map(({ label, href, icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors group"
            >
              <span className="text-gray-400 group-hover:text-primary transition-colors">{icon}</span>
              <span className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 flex-1">{label}</span>
              <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
            </Link>
          ))}
        </div>

        {/* Sign Out */}
        <div className="pt-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-red-500 text-sm font-bold hover:text-red-600 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors w-full"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
