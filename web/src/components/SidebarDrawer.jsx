import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Video,
  Eye,
  Crosshair,
  Signal,
  MapPin,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'

const DEPT_COLORS = {
  POL: 'border-blue-500/40 text-blue-300 bg-blue-950/40',
  RTO: 'border-amber-500/40 text-amber-300 bg-amber-950/40',
  FCS: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/40',
  UDD: 'border-purple-500/40 text-purple-300 bg-purple-950/40',
  REV: 'border-cyan-500/40 text-cyan-300 bg-cyan-950/40',
}

export default function SidebarDrawer({
  cameras,
  selectedId,
  onSelectCamera,
  isOpen,
  onToggle,
  departments,
}) {
  const [filterStatus, setFilterStatus] = useState('all')

  const deptMap = (departments || []).reduce((acc, d) => {
    acc[d.id] = d.code
    return acc
  }, {})

  const filtered = (cameras || []).filter((c) => {
    if (filterStatus === 'active') return c.status === 'active'
    if (filterStatus === 'inactive') return c.status === 'inactive'
    return true
  })

  return (
    <aside
      className={`fixed top-20 left-3 bottom-4 z-[900] transition-all duration-300 ease-in-out flex ${
        isOpen ? 'w-[370px]' : 'w-11'
      }`}
    >
      {/* Main Drawer Container */}
      <div className="w-full h-full glass-panel rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
        {/* Toggle Collapse Button */}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-4 z-10 w-7 h-7 rounded-full bg-slate-800 border border-slate-600 text-cyan-400 flex items-center justify-center shadow-lg hover:bg-slate-700 transition"
          title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isOpen ? (
          <>
            {/* Header & Sub-filters */}
            <div className="p-3.5 border-b border-slate-800/80 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-cyan-400" />
                  <span className="font-semibold text-xs tracking-wide text-slate-100">
                    CAMERA FEED INVENTORY
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800/90 text-cyan-300 border border-slate-700">
                  {filtered.length} nodes
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80 text-[11px]">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`flex-1 py-1 rounded-lg transition font-medium ${
                    filterStatus === 'all'
                      ? 'bg-slate-800 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({cameras.length})
                </button>
                <button
                  onClick={() => setFilterStatus('active')}
                  className={`flex-1 py-1 rounded-lg transition font-medium ${
                    filterStatus === 'active'
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setFilterStatus('inactive')}
                  className={`flex-1 py-1 rounded-lg transition font-medium ${
                    filterStatus === 'inactive'
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Alert
                </button>
              </div>
            </div>

            {/* Scrollable Camera Feed List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  No cameras match the current filter
                </div>
              ) : (
                filtered.map((camera) => {
                  const isSelected = selectedId === camera.id
                  const deptCode = deptMap[camera.department_id] || 'GOV'
                  const colorClass = DEPT_COLORS[deptCode] || 'border-slate-700 text-slate-300 bg-slate-900'

                  return (
                    <div
                      key={camera.id}
                      onClick={() => onSelectCamera(camera.id)}
                      className={`p-2.5 rounded-xl transition cursor-pointer border text-left flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-cyan-950/50 border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-slate-950/40 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Top row: Status dot, Name & Dept Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              camera.status === 'active'
                                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                                : 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                            }`}
                          />
                          <h4 className="font-medium text-xs text-slate-200 truncate">
                            {camera.name}
                          </h4>
                        </div>
                        <span
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 ${colorClass}`}
                        >
                          {deptCode}
                        </span>
                      </div>

                      {/* Middle row: Specs */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                        <span>{camera.vendor || 'Generic'}</span>
                        <span>&middot;</span>
                        <span>{camera.resolution || '1080p'}</span>
                        <span>&middot;</span>
                        <span>{camera.fps ? `${camera.fps}fps` : '25fps'}</span>
                        {camera.retention_days && (
                          <>
                            <span>&middot;</span>
                            <span className="text-cyan-400/80">{camera.retention_days}d log</span>
                          </>
                        )}
                      </div>

                      {/* Bottom row: Coordinates & Address */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="truncate">{camera.address || `${camera.lat.toFixed(4)}, ${camera.lon.toFixed(4)}`}</span>
                        </span>
                        <span className="text-[9px] font-mono text-slate-400">
                          {camera.external_ref || `ID-${camera.id}`}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        ) : (
          /* Collapsed Mini Bar View */
          <div className="flex flex-col items-center py-4 gap-4 text-slate-400">
            <Video className="w-5 h-5 text-cyan-400" />
            <div className="writing-mode-vertical text-[10px] font-mono tracking-widest uppercase">
              {cameras.length} NODES
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
