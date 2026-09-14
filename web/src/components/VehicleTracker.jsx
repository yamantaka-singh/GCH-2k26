import React from 'react'
import { Compass, X } from 'lucide-react'

// This system has no plate recognition (ANPR), so there is no real
// cross-camera trajectory to plot. Previously this held a hardcoded fake
// route (camera ids that no longer exist) and a permanently-shown fake
// "watchlist hit" banner -- kept as an empty export so App.jsx's optional
// "fly to the first waypoint" still degrades gracefully (SAMPLE_ROUTE[0] is
// undefined, so it just doesn't fly).
export const SAMPLE_ROUTE = []

export default function VehicleTracker({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <div className="fixed bottom-16 left-3 z-[920] w-[360px] titanium-glass rounded-2xl p-3.5 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
              Vehicle Trajectory
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Cross-Camera Tracking
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] leading-relaxed text-slate-400">
        No trajectory data. Cross-camera tracking needs plate recognition
        (ANPR) to link sightings across cameras, which this system doesn't
        run yet -- only vehicle-class detection (see the analytics report).
      </div>
    </div>
  )
}
