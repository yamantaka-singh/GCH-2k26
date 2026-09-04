const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

let token = null
export const setToken = (t) => { token = t }
export const getToken = () => token

export async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  // FormData sets its own multipart boundary; a manual content type breaks it.
  if (options.body instanceof FormData) delete headers['Content-Type']

  const response = await fetch(`${BASE}${path}`, { ...options, headers })
  if (!response.ok) throw new Error(`${response.status} ${path}`)
  return response.json()
}

export async function login(email, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(result.access_token)
  return result
}

const query = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined),
  ).toString()

export const fetchDepartments = () => request('/departments')

export const fetchCameras = ({ departmentId = null, status = null, limit = 200, offset = 0 } = {}) =>
  request(`/cameras?${query({ department_id: departmentId, status, limit, offset })}`)

export const fetchCamera = (id) => request(`/cameras/${id}`)

export const fetchGeoJSON = ({ departmentId = null } = {}) =>
  request(`/geo/cameras.geojson?${query({ department_id: departmentId })}`)

export const fetchGaps = ({ minLon, minLat, maxLon, maxLat, cellM = 500, radiusM = 300 }) =>
  request(`/geo/gaps?${query({
    min_lon: minLon, min_lat: minLat, max_lon: maxLon, max_lat: maxLat,
    cell_m: cellM, radius_m: radiusM,
  })}`)

export const fetchHealthSummary = () => request('/health/summary')

export function importCsv(departmentId, file) {
  const form = new FormData()
  form.append('department_id', String(departmentId))
  form.append('file', file)
  return request('/cameras/import', { method: 'POST', body: form })
}
