import { describe, expect, it } from 'vitest'
import { builtInBehavior, loadBehavior, saveBehavior, type Behavior } from './behavior'

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

const draft: Behavior = { ...builtInBehavior, zoom: { ...builtInBehavior.zoom, startZoom: builtInBehavior.zoom.startZoom + 1 } }

describe('the behavior tuner draft', () => {
  it('loads a draft saved under its old British key, then saves it under the new one', () => {
    const storage = memoryStorage()
    storage.setItem('scoremap.behaviourDraft', JSON.stringify({ builtIn: builtInBehavior, draft }))

    const loaded = loadBehavior(storage)
    saveBehavior(storage, loaded)

    expect(loaded).toEqual(draft)
    expect(storage.getItem('scoremap.behaviourDraft')).toBeNull()
    expect(loadBehavior(storage)).toEqual(draft)
  })
})
