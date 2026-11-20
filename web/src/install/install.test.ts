import { describe, expect, it, vi } from 'vitest'
import { installHintStore, installPrompts, installWay, isIos, showsIosHint, type HintStorage, type IosHintState } from './install'

describe('installWay', () => {
  it('asks the browser when it has offered to install', () => {
    expect(installWay({ installed: false, ios: false, canPrompt: true })).toBe('prompt')
  })

  it('gives the iOS steps on iOS', () => {
    expect(installWay({ installed: false, ios: true, canPrompt: false })).toBe('iosSteps')
  })

  it('offers nothing in a browser that can neither be asked nor is iOS', () => {
    expect(installWay({ installed: false, ios: false, canPrompt: false })).toBeNull()
  })

  it('offers nothing in the installed app', () => {
    expect(installWay({ installed: true, ios: false, canPrompt: true })).toBeNull()
    expect(installWay({ installed: true, ios: true, canPrompt: false })).toBeNull()
  })
})

describe('isIos', () => {
  it('knows an iPhone and an iPad', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1', 5)).toBe(true)
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1', 5)).toBe(true)
  })

  it('knows an iPad asking for desktop sites by its touch screen', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 5)).toBe(true)
  })

  it("doesn't take a Mac or Android for iOS", () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 0)).toBe(false)
    expect(isIos('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36', 5)).toBe(false)
  })
})

describe('showsIosHint', () => {
  const firstVisitAfterTour: IosHintState = { way: 'iosSteps', revealed: true, touring: false, dismissed: false, asked: false }

  it('shows on iOS once the welcome tour is finished or skipped', () => {
    expect(showsIosHint(firstVisitAfterTour)).toBe(true)
  })

  it('waits for the reveal and for the welcome tour to finish', () => {
    expect(showsIosHint({ ...firstVisitAfterTour, revealed: false })).toBe(false)
    expect(showsIosHint({ ...firstVisitAfterTour, touring: true })).toBe(false)
  })

  it("doesn't show again once closed, unless asked for from More", () => {
    expect(showsIosHint({ ...firstVisitAfterTour, dismissed: true })).toBe(false)
    expect(showsIosHint({ ...firstVisitAfterTour, dismissed: true, asked: true })).toBe(true)
  })

  it("doesn't show off iOS or in the installed app", () => {
    expect(showsIosHint({ ...firstVisitAfterTour, way: 'prompt' })).toBe(false)
    expect(showsIosHint({ ...firstVisitAfterTour, way: null, asked: true })).toBe(false)
  })
})

describe('installHintStore', () => {
  const memory = (): HintStorage => {
    const saved = new Map<string, string>()
    return { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => void saved.set(key, value) }
  }

  it('remembers the hint was closed', () => {
    const storage = memory()
    expect(installHintStore(() => storage).dismissed()).toBe(false)
    installHintStore(() => storage).dismiss()
    expect(installHintStore(() => storage).dismissed()).toBe(true)
  })

  it('carries on when storage is blocked', () => {
    const blocked = installHintStore(() => {
      throw new Error('blocked')
    })
    expect(() => blocked.dismiss()).not.toThrow()
    expect(blocked.dismissed()).toBe(false)
  })
})

describe('installPrompts', () => {
  const offer = () => Object.assign(new Event('beforeinstallprompt', { cancelable: true }), { prompt: vi.fn(async () => {}) })

  it("keeps the browser's offer, holding back its own banner", () => {
    const page = new EventTarget()
    const prompts = installPrompts(page)
    const event = offer()
    page.dispatchEvent(event)
    expect(prompts.canPrompt()).toBe(true)
    expect(event.defaultPrevented).toBe(true)
  })

  it('shows the install dialog once, then has no offer left', () => {
    const page = new EventTarget()
    const prompts = installPrompts(page)
    const event = offer()
    page.dispatchEvent(event)
    const changed = vi.fn()
    prompts.subscribe(changed)
    prompts.prompt()
    expect(event.prompt).toHaveBeenCalledOnce()
    expect(prompts.canPrompt()).toBe(false)
    expect(changed).toHaveBeenCalled()
  })

  it('drops the offer once ScoreMap is installed', () => {
    const page = new EventTarget()
    const prompts = installPrompts(page)
    page.dispatchEvent(offer())
    page.dispatchEvent(new Event('appinstalled'))
    expect(prompts.canPrompt()).toBe(false)
  })
})
