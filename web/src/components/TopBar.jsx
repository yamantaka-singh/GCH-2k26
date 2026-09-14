import React from 'react'
import {
  Shield,
  Radio,
  Search,
  PlusCircle,
  Car,
  LogOut,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
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
    <header className="fixed top-3 left-3 right-3 z-[1000] flex items-center justify-between px-4 py-2.5 rounded-2xl glass-panel text-slate-100 shadow-2xl">
      {/* Brand & Telemetry */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 beacon-pulse-emerald" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wider text-sm bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent">
                SENTINEL
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-400 font-mono border border-cyan-500/30">
                MODEL 1 + 5
              </span>
            </div>
            <p className="text-[10px] text-slate-400 tracking-tight">
              Gujarat Police CCTV Registry & GIS
            </p>
          </div>
        </div>

        {/* Telemetry Counter Pill */}
        {summary && (
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{summary.reachable} <span className="text-slate-500">online</span></span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{summary.unreachable} <span className="text-slate-500">alert</span></span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5 text-slate-400">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{summary.unknown} <span className="text-slate-500">idle</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Middle: Search & Department Chips */}
      <div className="flex items-center gap-3 max-w-xl w-full mx-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search cameras, IP, city, vendor..."
            className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs glass-input focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        {/* Department Chips */}
        <div className="hidden xl:flex items-center gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800/80">
          <button
            onClick={() => onSelectDept(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              selectedDept === null
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            All ({totalCameras})
          </button>
          {(departments || []).map((dept) => (
            <button
              key={dept.id}
              onClick={() => onSelectDept(dept.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                selectedDept === dept.id
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {dept.code}
            </button>
          ))}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5">
        {/* Vehicle Tracker Test Case Toggle */}
        <button
          onClick={onToggleTracking}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
            trackingActive
              ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
              : 'bg-slate-900/60 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800/70'
          }`}
          title="Toggle Vehicle Trajectory & Watchlist Sighting Test Case"
        >
          <Car className="w-3.5 h-3.5 text-amber-400" />
          <span>Vehicle Trace</span>
        </button>

        {/* Onboard Camera Button */}
        <button
          onClick={onOpenOnboarding}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/40 border border-cyan-400/30 transition"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Onboard</span>
        </button>

        {/* User Session / Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[11px] font-medium text-slate-200">State Admin</span>
            <span className="text-[9px] font-mono text-cyan-400">SCRB Gujarat</span>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/60 transition"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
