import { useEffect, useState } from 'react'
import { fetchCamera, request } from '../api'

const LABEL = { true: 'reachable', false: 'unreachable', null: 'never checked' }
const COLOUR = { true: '#16a34a', false: '#dc2626', null: '#6b7280' }

export default function CameraDetail({ cameraId }) {
  const [camera, setCamera] = useState(null)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!cameraId) return
    setCamera(null)
    setError(null)
    fetchCamera(cameraId).then(setCamera).catch((e) => setError(e.message))
    request(`/cameras/${cameraId}/health`).then(setHealth).catch(() => setHealth(null))
  }, [cameraId])

  if (!cameraId) return null
  if (error) return <p style={{ padding: 8, color: 'crimson' }}>Could not load camera: {error}</p>
  if (!camera) return <p style={{ padding: 8 }}>Loading…</p>

  const key = String(health?.reachable ?? null)
  return (
    <div style={{ padding: 8, borderTop: '1px solid #ddd' }}>
      <h2 style={{ fontSize: 16 }}>{camera.name}</h2>
      <p style={{ margin: '4px 0', color: COLOUR[key] }}>{LABEL[key]}
        {health?.latency_ms != null && ` · ${health.latency_ms} ms`}</p>
      <dl style={{ fontSize: 13, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px' }}>
        <dt>Vendor</dt><dd>{camera.vendor ?? '—'}</dd>
        <dt>Kind</dt><dd>{camera.kind}</dd>
        <dt>Retention</dt><dd>{camera.retention_days ?? '—'} days</dd>
        <dt>Coordinates</dt><dd>{camera.lat.toFixed(5)}, {camera.lon.toFixed(5)}</dd>
        <dt>RTSP</dt><dd style={{ wordBreak: 'break-all' }}>{camera.rtsp_url ?? '—'}</dd>
      </dl>
    </div>
  )
}
