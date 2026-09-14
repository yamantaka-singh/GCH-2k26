import React, { useState, useEffect } from 'react'
import {
  Compass,
  Play,
  Pause,
  SkipForward,
  Clock,
  X,
  ShieldAlert,
} from 'lucide-react'

export const SAMPLE_ROUTE = [
  {
    step: 1,
    camera_id: 2,
    name: 'Sector 18 Police HQ Junction',
    city: 'Gandhinagar',
    lat: 23.2156,
    lon: 72.6369,
    timestamp: '10:04:12 IST',
    speed: '42 km/h',
    confidence: '99.1%',
  },
  {
    step: 2,
    camera_id: 5,
    name: 'SG Highway - Iscon Cross Road',
    city: 'Ahmedabad',
    lat: 23.0272,
    lon: 72.5074,
    timestamp: '10:18:45 IST',
    speed: '68 km/h',
    confidence: '98.4%',
  },
  {
    step: 3,
    camera_id: 25,
    name: 'Vadodara - Akshar Chowk Flyover',
    city: 'Vadodara',
    lat: 22.2965,
    lon: 73.1672,
    timestamp: '11:02:18 IST',
    speed: '82 km/h',
    confidence: '97.8%',
  },
  {
    step: 4,
    camera_id: 27,
    name: 'Surat - Ring Road Textile Market Crossing',
    city: 'Surat',
    lat: 21.1942,
    lon: 72.8458,
    timestamp: '12:15:30 IST',
    speed: '54 km/h',
    confidence: '98.9%',
  },
]

export default function VehicleTracker({
  isOpen,
  onClose,
  activeStep,
  onStepChange,
  onFlyTo,
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [plateQuery, setPlateQuery] = useState('GJ-01-AB-1234')

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      onStepChange((prev) => {
        const next = prev >= SAMPLE_ROUTE.length ? 1 : prev + 1
        const target = SAMPLE_ROUTE[next - 1]
        if (target) onFlyTo(target.lat, target.lon)
        return next
      })
    }, 2500)
    return () => clearInterval(interval)
  }, [isPlaying, onStepChange, onFlyTo])

  if (!isOpen) return null

  const currentSighting = SAMPLE_ROUTE[activeStep - 1] || SAMPLE_ROUTE[0]

  return (
    <div className="fixed bottom-16 left-3 z-[920] w-[360px] titanium-glass rounded-2xl p-3.5 flex flex-col gap-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="font-semibold text-xs text-white uppercase tracking-wider">
              Vehicle Re-ID Trajectory
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              Cross-Camera Chronological Scrubber
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

      {/* Target Plate Query Pill */}
      <div className="flex items-center gap-2 bg-white/[0.02] p-2 rounded-xl border border-white/[0.06]">
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Target</span>
        <input
          value={plateQuery}
          onChange={(e) => setPlateQuery(e.target.value)}
          className="bg-transparent text-white font-mono font-semibold text-xs focus:outline-none flex-1 tracking-wider"
        />
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.08]">
          4 SIGHTINGS
        </span>
      </div>

      {/* Watchlist Hit Alert Banner */}
      <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 flex items-start gap-2 text-rose-200">
        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div className="text-[11px] leading-snug">
          <div className="font-semibold text-rose-300 uppercase tracking-wide text-[10px] font-mono">
            Watchlist Sighting Confirmed
          </div>
          <p className="text-rose-200/70 text-[10px] mt-0.5">
            Hotlist ID #SCRB-9022: eGujCop CCTNS match. Route trajectory triangulated across 4 junctions.
          </p>
        </div>
      </div>

      {/* Current Sighting Card */}
      <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-mono text-slate-300 text-[10px] uppercase tracking-wider">
            Waypoint {currentSighting.step} of 4 &middot; {currentSighting.city}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-mono text-slate-400">
            <Clock className="w-3 h-3 text-slate-500" />
            {currentSighting.timestamp}
          </span>
        </div>
        <div className="font-medium text-white text-xs truncate">
          {currentSighting.name}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/[0.04]">
          <span>Speed: <span className="text-white font-semibold">{currentSighting.speed}</span></span>
          <span>Confidence: <span className="text-emerald-400 font-semibold">{currentSighting.confidence}</span></span>
        </div>
      </div>

      {/* Scrubber Controls */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase">
          <span>Route Progress</span>
          <span>{activeStep} / 4 Waypoints</span>
        </div>
        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={activeStep}
          onChange={(e) => {
            const step = Number(e.target.value)
            onStepChange(step)
            const target = SAMPLE_ROUTE[step - 1]
            if (target) onFlyTo(target.lat, target.lon)
          }}
          className="w-full accent-white cursor-pointer"
        />

        {/* Play / Step Buttons */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3 h-3 text-zinc-900" /> : <Play className="w-3 h-3 text-zinc-900" />}
            <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
          </button>
          <button
            onClick={() => {
              const next = activeStep >= 4 ? 1 : activeStep + 1
              onStepChange(next)
              const target = SAMPLE_ROUTE[next - 1]
              if (target) onFlyTo(target.lat, target.lon)
            }}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08] transition cursor-pointer"
            title="Next Step"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
