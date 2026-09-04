import { describe, expect, it } from 'vitest'
import { boundsToBbox } from './components/GapLayer'

describe('boundsToBbox', () => {
  it('maps leaflet bounds onto the api parameter names', () => {
    const bounds = {
      getWest: () => 72.60, getSouth: () => 23.20,
      getEast: () => 72.70, getNorth: () => 23.30,
    }
    expect(boundsToBbox(bounds)).toEqual({
      minLon: 72.60, minLat: 23.20, maxLon: 72.70, maxLat: 23.30,
    })
  })
})
