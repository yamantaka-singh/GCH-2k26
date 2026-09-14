import React, { useState, useEffect } from 'react'
import {
  X,
  Radio,
  Wifi,
  ShieldCheck,
  AlertTriangle,
  HardDrive,
  Copy,
  Check,
  Crosshair,
  Activity,
  Cpu,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

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
  const [timeStr, setTimeStr] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  if (!camera) return null

  const dept = (departments || []).find((d) => d.id === camera.department_id)
  const isOnline = health?.reachable ?? (camera.status === 'active')

  const copyRtsp = () => {
    if (!camera.rtsp_url) return
    navigator.clipboard.writeText(camera.rtsp_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProbe = () => {
    setProbing(true)
    setTimeout(() => {
      setSimulatedPing(Math.floor(15 + Math.random() * 18))
      setProbing(false)
    }, 800)
  }

  return (
    <aside className="fixed top-20 right-3 bottom-4 z-[950] w-[410px] glass-panel rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-xs text-slate-100 truncate">
              {camera.name}
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {camera.external_ref || `CAMERA_NODE_${camera.id}`} &middot; {dept?.code || 'GOV'}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Simulated RTSP Stream Viewport */}
        <div className="relative aspect-video rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shadow-inner flex flex-col justify-between p-2.5">
          {/* Subtle Video Background Grid */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] opacity-40" />
          <div className="absolute inset-0 crt-overlay" />

          {/* Stream Header Overlay */}
          <div className="relative z-10 flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-slate-800 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>LIVE FEED</span>
            </div>
            <span className="text-slate-400 bg-black/60 px-1.5 py-0.5 rounded">
              {timeStr}
            </span>
          </div>

          {/* Simulated ANPR Bounding Box */}
          <div className="relative z-10 self-center my-auto flex flex-col items-center">
            <div className="w-32 h-16 border-2 border-cyan-400/80 rounded relative flex items-end justify-center bg-cyan-500/10 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <span className="absolute -top-4 left-0 text-[8px] font-mono bg-cyan-950 text-cyan-300 px-1 border border-cyan-500/60 rounded">
                VEHICLE DETECT: 98.6%
              </span>
              <span className="text-[9px] font-mono text-cyan-200 bg-black/80 px-1.5 py-0.5 mb-1 rounded border border-cyan-500/40">
                GJ-01-AB-1234
              </span>
            </div>
          </div>

          {/* Stream Telemetry Footer */}
          <div className="relative z-10 flex items-center justify-between text-[9px] font-mono text-slate-400 bg-black/70 px-2 py-1 rounded border border-slate-800/80">
            <span>{camera.resolution || '1080p'} @ {camera.fps || 25}fps</span>
            <span>RTSP / TCP</span>
            <span className="text-cyan-400 font-semibold">2.1 Mbps</span>
          </div>
        </div>

        {/* Reachability & Ping Card */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-slate-200">
                TCP STREAM REACHABILITY
              </span>
            </div>
            <button
              onClick={handleProbe}
              disabled={probing}
              className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              <RefreshCw className={`w-3 h-3 ${probing ? 'animate-spin' : ''}`} />
              <span>Probe</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full flex items-center justify-center ${
                  isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    isOnline ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Health State</div>
                <div className="text-xs font-semibold text-slate-200">
                  {isOnline ? 'Reachable' : 'Alert / Down'}
                </div>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center gap-2">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <div>
                <div className="text-[10px] text-slate-400">TCP Latency</div>
                <div className="text-xs font-mono font-semibold text-cyan-300">
                  {simulatedPing} ms
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Camera Metadata Specifications Grid */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-slate-200">
              HARDWARE & SPATIAL PROFILE
            </span>
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Department</span>
              <span className="font-medium text-slate-200">
                {dept?.name || 'Department of Home'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Coordinates (WGS84)</span>
              <span className="font-mono text-[11px] text-cyan-300">
                {camera.lat.toFixed(5)}°N, {camera.lon.toFixed(5)}°E
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Vendor & Model</span>
              <span className="font-medium text-slate-200">
                {camera.vendor || 'Generic'} {camera.model ? `(${camera.model})` : ''}
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <span className="text-slate-400">Storage Strategy</span>
              <span className="font-medium text-slate-200 capitalize">
                {camera.storage || 'Cloud Archive'} &middot; {camera.retention_days || 15}d
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">Address / Location</span>
              <span className="text-slate-300 text-right truncate max-w-[210px]">
                {camera.address || 'Gujarat Highway Infrastructure'}
              </span>
            </div>
          </div>
        </div>

        {/* RTSP Stream URI Reference */}
        {camera.rtsp_url && (
          <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">RTSP Ingest Endpoint</span>
              <button
                onClick={copyRtsp}
                className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-2 rounded bg-black/80 font-mono text-[10px] text-cyan-200/90 break-all border border-slate-800">
              {camera.rtsp_url}
            </div>
          </div>
        )}

        {/* Bottom Actions */}
        <button
          onClick={() => onCenterMap(camera.lat, camera.lon)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition shadow"
        >
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <span>Center on Map</span>
        </button>
      </div>
    </aside>
  )
}
