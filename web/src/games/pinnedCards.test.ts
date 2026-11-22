import { expect, it, vi } from 'vitest'
import { pinnedCards } from './pinnedCards'

it('keeps a visit’s pins in order and forgets games that leave the board', () => {
  const pins = pinnedCards()
  const changed = vi.fn()
  const unsubscribe = pins.subscribe(changed)

  pins.toggle('a')
  pins.toggle('b')
  pins.toggle('a')
  pins.toggle('a')
  expect(pins.games()).toEqual(['b', 'a'])
  expect(pinnedCards().games()).toEqual([])

  const before = pins.games()
  pins.retain(new Set(['a', 'b', 'c']))
  expect(pins.games()).toBe(before)
  expect(changed).toHaveBeenCalledTimes(4)

  pins.retain(new Set(['c', 'b']))
  expect(pins.games()).toEqual(['b'])
  expect(changed).toHaveBeenCalledTimes(5)
  unsubscribe()
  pins.toggle('b')
  expect(changed).toHaveBeenCalledTimes(5)
})
