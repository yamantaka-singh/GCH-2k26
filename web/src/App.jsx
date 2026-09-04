import { useEffect, useState } from 'react'
import {
  fetchCameras, fetchDepartments, fetchGeoJSON, fetchHealthSummary, importCsv, login,
} from './api'
import CameraDetail from './components/CameraDetail'
import CameraMap from './components/CameraMap'
import CameraTable from './components/CameraTable'
import GapLayer from './components/GapLayer'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('admin@gujarat.gov.in')
  const [password, setPassword] = useState('sentinel')
  const [error, setError] = useState(null)
  const [cameras, setCameras] = useState([])
  const [geojson, setGeojson] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [summary, setSummary] = useState(null)
  const [showGaps, setShowGaps] = useState(false)
  const [importReport, setImportReport] = useState(null)
  const [departmentId, setDepartmentId] = useState(null)
  const [gapError, setGapError] = useState(null)

  useEffect(() => {
    if (!authed) return
    Promise.all([fetchCameras(), fetchGeoJSON(), fetchHealthSummary()])
      .then(([list, fc, totals]) => { setCameras(list.items); setGeojson(fc); setSummary(totals) })
      .catch((e) => setError(e.message))
  }, [authed])

  async function submit(event) {
    event.preventDefault()
    setError(null)
    try {
      const session = await login(email, password)
      const departments = await fetchDepartments()
      // A state_admin has no department of its own; fall back to the first listed.
      setDepartmentId(session.department_id ?? departments[0]?.id ?? null)
      setAuthed(true)
    } catch (e) {
      setError(e.message)
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    if (!file || departmentId === null) return
    try {
      setImportReport(await importCsv(departmentId, file))
      const [list, fc] = await Promise.all([fetchCameras(), fetchGeoJSON()])
      setCameras(list.items)
      setGeojson(fc)
    } catch (e) {
      setError(e.message)
    }
  }

  if (!authed) {
    return (
      <form onSubmit={submit} style={{ padding: 24, display: 'grid', gap: 8, maxWidth: 320 }}>
        <h1 style={{ fontSize: 20 }}>Sentinel Registry</h1>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)}
               type="password" placeholder="password" />
        <button type="submit">Sign in</button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', height: '100vh' }}>
      <aside style={{ overflowY: 'auto', borderRight: '1px solid #ddd' }}>
        <h1 style={{ fontSize: 18, padding: '12px 8px' }}>Cameras ({cameras.length})</h1>
        {summary && (
          <p style={{ padding: '0 8px', fontSize: 13 }}>
            {summary.reachable} up · {summary.unreachable} down · {summary.unknown} unchecked
          </p>
        )}
        <div style={{ padding: 8, display: 'grid', gap: 6 }}>
          <label style={{ fontSize: 13 }}>
            <input type="checkbox" checked={showGaps}
                   onChange={(e) => setShowGaps(e.target.checked)} /> Show coverage gaps
          </label>
          {showGaps && gapError && (
            <p style={{ fontSize: 12, color: '#b45309', margin: 0 }}>
              Coverage gaps unavailable: zoom in or use larger cells.
            </p>
          )}
          <input type="file" accept=".csv" onChange={upload} disabled={departmentId === null} />
          {importReport && (
            <p style={{ fontSize: 13 }}>
              Imported {importReport.inserted}, {importReport.errors.length} rejected
            </p>
          )}
        </div>
        {error && <p style={{ color: 'crimson', padding: 8 }}>{error}</p>}
        <CameraTable cameras={cameras} onSelect={setSelectedId} selectedId={selectedId} />
        <CameraDetail cameraId={selectedId} />
      </aside>
      <main>
        <CameraMap geojson={geojson} onSelect={setSelectedId}>
          <GapLayer enabled={showGaps} onError={setGapError} />
        </CameraMap>
      </main>
    </div>
  )
}
