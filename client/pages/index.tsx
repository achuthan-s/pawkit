import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, PawPrint, BarChart3, Sparkles } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <div className="max-w-6xl w-full space-y-16 z-10">
        
        {/* Hero Section */}
        <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-sm text-primary mb-4 font-medium tracking-wide">
            <Sparkles className="w-4 h-4" />
            <span>Welcome to the Future of Pet Care</span>
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white">
            PawKit <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-200">Platform</span>
          </h1>
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground font-light leading-relaxed">
            An exclusive ecosystem designed for pet parents, marketers, and administrators. 
            Select your portal to experience tailored perfection.
          </p>
        </div>

        {/* Portals Grid */}
        <div className="grid md:grid-cols-2 gap-8 pt-8 max-w-3xl mx-auto w-full">

          {/* Customer */}
          <Link href="/login?role=customer" className="group block">
            <div className="glass-panel glass-panel-hover rounded-2xl p-8 h-full flex flex-col items-start relative overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-150">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                <PawPrint className="w-24 h-24 text-primary" />
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6 group-hover:bg-primary/20 transition-colors duration-500">
                <PawPrint className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2 group-hover:text-primary transition-colors">Customer</h2>
              <p className="text-sm text-primary/80 uppercase tracking-wider font-semibold mb-6">Pet Parent</p>

              <ul className="space-y-3 text-muted-foreground flex-grow w-full z-10">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary/50" /> Discover &amp; shop</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary/50" /> Browse curated products</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary/50" /> Seamless order tracking</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-primary/50" /> Manage pet profiles</li>
              </ul>

              <div className="mt-8 pt-6 border-t border-white/10 w-full flex items-center justify-between text-white group-hover:text-primary transition-colors z-10">
                <span className="font-medium">Enter Portal</span>
                <ArrowRight className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>
          </Link>

          {/* CRM */}
          <Link href="/login?role=marketer" className="group block">
            <div className="glass-panel glass-panel-hover rounded-2xl p-8 h-full flex flex-col items-start relative overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity duration-500">
                <BarChart3 className="w-24 h-24 text-blue-400" />
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-6 group-hover:bg-blue-500/20 transition-colors duration-500">
                <BarChart3 className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">CRM</h2>
              <p className="text-sm text-blue-400/80 uppercase tracking-wider font-semibold mb-6">Marketer</p>

              <ul className="space-y-3 text-muted-foreground flex-grow w-full z-10">
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" /> AI-driven insights</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" /> Launch elite campaigns</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" /> 360° customer view</li>
                <li className="flex items-center gap-3"><div className="w-1.5 h-1.5 rounded-full bg-blue-400/50" /> Revenue analytics</li>
              </ul>

              <div className="mt-8 pt-6 border-t border-white/10 w-full flex items-center justify-between text-white group-hover:text-blue-400 transition-colors z-10">
                <span className="font-medium">Enter Portal</span>
                <ArrowRight className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" />
              </div>
            </div>
          </Link>

        </div>
      </div>
    </main>
  );
}
