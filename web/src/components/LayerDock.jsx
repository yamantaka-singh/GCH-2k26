import React, { useState } from 'react'
import {
  Layers,
  Map as MapIcon,
  CircleDot,
  Grid,
  Route,
  ChevronUp,
  Sliders,
} from 'lucide-react'

export const BASEMAPS = {
  dark: {
    name: 'Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB &copy; OpenStreetMap',
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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[900] glass-panel px-4 py-2 rounded-2xl flex items-center gap-3 shadow-2xl">
      {/* Basemap Switcher Group */}
      <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
        <MapIcon className="w-3.5 h-3.5 text-slate-400 ml-1 mr-0.5" />
        {Object.entries(BASEMAPS).map(([key, item]) => (
          <button
            key={key}
            onClick={() => onSelectBasemap(key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
              activeBasemap === key
                ? 'bg-cyan-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="h-5 w-[1px] bg-slate-800" />

      {/* Layer Toggles */}
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {/* Coverage Buffers Toggle with Radius Slider */}
        <div className="relative flex items-center">
          <button
            onClick={onToggleBuffers}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition ${
              showBuffers
                ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300'
                : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Buffers ({bufferRadius}m)</span>
          </button>
          <button
            onClick={() => setShowRadiusSlider(!showRadiusSlider)}
            className="p-1 text-slate-400 hover:text-white"
            title="Adjust coverage radius"
          >
            <Sliders className="w-3 h-3" />
          </button>

          {/* Popover slider */}
          {showRadiusSlider && (
            <div className="absolute bottom-11 left-0 glass-panel p-3 rounded-xl w-48 shadow-xl flex flex-col gap-2 z-20">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Coverage Radius</span>
                <span className="font-mono text-cyan-400 font-semibold">{bufferRadius}m</span>
              </div>
              <input
                type="range"
                min={100}
                max={1500}
                step={50}
                value={bufferRadius}
                onChange={(e) => onBufferRadiusChange(Number(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* PostGIS Gaps Toggle */}
        <button
          onClick={onToggleGaps}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition ${
            showGaps
              ? 'bg-amber-950/60 border-amber-500/80 text-amber-300'
              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid className="w-3.5 h-3.5 text-amber-400" />
          <span>PostGIS Gaps</span>
        </button>

        {/* Vehicle Trajectory Route Toggle */}
        <button
          onClick={onToggleRoute}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition ${
            showRoute
              ? 'bg-rose-950/60 border-rose-500/80 text-rose-300'
              : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route className="w-3.5 h-3.5 text-rose-400" />
          <span>Trajectory</span>
        </button>
      </div>
    </div>
  )
}
