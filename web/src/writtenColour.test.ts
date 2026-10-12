import { describe, expect, it } from 'vitest'
import { isColour, namesColour } from './writtenColour'

describe('a colour written out', () => {
  it('is a hex colour or a colour function anywhere in the text', () => {
    expect(isColour('#d4ac63')).toBe(true)
    expect(isColour('0 0 4px #000e28')).toBe(true)
    expect(isColour('rgba(0, 0, 0, 0.5)')).toBe(true)
    expect(isColour('oklch(70% 0.1 200)')).toBe(true)
  })

  it('is any CSS colour name, as the whole of the text', () => {
    expect(isColour('gold')).toBe(true)
    expect(isColour('teal')).toBe(true)
    expect(isColour(' WhiteSmoke ')).toBe(true)
    expect(isColour('Gold Cup final')).toBe(false)
  })

  it('is no colour when transparent or currentColor', () => {
    expect(isColour('transparent')).toBe(false)
    expect(isColour('currentColor')).toBe(false)
  })
})

describe('a CSS value naming a colour', () => {
  it('names it as any of its words, or writes it out', () => {
    expect(namesColour('1px solid teal')).toBe(true)
    expect(namesColour('0 0 0 2px RebeccaPurple inset')).toBe(true)
    expect(namesColour('linear-gradient(to bottom, #fff, var(--x))')).toBe(true)
  })

  it('names none in other words, transparent or currentColor', () => {
    expect(namesColour('1px solid transparent')).toBe(false)
    expect(namesColour('1px solid currentColor')).toBe(false)
    expect(namesColour('opacity 200ms ease-in-out')).toBe(false)
    expect(namesColour('red-alert-pulse 1s infinite')).toBe(false)
  })
})
