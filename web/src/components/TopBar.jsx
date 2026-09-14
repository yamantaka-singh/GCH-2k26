import React from 'react'
import {
  Shield,
  Search,
  Plus,
  Compass,
  LogOut,
  SlidersHorizontal,
} from 'lucide-react'

export default function TopBar({
  summary,
  searchQuery,
  onSearchChange,
  selectedDept,
  onSelectDept,
  departments,
  onOpenOnboarding,
  trackingActive,
  onToggleTracking,
  onLogout,
  totalCameras,
}) {
  return (
    <header className="fixed top-3 left-3 right-3 z-[1000] flex items-center justify-between px-4 py-2.5 rounded-2xl titanium-glass text-slate-100">
      {/* Brand & Telemetry */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.1] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
            <Shield className="w-4 h-4 text-zinc-100" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-sm text-white">
                SENTINEL
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-300 font-mono border border-white/[0.08] uppercase tracking-wider">
                M1+M5
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono tracking-tight uppercase">
              Gujarat Police &middot; GIS Registry
            </p>
          </div>
        </div>

        {/* Telemetry Counter Pill */}
        {summary && (
          <div className="hidden lg:flex items-center gap-3 px-3 py-1 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-white">{summary.reachable}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">online</span>
            </div>
            <span className="text-white/[0.1]">&bull;</span>
            <div className="flex items-center gap-1.5 text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span className="font-medium text-white">{summary.unreachable}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">alert</span>
            </div>
            <span className="text-white/[0.1]">&bull;</span>
            <div className="flex items-center gap-1.5 text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span className="font-medium text-white">{summary.unknown}</span>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">idle</span>
            </div>
          </div>
        )}
      </div>

      {/* Middle: Search & Department Chips */}
      <div className="flex items-center gap-3 max-w-xl w-full mx-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by camera ID, IP, vendor, corridor..."
            className="w-full pl-8 pr-10 py-1.5 rounded-xl text-xs titanium-input"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-500 border border-white/[0.08] bg-white/[0.02]">
            ⌘K
          </span>
        </div>

        {/* Department Segmented Control */}
        <div className="hidden xl:flex items-center gap-0.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06]">
          <button
            onClick={() => onSelectDept(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
              selectedDept === null
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            ALL ({totalCameras})
          </button>
          {(departments || []).map((dept) => (
            <button
              key={dept.id}
              onClick={() => onSelectDept(dept.id)}
              className={`px-2 py-1 rounded-lg text-xs font-mono transition-all ${
                selectedDept === dept.id
                  ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              {dept.code}
            </button>
          ))}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {/* Vehicle Tracker Toggle */}
        <button
          onClick={onToggleTracking}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all border ${
            trackingActive
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.2)]'
              : 'bg-white/[0.03] border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Toggle Vehicle Trajectory & Watchlist Sighting Test Case"
        >
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span>Vehicle Trace</span>
        </button>

        {/* Onboard Camera Button */}
        <button
          onClick={onOpenOnboarding}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-white text-zinc-950 hover:bg-zinc-200 transition-all shadow-sm active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-zinc-900" />
          <span>Onboard</span>
        </button>

        {/* User Session / Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/[0.08]">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[11px] font-medium text-slate-200">Admin</span>
            <span className="text-[9px] font-mono text-slate-500">SCRB Gujarat</span>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-white/[0.04] transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
