import { describe, expect, it } from 'vitest'
import { pinLayout } from './zoomLevels'

describe('pinLayout', () => {
  it('shows small pins at the starting whole-globe zoom', () => {
    expect(pinLayout(1.5).size).toBe('small')
  })

  it('shows score cards once zoomed in to a region', () => {
    expect(pinLayout(7).size).toBe('card')
  })

  it('clusters score cards over a wider radius than small pins, since cards take more room', () => {
    expect(pinLayout(7).clusterRadius).toBeGreaterThan(pinLayout(1.5).clusterRadius)
  })
})
