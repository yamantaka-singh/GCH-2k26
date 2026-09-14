import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  Camera,
  MapPin,
  Layers,
  Video,
  Route,
  UploadCloud,
  X,
  ArrowRight,
} from 'lucide-react'

export default function CommandPalette({
  isOpen,
  onClose,
  cameras,
  departments,
  onSelectCamera,
  onSwitchView,
  onToggleGaps,
  onOpenOnboard,
  onSwitchBasemap,
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  // Handle ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Filter matching cameras
  const q = query.trim().toLowerCase()
  const matchingCameras = (cameras || [])
    .filter((c) => {
      if (!q) return true
      return (
        c.name?.toLowerCase().includes(q) ||
        c.external_ref?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      )
    })
    .slice(0, 6)

  // Actions list
  const actions = [
    {
      id: 'matrix',
      icon: Video,
      label: 'Switch to Multi-Cam Video Wall',
      run: () => {
        onSwitchView('matrix')
        onClose()
      },
    },
    {
      id: 'map',
      icon: Layers,
      label: 'Switch to Tactical GIS Map',
      run: () => {
        onSwitchView('map')
        onClose()
      },
    },
    {
      id: 'trace',
      icon: Route,
      label: 'Activate ANPR Vehicle Trace Scrubber',
      run: () => {
        onSwitchView('trace')
        onClose()
      },
    },
    {
      id: 'sat',
      icon: MapPin,
      label: 'Switch Basemap to Esri Satellite Imagery',
      run: () => {
        onSwitchBasemap('satellite')
        onClose()
      },
    },
    {
      id: 'dark',
      icon: MapPin,
      label: 'Switch Basemap to Esri Dark Canvas',
      run: () => {
        onSwitchBasemap('dark')
        onClose()
      },
    },
    {
      id: 'gaps',
      icon: Layers,
      label: 'Toggle PostGIS Spatial Coverage Gaps',
      run: () => {
        onToggleGaps()
        onClose()
      },
    },
    {
      id: 'onboard',
      icon: UploadCloud,
      label: 'Open Bulk Camera CSV Onboarding Modal',
      run: () => {
        onOpenOnboard()
        onClose()
      },
    },
  ].filter((a) => !q || a.label.toLowerCase().includes(q))

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-start justify-center pt-24 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl titanium-glass overflow-hidden shadow-2xl border border-white/[0.12] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08]">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a camera name, corridor, node ID, or command..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-white/[0.05] border border-white/[0.1] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {/* Cameras Section */}
          {matchingCameras.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Cameras ({matchingCameras.length})
              </div>
              {matchingCameras.map((cam) => {
                const dept = (departments || []).find((d) => d.id === cam.department_id)
                return (
                  <button
                    key={cam.id}
                    onClick={() => {
                      onSelectCamera(cam)
                      onClose()
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/[0.06] transition cursor-pointer text-xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Camera className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium text-white truncate">{cam.name}</div>
                        <div className="text-[10px] font-mono text-slate-400 truncate">
                          {cam.external_ref || `NODE-${cam.id}`} · {dept?.code || 'POL'} · {cam.address || 'Gujarat Corridor'}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )
              })}
            </div>
          )}

          {/* Quick Commands Section */}
          {actions.length > 0 && (
            <div className="pt-2">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400">
                System Actions
              </div>
              {actions.map((act) => {
                const Icon = act.icon
                return (
                  <button
                    key={act.id}
                    onClick={act.run}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left hover:bg-white/[0.06] transition cursor-pointer text-xs group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0" />
                      <span className="text-slate-200 group-hover:text-white font-medium">
                        {act.label}
                      </span>
                    </div>
                    <kbd className="text-[9px] font-mono text-slate-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.06]">
                      ↵
                    </kbd>
                  </button>
                )
              })}
            </div>
          )}

          {matchingCameras.length === 0 && actions.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-500 font-mono">
              No matching cameras or commands found for "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
