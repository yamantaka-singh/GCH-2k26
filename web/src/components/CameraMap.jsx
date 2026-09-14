import React, { useEffect } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Polyline,
  Polygon,
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

      {/* Camera Pins and Directional Optical FOV Cones */}
      {(geojson?.features ?? []).map((feature) => {
        const [lon, lat] = feature.geometry.coordinates
        const { id, name, status, vendor } = feature.properties
        const isSelected = selectedId === id
        const color = STATUS_COLOURS[status] ?? '#64748b'

        // Deterministic optical azimuth angle based on camera ID
        const azimuth = (id * 67) % 360
        const fovAngle = 60
        const distanceM = isSelected ? 220 : 140
        const dLat = distanceM / 111320
        const dLon = distanceM / (111320 * Math.cos((lat * Math.PI) / 180))
        const rad1 = ((azimuth - fovAngle / 2) * Math.PI) / 180
        const rad2 = ((azimuth + fovAngle / 2) * Math.PI) / 180
        const fovCone = [
          [lat, lon],
          [lat + dLat * Math.cos(rad1), lon + dLon * Math.sin(rad1)],
          [lat + dLat * Math.cos(rad2), lon + dLon * Math.sin(rad2)],
        ]

        return (
          <React.Fragment key={id}>
            {/* Directional Optical FOV Cone */}
            {(isSelected || showBuffers) && (
              <Polygon
                positions={fovCone}
                pathOptions={{
                  color: isSelected ? '#ffffff' : color,
                  weight: isSelected ? 1.5 : 0.8,
                  fillColor: isSelected ? '#ffffff' : color,
                  fillOpacity: isSelected ? 0.18 : 0.08,
                  dashArray: isSelected ? undefined : '2, 4',
                }}
              />
            )}

            {/* Outer ring for selected camera */}
            {isSelected && (
              <CircleMarker
                center={[lat, lon]}
                radius={14}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: '#ffffff',
                  fillOpacity: 0.15,
                  weight: 1.5,
                }}
              />
            )}
            <CircleMarker
              center={[lat, lon]}
              radius={isSelected ? 6.5 : 4.5}
              pathOptions={{
                color: isSelected ? '#ffffff' : '#08090c',
                fillColor: color,
                fillOpacity: 1,
                weight: isSelected ? 2.5 : 1.5,
              }}
              eventHandlers={{ click: () => onSelect?.(id) }}
            >
              <Popup>
                <div className="text-xs space-y-1 font-sans">
                  <div className="font-semibold text-white">{name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {vendor || 'Generic'} ·{' '}
                    <span
                      className={
                        status === 'active' ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'
                      }
                    >
                      {status}
                    </span>
                    <span className="text-slate-500 ml-1.5">({azimuth}° AZ)</span>
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
