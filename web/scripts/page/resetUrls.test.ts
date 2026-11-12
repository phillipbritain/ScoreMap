import { describe, expect, it } from 'vitest'
import { resetUrls } from './resetUrls.ts'

describe('resetUrls', () => {
  it('clears storage at the origin and opens the app at the web URL', () => {
    expect(resetUrls('http://localhost:5173')).toEqual({ clear: 'http://localhost:5173/favicon.svg', open: 'http://localhost:5173' })
  })

  it('keeps a query for the app, not for the favicon', () => {
    expect(resetUrls('http://localhost:5173/?variant=A')).toEqual({
      clear: 'http://localhost:5173/favicon.svg',
      open: 'http://localhost:5173/?variant=A',
    })
  })
})
