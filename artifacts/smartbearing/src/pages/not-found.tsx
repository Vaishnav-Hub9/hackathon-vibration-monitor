import { Link } from "wouter";
import { Activity, Home, Radar } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Themed 404 — "Bearing Not Found".
 * Matches the navy/amber design language with ambient aurora, a spinning
 * bearing glyph and quick exits back into the app.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-navy relative overflow-hidden flex items-center justify-center p-6">
      {/* Ambient background */}
      <div className="absolute inset-0 grid-bg opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-navy via-navy/60 to-navy" />
      <div className="aurora aurora-animate w-[480px] h-[480px] bg-amber/10 -top-40 -left-32" />
      <div className="aurora aurora-animate w-[420px] h-[420px] bg-[#3B82F6]/10 -bottom-40 -right-32" style={{ animationDelay: '-6s' }} />

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        {/* Spinning bearing glyph */}
        <div className="relative mx-auto w-28 h-28">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber/30 animate-spin [animation-duration:14s] [animation-timing-function:linear]" />
          <div className="absolute inset-3 rounded-full border-2 border-dashed border-amber/20 animate-spin [animation-duration:10s] [animation-direction:reverse] [animation-timing-function:linear]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber/20 to-[#EA580C]/10 border border-amber/30 shadow-[0_0_30px_rgba(245,158,11,0.25)]">
              <Activity className="w-9 h-9 text-amber" />
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#EA580C] ping-ring" style={{ color: '#EA580C' }} />
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 border border-amber/30 bg-amber/10 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse" />
            <span className="text-amber text-xs font-bold tracking-widest uppercase">Error 404 · Spindle Not Found</span>
          </div>
          <h1 className="font-display text-6xl sm:text-7xl font-bold leading-none text-gradient-amber">
            Bearing<br />Not Found
          </h1>
          <p className="text-slate-400 text-base max-w-md mx-auto leading-relaxed">
            This spindle doesn't exist in the fleet — or it's been taken offline.
            The remaining 400 spindles are still running fine.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button className="bg-amber hover:bg-amber/90 text-navy font-semibold h-11 px-7 text-sm shadow-[0_0_24px_rgba(245,158,11,0.3)] border-none">
              <Home className="w-4 h-4 mr-2" /> Back to Dashboard
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="border-navy text-slate-300 hover:text-white hover:bg-navy-card h-11 px-7 text-sm">
              <Radar className="w-4 h-4 mr-2" /> Scan Fleet
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
