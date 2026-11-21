import { describe, expect, it, vi } from 'vitest'
import { installPrompts, offersInstall } from './install'

describe('offersInstall', () => {
  it('offers Install app when the browser has offered to install', () => {
    expect(offersInstall({ installed: false, canPrompt: true })).toBe(true)
  })

  it('offers nothing in a browser that has not, such as iOS, which installs by its own Share menu', () => {
    expect(offersInstall({ installed: false, canPrompt: false })).toBe(false)
  })

  it('offers nothing in the installed app', () => {
    expect(offersInstall({ installed: true, canPrompt: true })).toBe(false)
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
