import React, { useEffect } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Polyline,
  useMap,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { BASEMAPS } from './LayerDock'
import { SAMPLE_ROUTE } from './VehicleTracker'

const GANDHINAGAR = [23.2156, 72.6369]

const STATUS_COLOURS = {
  active: '#10b981',        // Emerald
  inactive: '#f59e0b',      // Amber
  decommissioned: '#64748b', // Slate
}

// Map Controller for programmatic flyTo actions
function MapController({ flyTarget }) {
  const map = useMap()
  useEffect(() => {
    if (flyTarget) {
      map.flyTo([flyTarget.lat, flyTarget.lon], flyTarget.zoom || 14, {
        duration: 1.5,
      })
    }
  }, [flyTarget, map])
  return null
}

export default function CameraMap({
  geojson,
  selectedId,
  onSelect,
  activeBasemap = 'dark',
  showBuffers = false,
  bufferRadius = 300,
  showRoute = false,
  activeRouteStep = 1,
  flyTarget,
  children,
}) {
  const basemapConfig = BASEMAPS[activeBasemap] || BASEMAPS.dark
  const routePoints = SAMPLE_ROUTE.map((r) => [r.lat, r.lon])

  return (
    <MapContainer
      center={GANDHINAGAR}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <MapController flyTarget={flyTarget} />

      {/* Dynamic Basemap Tile Layer */}
      <TileLayer
        key={activeBasemap}
        url={basemapConfig.url}
        attribution={basemapConfig.attribution}
      />

      {/* Optional PostGIS Gap Layer / Children */}
      {children}

      {/* Camera Coverage Buffers (if enabled) */}
      {showBuffers &&
        (geojson?.features ?? []).map((feature) => {
          const [lon, lat] = feature.geometry.coordinates
          const { id } = feature.properties
          return (
            <Circle
              key={`buffer-${id}`}
              center={[lat, lon]}
              radius={bufferRadius}
              pathOptions={{
                color: '#ffffff',
                weight: 1,
                fillColor: '#ffffff',
                fillOpacity: 0.04,
                dashArray: '3, 6',
              }}
            />
          )
        })}

      {/* Camera Pins */}
      {(geojson?.features ?? []).map((feature) => {
        const [lon, lat] = feature.geometry.coordinates
        const { id, name, status, vendor } = feature.properties
        const isSelected = selectedId === id
        const color = STATUS_COLOURS[status] ?? '#64748b'

        return (
          <React.Fragment key={id}>
            {/* Outer ring for selected camera */}
            {isSelected && (
              <CircleMarker
                center={[lat, lon]}
                radius={13}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: '#ffffff',
                  fillOpacity: 0.12,
                  weight: 1.5,
                }}
              />
            )}
            <CircleMarker
              center={[lat, lon]}
              radius={isSelected ? 6 : 4.5}
              pathOptions={{
                color: isSelected ? '#ffffff' : '#08090c',
                fillColor: color,
                fillOpacity: 1,
                weight: isSelected ? 2 : 1.5,
              }}
              eventHandlers={{ click: () => onSelect?.(id) }}
            >
              <Popup>
                <div className="text-xs space-y-1 font-sans">
                  <div className="font-semibold text-white">{name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {vendor || 'Unknown Vendor'} &bull;{' '}
                    <span
                      className={
                        status === 'active' ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'
                      }
                    >
                      {status}
                    </span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        )
      })}

      {/* Simulated Vehicle Route Trajectory (Test Case) */}
      {showRoute && (
        <>
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#f59e0b',
              weight: 3.5,
              opacity: 0.85,
              dashArray: '8, 6',
            }}
          />
          {SAMPLE_ROUTE.map((pt) => {
            const isActive = activeRouteStep === pt.step
            return (
              <CircleMarker
                key={`route-${pt.step}`}
                center={[pt.lat, pt.lon]}
                radius={isActive ? 12 : 7}
                pathOptions={{
                  color: isActive ? '#ef4444' : '#f59e0b',
                  fillColor: isActive ? '#f87171' : '#fbbf24',
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-amber-300">
                      Waypoint {pt.step}: {pt.city}
                    </div>
                    <div className="text-slate-300">{pt.name}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      Sighted: {pt.timestamp} | {pt.speed}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </>
      )}
    </MapContainer>
  )
}
