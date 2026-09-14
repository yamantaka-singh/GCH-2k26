import React, { useState, useEffect } from 'react'
import {
  X,
  Radio,
  Wifi,
  Copy,
  Check,
  Crosshair,
  RefreshCw,
  Sliders,
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
  const [timeStr, setTimeStr] = useState(new Date().toUTCString().slice(17, 25))

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toUTCString().slice(17, 25))
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
      setSimulatedPing(Math.floor(14 + Math.random() * 12))
      setProbing(false)
    }, 600)
  }

  return (
    <aside className="fixed top-18 right-3 bottom-4 z-[950] w-[390px] titanium-glass rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
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
              {camera.external_ref || `NODE-${camera.id}`} &middot; {dept?.code || 'GOV'}
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

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {/* Optical Stream Viewport (Minimalist Broadcast Feed) */}
        <div className="relative aspect-video rounded-xl bg-[#06070a] border border-white/[0.08] overflow-hidden flex flex-col justify-between p-2.5 shadow-inner">
          {/* Subtle grid backdrop */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />

          {/* Stream Header Overlay */}
          <div className="relative z-10 flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/60 border border-white/[0.08] text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="tracking-widest uppercase">OPTICAL STREAM</span>
            </div>
            <span className="text-slate-400 bg-black/60 px-1.5 py-0.5 rounded border border-white/[0.05]">
              {timeStr} UTC
            </span>
          </div>

          {/* Minimalist ANPR Hairline Bounding Box */}
          <div className="relative z-10 self-center my-auto flex flex-col items-center">
            <div className="w-36 h-18 border border-white/40 rounded relative flex items-end justify-center bg-white/[0.02]">
              {/* Precision Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
              <div className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
              <div className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
              <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />

              <span className="absolute -top-3.5 left-1 text-[8px] font-mono bg-black/80 text-white px-1 border border-white/[0.2] rounded tracking-wider">
                TARGET VEHICLE &bull; 98.6%
              </span>
              <span className="text-[9px] font-mono text-white bg-black/90 px-1.5 py-0.5 mb-1.5 rounded border border-white/[0.2] tracking-wider font-semibold">
                GJ-01-AB-1234
              </span>
            </div>
          </div>

          {/* Stream Telemetry Footer */}
          <div className="relative z-10 flex items-center justify-between text-[9px] font-mono text-slate-400 bg-black/80 px-2 py-1 rounded border border-white/[0.08]">
            <span>{camera.resolution || '1080p'} &bull; {camera.fps || 25} FPS</span>
            <span>H.264 / TCP</span>
            <span className="text-white font-semibold">4.2 Mbps</span>
          </div>
        </div>

        {/* Telemetry & Reachability Grid */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              TELEMETRY & REACHABILITY
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
                {camera.storage || 'Cloud Archive'} &middot; {camera.retention_days || 15}d
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
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white border border-white/[0.1] transition cursor-pointer active:scale-[0.99]"
        >
          <Crosshair className="w-3.5 h-3.5 text-zinc-200" />
          <span>Locate on Map</span>
        </button>
      </div>
    </aside>
  )
}
