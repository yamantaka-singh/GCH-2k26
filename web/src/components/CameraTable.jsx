export default function CameraTable({ cameras, onSelect, selectedId }) {
  if (cameras.length === 0) return <p style={{ padding: '1rem' }}>No cameras yet.</p>
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          {['Name', 'Vendor', 'Kind', 'Status'].map((h) => (
            <th key={h} style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #ddd' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cameras.map((camera) => (
          <tr
            key={camera.id}
            onClick={() => onSelect?.(camera.id)}
            style={{
              cursor: 'pointer',
              background: camera.id === selectedId ? '#eef2ff' : 'transparent',
            }}
          >
            <td style={{ padding: 6 }}>{camera.name}</td>
            <td style={{ padding: 6 }}>{camera.vendor ?? '—'}</td>
            <td style={{ padding: 6 }}>{camera.kind}</td>
            <td style={{ padding: 6 }}>{camera.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
