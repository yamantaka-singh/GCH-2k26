import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Radio,
  Wifi,
  Copy,
  Check,
  Crosshair,
  RefreshCw,
  Eye,
  ZoomIn,
  Shield,
  Layers,
} from 'lucide-react'

// Authentic traffic CCTV video clips mapped deterministically
const VIDEO_FEEDS = [
  '/videos/traffic_junction_1.mp4',
  '/videos/traffic_junction_2.mp4',
  '/videos/traffic_highway_3.mp4',
]

export default function CameraInspector({
  camera,
  health,
  onClose,
  onCenterMap,
  departments,
}) {
  const [copied, setCopied] = useState(false)
  const [probing, setProbing] = useState(false)
  const [simulatedPing, setSimulatedPing] = useState(health?.latency_ms || 22)
  const [timeStr, setTimeStr] = useState('')
  const [opticalMode, setOpticalMode] = useState('normal') // 'normal' | 'nvg' | 'thermal'
  const [zoomLevel, setZoomLevel] = useState(1.0) // 1.0 | 1.5 | 2.0
  const [plateTrack, setPlateTrack] = useState({
    x: 48,
    y: 52,
    plate: 'GJ-01-AB-1234',
    conf: 98.6,
  })

  const videoRef = useRef(null)

  // Real-time UTC millisecond timecode ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      const utc = now.toISOString().replace('T', ' ').slice(0, 23)
      setTimeStr(`${utc} UTC`)
    }
    updateTime()
    const interval = setInterval(updateTime, 100)
    return () => clearInterval(interval)
  }, [])

  // Dynamic simulated vehicle bounding box track movement across video
  useEffect(() => {
    const plates = ['GJ-01-AB-1234', 'GJ-05-BX-9081', 'GJ-18-CZ-4521', 'GJ-27-K-8812']
    let step = 0
    const trackInterval = setInterval(() => {
      step = (step + 1) % 100
      const progress = (step % 20) / 20
      setPlateTrack({
        x: 35 + progress * 24,
        y: 42 + Math.sin(progress * Math.PI) * 10,
        plate: plates[Math.floor(step / 25) % plates.length],
        conf: +(96.5 + Math.sin(step) * 2.8).toFixed(1),
      })
    }, 400)
    return () => clearInterval(trackInterval)
  }, [camera?.id])

  if (!camera) return null

  const dept = (departments || []).find((d) => d.id === camera.department_id)
  const isOnline = health?.reachable ?? (camera.status === 'active')

  // Deterministic video feed for this camera
  const videoSrc = VIDEO_FEEDS[Math.abs(camera.id || 1) % VIDEO_FEEDS.length]

  const copyRtsp = () => {
    if (!camera.rtsp_url) return
    navigator.clipboard.writeText(camera.rtsp_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProbe = () => {
    setProbing(true)
    setTimeout(() => {
      setSimulatedPing(Math.floor(14 + Math.random() * 12))
      setProbing(false)
    }, 600)
  }

  // Determine optical filter class
  const getFilterClass = () => {
    if (opticalMode === 'nvg') return 'filter-optical-nvg'
    if (opticalMode === 'thermal') return 'filter-optical-thermal'
    return 'filter-optical-normal'
  }

  return (
    <aside className="fixed top-18 right-3 bottom-4 z-[950] w-[410px] titanium-glass rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white">
            <Radio className="w-3.5 h-3.5 text-zinc-200" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs text-white truncate">
              {camera.name}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              {camera.external_ref || `NODE-${camera.id}`} · {dept?.code || 'GOV'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.05] transition cursor-pointer"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {/* Real Video Surveillance Viewport */}
        <div className="relative aspect-video rounded-xl bg-[#06070a] border border-white/[0.1] overflow-hidden flex flex-col justify-between shadow-2xl">
          {/* Real Video Player */}
          <div className="absolute inset-0 overflow-hidden">
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className={`w-full h-full object-cover transition-all duration-300 ${getFilterClass()}`}
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
              }}
            />
          </div>

          {/* Optical Scanline Texture Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40 z-10" />

          {/* Top Live Video HUD */}
          <div className="relative z-20 p-2.5 flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/[0.1] text-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="tracking-widest font-semibold uppercase">
                {opticalMode === 'normal' && 'LIVE OPTICAL'}
                {opticalMode === 'nvg' && 'NVG PHOSPHOR'}
                {opticalMode === 'thermal' && 'FLIR THERMAL'}
              </span>
            </div>
            <span className="text-slate-300 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded border border-white/[0.1] tabular-nums text-[9px]">
              {timeStr}
            </span>
          </div>

          {/* Dynamic Computer Vision ANPR Bounding Box HUD */}
          <div
            className="absolute z-20 pointer-events-none transition-all duration-300 ease-out"
            style={{
              left: `${plateTrack.x}%`,
              top: `${plateTrack.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-28 h-14 border border-white/70 relative flex items-end justify-center bg-white/[0.04] shadow-lg">
              {/* Reticle Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
              <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />

              {/* Header Label */}
              <span className="absolute -top-3.5 left-0 text-[8px] font-mono bg-black/90 text-white px-1 border border-white/30 rounded tracking-wider">
                ANPR · {plateTrack.conf}%
              </span>

              {/* License Plate Text */}
              <span className="text-[9px] font-mono text-white bg-black/95 px-1.5 py-0.5 mb-1 rounded border border-white/30 tracking-widest font-bold">
                {plateTrack.plate}
              </span>
            </div>
          </div>

          {/* Bottom Stream Telemetry Strip */}
          <div className="relative z-20 m-2 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/[0.1]">
            <span>{camera.resolution || '1080p'} · {camera.fps || 25} FPS</span>
            <span>H.264 / TCP</span>
            <span className="text-white font-semibold">4.2 Mbps</span>
          </div>
        </div>

        {/* Optical Sensor Controls (Filter Modes & Digital PTZ Zoom) */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <Eye className="w-3 h-3 text-slate-300" />
              <span>Optical Filter</span>
            </span>
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <ZoomIn className="w-3 h-3 text-slate-300" />
              <span>PTZ Zoom</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Filter Toggle Pills */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/60 border border-white/[0.08] text-[10px] font-mono">
              <button
                onClick={() => setOpticalMode('normal')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  opticalMode === 'normal' ? 'bg-white text-zinc-950 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                NORM
              </button>
              <button
                onClick={() => setOpticalMode('nvg')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  opticalMode === 'nvg' ? 'bg-emerald-500 text-black font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                NVG
              </button>
              <button
                onClick={() => setOpticalMode('thermal')}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  opticalMode === 'thermal' ? 'bg-rose-500 text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                FLIR
              </button>
            </div>

            {/* PTZ Zoom Toggle Pills */}
            <div className="flex items-center p-0.5 rounded-lg bg-black/60 border border-white/[0.08] text-[10px] font-mono">
              {[1.0, 1.5, 2.0].map((level) => (
                <button
                  key={level}
                  onClick={() => setZoomLevel(level)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    zoomLevel === level ? 'bg-white text-zinc-950 font-semibold shadow-sm' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {level.toFixed(1)}X
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Telemetry & Reachability Grid */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              TELEMETRY AND REACHABILITY
            </span>
            <button
              onClick={handleProbe}
              disabled={probing}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.06] transition cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${probing ? 'animate-spin' : ''}`} />
              <span>Probe</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isOnline ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <div>
                <div className="text-[9px] font-mono text-slate-500 uppercase">State</div>
                <div className="text-xs font-semibold text-white">
                  {isOnline ? 'Active' : 'Unreachable'}
                </div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center gap-2">
              <Wifi className="w-3 h-3 text-slate-400" />
              <div>
                <div className="text-[9px] font-mono text-slate-500 uppercase">Latency</div>
                <div className="text-xs font-mono font-semibold text-white">
                  {simulatedPing} ms
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Camera Specifications Table */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            HARDWARE SPECIFICATION
          </span>

          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Department</span>
              <span className="font-medium text-white">
                {dept?.name || 'Department of Home'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">WGS84 Coordinates</span>
              <span className="font-mono text-[11px] text-white">
                {camera.lat.toFixed(5)}°N, {camera.lon.toFixed(5)}°E
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Vendor & Model</span>
              <span className="font-medium text-white">
                {camera.vendor || 'Generic'} {camera.model ? `(${camera.model})` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-white/[0.04]">
              <span className="text-slate-400">Retention Strategy</span>
              <span className="font-medium text-white capitalize">
                {camera.storage || 'Cloud Archive'} · {camera.retention_days || 15}d
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">Deployment Site</span>
              <span className="text-slate-300 text-right truncate max-w-[200px]">
                {camera.address || 'Gujarat Highway Corridor'}
              </span>
            </div>
          </div>
        </div>

        {/* RTSP Stream URI */}
        {camera.rtsp_url && (
          <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400 uppercase tracking-wider">RTSP INGEST ENDPOINT</span>
              <button
                onClick={copyRtsp}
                className="flex items-center gap-1 text-white hover:text-slate-200 transition cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-2 rounded bg-black/90 font-mono text-[10px] text-slate-300 break-all border border-white/[0.06]">
              {camera.rtsp_url}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <button
          onClick={() => onCenterMap(camera.lat, camera.lon)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition cursor-pointer active:scale-[0.99] shadow-lg"
        >
          <Crosshair className="w-3.5 h-3.5 text-zinc-950" />
          <span>Locate on Map</span>
        </button>
      </div>
    </aside>
  )
}
