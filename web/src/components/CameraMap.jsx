import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

const STATUS_COLOUR = { active: '#16a34a', inactive: '#f59e0b', decommissioned: '#6b7280' }
const GANDHINAGAR = [23.2156, 72.6369]

export default function CameraMap({ geojson, onSelect, children }) {
  return (
    <MapContainer center={GANDHINAGAR} zoom={12} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      {(geojson?.features ?? []).map((feature) => {
        // GeoJSON is [lon, lat]; Leaflet wants [lat, lon].
        const [lon, lat] = feature.geometry.coordinates
        const { id, name, status, vendor } = feature.properties
        return (
          <CircleMarker
            key={id}
            center={[lat, lon]}
            radius={6}
            pathOptions={{ color: STATUS_COLOUR[status] ?? '#6b7280', fillOpacity: 0.85 }}
            eventHandlers={{ click: () => onSelect?.(id) }}
          >
            <Popup>
              <strong>{name}</strong>
              <br />
              {vendor ?? 'unknown vendor'} &middot; {status}
            </Popup>
          </CircleMarker>
        )
      })}
      {children}
    </MapContainer>
  )
}
