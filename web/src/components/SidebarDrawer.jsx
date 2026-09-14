import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
} from 'lucide-react'

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
      className={`fixed top-18 left-3 bottom-4 z-[900] transition-all duration-300 ease-in-out flex ${
        isOpen ? 'w-[360px]' : 'w-10'
      }`}
    >
      {/* Main Drawer Container */}
      <div className="w-full h-full titanium-glass rounded-2xl flex flex-col overflow-hidden relative">
        {/* Toggle Collapse Button */}
        <button
          onClick={onToggle}
          className="absolute -right-2.5 top-4 z-10 w-6 h-6 rounded-full bg-[#131720] border border-white/[0.15] text-slate-300 flex items-center justify-center shadow-lg hover:bg-white/[0.1] hover:text-white transition cursor-pointer"
          title={isOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {isOpen ? (
          <>
            {/* Header & Sub-filters */}
            <div className="p-3 border-b border-white/[0.06] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Video className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-semibold text-xs text-white uppercase tracking-wider">
                    Feed Ledger
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.08]">
                  {filtered.length} NODES
                </span>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-0.5 bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.06] text-[10px] font-mono">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`flex-1 py-1 rounded transition-all font-medium uppercase ${
                    filterStatus === 'all'
                      ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({cameras.length})
                </button>
                <button
                  onClick={() => setFilterStatus('active')}
                  className={`flex-1 py-1 rounded transition-all font-medium uppercase ${
                    filterStatus === 'active'
                      ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => setFilterStatus('inactive')}
                  className={`flex-1 py-1 rounded transition-all font-medium uppercase ${
                    filterStatus === 'inactive'
                      ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Alert
                </button>
              </div>
            </div>

            {/* Scrollable Camera Feed List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs font-mono">
                  NO NODES FOUND
                </div>
              ) : (
                filtered.map((camera) => {
                  const isSelected = selectedId === camera.id
                  const deptCode = deptMap[camera.department_id] || 'GOV'

                  return (
                    <div
                      key={camera.id}
                      data-testid="camera-card"
                      onClick={() => onSelectCamera(camera.id)}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer border text-left flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-white/[0.1] border-white/[0.25] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15)]'
                          : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.12] hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Top row: Status dot, Name & Dept Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              camera.status === 'active'
                                ? 'bg-emerald-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          <h4 className="font-medium text-xs text-white truncate">
                            {camera.name}
                          </h4>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-white/[0.08] bg-white/[0.04] text-slate-300 uppercase shrink-0">
                          {deptCode}
                        </span>
                      </div>

                      {/* Middle row: Specs */}
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                        <span>{camera.vendor || 'Generic'}</span>
                        <span className="text-white/[0.1]">&bull;</span>
                        <span>{camera.resolution || '1080p'}</span>
                        <span className="text-white/[0.1]">&bull;</span>
                        <span>{camera.fps ? `${camera.fps}fps` : '25fps'}</span>
                        {camera.retention_days && (
                          <>
                            <span className="text-white/[0.1]">&bull;</span>
                            <span className="text-slate-300">{camera.retention_days}d log</span>
                          </>
                        )}
                      </div>

                      {/* Bottom row: Coordinates & Address */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-white/[0.04]">
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <MapPin className="w-2.5 h-2.5 text-slate-500 shrink-0" />
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
            <Video className="w-4 h-4 text-slate-300" />
            <div className="[writing-mode:vertical-rl] text-[9px] font-mono tracking-widest uppercase text-slate-500">
              {cameras.length} NODES
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
