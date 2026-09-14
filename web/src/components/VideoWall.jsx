import React, { useState, useEffect } from 'react'
import {
  Grid,
  Radio,
  Crosshair,
  Maximize2,
  ExternalLink,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'

const VIDEO_FEEDS = [
  '/videos/traffic_junction_1.mp4',
  '/videos/traffic_junction_2.mp4',
  '/videos/traffic_highway_3.mp4',
]

export default function VideoWall({
  cameras,
  departments,
  onSelectCamera,
  onSwitchToMap,
}) {
  const [matrixSize, setMatrixSize] = useState(4) // 4 (2x2) or 6 (3x2)
  const [selectedDept, setSelectedDept] = useState(null)
  const [timeStr, setTimeStr] = useState('')

  // Live UTC timecode ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const utc = now.toISOString().replace('T', ' ').slice(11, 23)
      setTimeStr(`${utc} UTC`)
    }
    updateTime()
    const interval = setInterval(updateTime, 100)
    return () => clearInterval(interval)
  }, [])

  // Filter cameras
  const filtered = (cameras || []).filter((c) => {
    if (selectedDept && c.department_id !== selectedDept) return false
    return true
  })

  const visibleCameras = filtered.slice(0, matrixSize)

  const handleTileClick = (camera) => {
    onSelectCamera(camera)
    onSwitchToMap()
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#08090c] text-white p-4 md:p-6 overflow-hidden">
      {/* Wall Header Control Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/[0.05] border border-white/[0.1]">
              <Grid className="w-3.5 h-3.5 text-white" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-white uppercase font-mono">
              Netram CCC · Multi-Camera Surveillance Wall
            </h2>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
            Gujarat Police Integrated Command and Control Center Live Optical Matrix
          </p>
        </div>

        {/* Matrix Controls */}
        <div className="flex items-center gap-2">
          {/* Department Pills */}
          <div className="hidden md:flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[10px] font-mono">
            <button
              onClick={() => setSelectedDept(null)}
              className={`px-2 py-1 rounded transition cursor-pointer ${
                selectedDept === null
                  ? 'bg-white text-zinc-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ALL
            </button>
            {(departments || []).map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDept(d.id)}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  selectedDept === d.id
                    ? 'bg-white text-zinc-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {d.code}
              </button>
            ))}
          </div>

          {/* Grid Layout Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-[10px] font-mono">
            <button
              onClick={() => setMatrixSize(4)}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                matrixSize === 4
                  ? 'bg-white text-zinc-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              2x2 (4 CAM)
            </button>
            <button
              onClick={() => setMatrixSize(6)}
              className={`px-2.5 py-1 rounded transition cursor-pointer ${
                matrixSize === 6
                  ? 'bg-white text-zinc-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              3x2 (6 CAM)
            </button>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div
        className={`flex-1 grid gap-3 overflow-hidden ${
          matrixSize === 4
            ? 'grid-cols-1 md:grid-cols-2 grid-rows-2'
            : 'grid-cols-1 md:grid-cols-3 grid-rows-2'
        }`}
      >
        {visibleCameras.map((cam, idx) => {
          const dept = (departments || []).find((d) => d.id === cam.department_id)
          const videoSrc = VIDEO_FEEDS[Math.abs(cam.id || idx) % VIDEO_FEEDS.length]

          return (
            <div
              key={cam.id}
              onClick={() => handleTileClick(cam)}
              className="group relative rounded-xl bg-[#090b10] border border-white/[0.08] hover:border-white/30 transition-all duration-200 overflow-hidden flex flex-col justify-between cursor-pointer shadow-xl"
            >
              {/* Native Video Feed */}
              <div className="absolute inset-0 overflow-hidden bg-black">
                <video
                  src={videoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>

              {/* CRT Scanline Overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-30 z-10" />

              {/* Tile Top Header Overlay */}
              <div className="relative z-20 p-2.5 flex items-center justify-between text-[10px] font-mono bg-gradient-to-b from-black/80 via-black/40 to-transparent">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-white truncate max-w-[180px] drop-shadow">
                    {cam.name}
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-white/[0.1] text-slate-300 border border-white/[0.1] text-[9px]">
                    {dept?.code || 'POL'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300 tabular-nums text-[9px] bg-black/60 px-1.5 py-0.5 rounded border border-white/[0.08]">
                  <span>{timeStr}</span>
                </div>
              </div>

              {/* Center Vehicle Reticle Placeholder */}
              <div className="relative z-20 self-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-[10px] font-mono text-white shadow-2xl">
                <Crosshair className="w-3.5 h-3.5 text-white" />
                <span>Click to Inspect and Locate on Map</span>
              </div>

              {/* Tile Bottom Telemetry Overlay */}
              <div className="relative z-20 p-2.5 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                <span className="text-slate-400">{cam.external_ref || `NODE-${cam.id}`}</span>
                <span>{cam.resolution || '1080p'} · {cam.fps || 25} FPS · 4.2 Mbps</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
