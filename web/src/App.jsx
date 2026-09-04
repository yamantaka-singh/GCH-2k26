import { useEffect, useState } from 'react'
import { fetchCameras, fetchGeoJSON, login } from './api'
import CameraMap from './components/CameraMap'
import CameraTable from './components/CameraTable'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('admin@gujarat.gov.in')
  const [password, setPassword] = useState('sentinel')
  const [error, setError] = useState(null)
  const [cameras, setCameras] = useState([])
  const [geojson, setGeojson] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (!authed) return
    Promise.all([fetchCameras(), fetchGeoJSON()])
      .then(([list, fc]) => { setCameras(list.items); setGeojson(fc) })
      .catch((e) => setError(e.message))
  }, [authed])

  async function submit(event) {
    event.preventDefault()
    setError(null)
    try {
      await login(email, password)
      setAuthed(true)
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
        {error && <p style={{ color: 'crimson', padding: 8 }}>{error}</p>}
        <CameraTable cameras={cameras} onSelect={setSelectedId} selectedId={selectedId} />
      </aside>
      <main>
        <CameraMap geojson={geojson} onSelect={setSelectedId} />
      </main>
    </div>
  )
}
