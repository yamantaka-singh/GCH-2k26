import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Radio,
  Wifi,
  Copy,
  Check,
  Crosshair,
  RefreshCw,
  ZoomIn,
  VideoOff,
} from 'lucide-react'
import { fetchCameraHealth, fetchLiveUrl } from '../api'
import { attachWhep } from '../liveFeed'

export default function CameraInspector({
  camera,
  health,
  onClose,
  onCenterMap,
  departments,
}) {
  const [copied, setCopied] = useState(false)
  const [probing, setProbing] = useState(false)
  const [liveHealth, setLiveHealth] = useState(health)
  const [timeStr, setTimeStr] = useState('')
  const [zoomLevel, setZoomLevel] = useState(1.0) // 1.0 | 1.5 | 2.0
  const [feedError, setFeedError] = useState(null)

  const videoRef = useRef(null)

  useEffect(() => setLiveHealth(health), [health])

  // Real-time UTC millisecond timecode ticker -- this is genuinely "now", not
  // derived from the feed, which loops and carries its own unrelated on-screen clock.
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

  // Connects to the real grid feed over WebRTC (WHEP) when this camera has
  // one; otherwise shows an honest "no live feed" state -- never a stock clip.
  useEffect(() => {
    setFeedError(null)
    if (!camera?.id || !videoRef.current) return undefined
    let detach = () => {}
    let cancelled = false
    fetchLiveUrl(camera.id)
      .then(({ whep_url }) => {
        if (!cancelled) {
          detach = attachWhep(videoRef.current, whep_url, () => {
            if (!cancelled) setFeedError('Linked, but the feed is not responding.')
          })
        }
      })
      .catch(() => { if (!cancelled) setFeedError('No live grid feed linked to this camera.') })
    return () => { cancelled = true; detach() }
  }, [camera?.id])

  if (!camera) return null

  const dept = (departments || []).find((d) => d.id === camera.department_id)
  const isOnline = liveHealth?.reachable ?? (camera.status === 'active')

  const copyRtsp = () => {
    if (!camera.rtsp_url) return
    navigator.clipboard.writeText(camera.rtsp_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Re-fetches the real latest health-probe record (src/registry/health.py) --
  // not a simulated round trip.
  const handleProbe = () => {
    setProbing(true)
    fetchCameraHealth(camera.id)
      .then(setLiveHealth)
      .finally(() => setProbing(false))
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
        {/* Live Video Surveillance Viewport */}
        <div className="relative aspect-video rounded-xl bg-[#06070a] border border-white/[0.1] overflow-hidden flex flex-col justify-between shadow-2xl">
          {/* WebRTC (WHEP) video player -- srcObject is attached by liveFeed.js
              once the grid answers; no src= placeholder to avoid implying a feed
              that may not connect. */}
          <div className="absolute inset-0 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transition-all duration-300"
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            />
            {feedError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#06070a] text-slate-500">
                <VideoOff className="w-6 h-6" />
                <span className="text-[10px] font-mono uppercase tracking-wider">{feedError}</span>
              </div>
            )}
          </div>

          {/* Optical Scanline Texture Overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px] pointer-events-none opacity-40 z-10" />

          {/* Top Live Video HUD */}
          <div className="relative z-20 p-2.5 flex items-center justify-between text-[10px] font-mono">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/[0.1] text-slate-200">
              <span className={`w-1.5 h-1.5 rounded-full ${feedError ? 'bg-slate-500' : 'bg-rose-500 animate-pulse'}`} />
              <span className="tracking-widest font-semibold uppercase">
                {feedError ? 'NO FEED' : 'LIVE'}
              </span>
            </div>
            <span className="text-slate-300 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded border border-white/[0.1] tabular-nums text-[9px]">
              {timeStr}
            </span>
          </div>

          {/* Bottom Stream Telemetry Strip */}
          <div className="relative z-20 m-2 flex items-center justify-between text-[9px] font-mono text-slate-300 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/[0.1]">
            <span>{camera.resolution || '1080p'} · {camera.fps || 25} FPS</span>
            <span>H.264 / TCP</span>
          </div>
        </div>

        {/* Digital Zoom -- a CSS scale on the received video, not physical PTZ control */}
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-end text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider">
              <ZoomIn className="w-3 h-3 text-slate-300" />
              <span>Digital Zoom</span>
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            {/* Zoom Toggle Pills */}
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
                  {liveHealth?.latency_ms != null ? `${liveHealth.latency_ms} ms` : '--'}
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
