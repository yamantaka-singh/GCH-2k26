import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchGaps, login, request, setToken } from './api'

afterEach(() => {
  setToken(null)
  vi.unstubAllGlobals()
})

function stubFetch(body, ok = true, status = 200) {
  const spy = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', spy)
  return spy
}

describe('api client', () => {
  it('stores the token returned by login', async () => {
    stubFetch({ access_token: 'abc', role: 'viewer', department_id: null })
    const result = await login('a@b.in', 'pw')
    expect(result.access_token).toBe('abc')
  })

  it('sends the bearer header once a token is set', async () => {
    const spy = stubFetch({ items: [] })
    setToken('abc')
    await request('/cameras')
    expect(spy.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
  })

  it('omits the bearer header when there is no token', async () => {
    const spy = stubFetch({ items: [] })
    await request('/cameras')
    expect(spy.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('throws with the status on a failed response', async () => {
    stubFetch({ detail: 'nope' }, false, 403)
    await expect(request('/cameras')).rejects.toThrow('403')
  })

  it('serialises a bbox into gap query parameters', async () => {
    const spy = stubFetch({ cells: [] })
    await fetchGaps({ minLon: 72.6, minLat: 23.2, maxLon: 72.7, maxLat: 23.3, cellM: 500, radiusM: 300 })
    const url = spy.mock.calls[0][0]
    expect(url).toContain('min_lon=72.6')
    expect(url).toContain('cell_m=500')
    expect(url).toContain('radius_m=300')
  })
})
