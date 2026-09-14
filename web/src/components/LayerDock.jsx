import React, { useState } from 'react'
import {
  Map as MapIcon,
  CircleDot,
  Grid,
  Route,
  Sliders,
} from 'lucide-react'

export const BASEMAPS = {
  dark: {
    name: 'Dark Canvas',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye',
  },
  voyager: {
    name: 'Voyager',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
  },
}

export default function LayerDock({
  activeBasemap,
  onSelectBasemap,
  showBuffers,
  onToggleBuffers,
  bufferRadius,
  onBufferRadiusChange,
  showGaps,
  onToggleGaps,
  showRoute,
  onToggleRoute,
}) {
  const [showRadiusSlider, setShowRadiusSlider] = useState(false)

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] titanium-glass px-3 py-1.5 rounded-2xl flex items-center gap-2.5 shadow-2xl">
      {/* Basemap Switcher Group */}
      <div className="flex items-center gap-0.5 bg-white/[0.03] p-0.5 rounded-xl border border-white/[0.06]">
        <MapIcon className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
        {Object.entries(BASEMAPS).map(([key, item]) => (
          <button
            key={key}
            onClick={() => onSelectBasemap(key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
              activeBasemap === key
                ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="h-4 w-[1px] bg-white/[0.08]" />

      {/* Layer Toggles */}
      <div className="flex items-center gap-1.5 text-xs font-mono">
        {/* Coverage Buffers Toggle with Radius Slider */}
        <div className="relative flex items-center">
          <button
            onClick={onToggleBuffers}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
              showBuffers
                ? 'bg-white/[0.12] border-white/[0.2] text-white font-medium shadow-sm'
                : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200'
            }`}
          >
            <CircleDot className="w-3 h-3 text-slate-300" />
            <span>Buffers ({bufferRadius}m)</span>
          </button>
          <button
            onClick={() => setShowRadiusSlider(!showRadiusSlider)}
            className="p-1 text-slate-500 hover:text-white transition cursor-pointer"
            title="Adjust coverage radius"
          >
            <Sliders className="w-3 h-3" />
          </button>

          {/* Popover slider */}
          {showRadiusSlider && (
            <div className="absolute bottom-11 left-0 titanium-glass p-3 rounded-xl w-48 shadow-2xl flex flex-col gap-2 z-20">
              <div className="flex justify-between text-[10px] font-mono uppercase text-slate-400">
                <span>Radius Buffer</span>
                <span className="text-white font-semibold">{bufferRadius}m</span>
              </div>
              <input
                type="range"
                min={100}
                max={1500}
                step={50}
                value={bufferRadius}
                onChange={(e) => onBufferRadiusChange(Number(e.target.value))}
                className="w-full accent-white cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* PostGIS Gaps Toggle */}
        <button
          onClick={onToggleGaps}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
            showGaps
              ? 'bg-amber-500/10 border-amber-500/50 text-amber-300 shadow-[inset_0_1px_0_0_rgba(245,158,11,0.2)]'
              : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid className="w-3 h-3 text-amber-400" />
          <span>Gap Grid</span>
        </button>

        {/* Vehicle Trajectory Route Toggle */}
        <button
          onClick={onToggleRoute}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all ${
            showRoute
              ? 'bg-white text-zinc-950 font-semibold shadow-sm'
              : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route className="w-3 h-3" />
          <span>Trajectory</span>
        </button>
      </div>
    </div>
  )
}
