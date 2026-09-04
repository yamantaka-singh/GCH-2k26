import { useEffect, useState } from 'react'
import { Polygon, useMap, useMapEvents } from 'react-leaflet'
import { fetchGaps } from '../api'

export const boundsToBbox = (bounds) => ({
  minLon: bounds.getWest(),
  minLat: bounds.getSouth(),
  maxLon: bounds.getEast(),
  maxLat: bounds.getNorth(),
})

export default function GapLayer({ enabled, radiusM = 300, cellM = 500, onError }) {
  const map = useMap()
  const [cells, setCells] = useState([])

  async function reload() {
    if (!enabled) return setCells([])
    try {
      const { cells } = await fetchGaps({ ...boundsToBbox(map.getBounds()), cellM, radiusM })
      setCells(cells)
      onError?.(null)
    } catch (e) {
      // The API refuses a bbox needing too many cells. Without this the overlay
      // would just vanish on zoom-out with no explanation.
      setCells([])
      onError?.(e.message)
    }
  }

  useMapEvents({ moveend: reload, zoomend: reload })
  useEffect(() => { reload() }, [enabled, radiusM, cellM])

  return cells.map((cell, index) => (
    <Polygon
      key={index}
      // GeoJSON rings are [lon, lat]; Leaflet wants [lat, lon].
      positions={cell.coordinates[0].map(([lon, lat]) => [lat, lon])}
      pathOptions={{ color: '#dc2626', weight: 1, fillOpacity: 0.18 }}
    />
  ))
}
