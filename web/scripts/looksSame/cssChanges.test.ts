import { describe, expect, it } from 'vitest'
import { cssChanges } from './cssChanges.ts'

describe('cssChanges', () => {
  it('finds none where every declaration computes the same', () => {
    const declarations = [{ rule: '.score-card', property: 'padding-left', value: '6px' }]

    expect(cssChanges(declarations, [...declarations])).toEqual([])
  })

  it('lists each declaration whose value changed, was added or went, ordered by rule and property', () => {
    const base = [
      { rule: '.score-card', property: 'padding-left', value: '6px' },
      { rule: '.score-card', property: 'color', value: 'rgb(244, 245, 247)' },
      { rule: '.game-panel:hover', property: 'opacity', value: '0.8' },
      { rule: '@keyframes live-light › 50%', property: 'opacity', value: '0.5' },
    ]
    const work = [
      { rule: '@keyframes live-light › 50%', property: 'opacity', value: '0.5' },
      { rule: '.score-card', property: 'color', value: 'rgb(212, 172, 99)' },
      { rule: '.score-card', property: 'padding-left', value: '7px' },
      { rule: '@media (max-width: 600px) › .game-panel', property: 'width', value: '390px' },
    ]

    expect(cssChanges(base, work)).toEqual([
      { rule: '.game-panel:hover', property: 'opacity', base: '0.8', work: undefined },
      { rule: '.score-card', property: 'color', base: 'rgb(244, 245, 247)', work: 'rgb(212, 172, 99)' },
      { rule: '.score-card', property: 'padding-left', base: '6px', work: '7px' },
      { rule: '@media (max-width: 600px) › .game-panel', property: 'width', base: undefined, work: '390px' },
    ])
  })
})
