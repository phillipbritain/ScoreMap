import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { commands } from 'vitest/browser'
import './index.css'
import { applyTheme } from './theme/applyTheme'
import { builtInTheme } from './theme/builtInTheme'

declare module 'vitest/browser' {
  interface BrowserCommands {
    reduceMotion: (reduce: boolean) => Promise<void>
  }
}

applyTheme(document.documentElement, builtInTheme)

afterEach(async () => {
  document.body.replaceChildren()
  await commands.reduceMotion(false)
})

/** An element with the given classes, on the page, inside the outer ones. */
function element(...classNames: string[]): HTMLElement {
  let parent: HTMLElement = document.body
  for (const className of classNames) {
    const child = document.createElement('div')
    child.className = className
    parent.append(child)
    parent = child
  }
  return parent
}

/** The keyframes of the CSS animation running on an element, as the browser worked them out. */
function keyframesOf(target: HTMLElement): ComputedKeyframe[] {
  const animations = target.getAnimations()
  expect(animations).toHaveLength(1)
  return (animations[0].effect as KeyframeEffect).getKeyframes()
}

const hotIndicator = () => element('score-card score-card--live', 'score-card__hot-indicator')
const pinRing = (animation: string) => element(`pin-pulse pin-pulse--pin pin-pulse--${animation}`)
const pinAnimations = ['score', 'start'] as const
const rocket = () => element('loading-screen', 'loading-screen__rocket', 'loading-screen__rocket-heading', 'loading-screen__rocket-ship')

/** A star streaming past the loading screen's rocket. */
function star(): Element {
  const streaming = document.createElement('span')
  element('loading-screen', 'loading-screen__rocket', 'loading-screen__rocket-stars').append(streaming)
  return streaming
}

const leavingLoadingScreen = () => element('loading-screen loading-screen--leaving')
const messageWord = () => element('loading-screen', 'loading-screen__message', 'loading-screen__word')

/** A closing ellipsis's three dots, in its box, inside a loading screen's message. */
function messageDots(): HTMLElement {
  const dots = element('loading-screen', 'loading-screen__message', 'loading-screen__dots')
  dots.append(document.createElement('span'), document.createElement('span'), document.createElement('span'))
  return dots
}

describe('with reduce motion off', () => {
  it('animates a hot game’s indicator, its glowing outline', () => {
    const indicator = hotIndicator()
    expect(indicator.getAnimations({ subtree: true }).length).toBeGreaterThan(0)
  })

  it.each(pinAnimations)('grows a pin’s %s ring', (animation) => {
    const transforms = keyframesOf(pinRing(animation)).map((keyframe) => keyframe.transform)
    expect(transforms.filter((transform) => transform !== undefined).length).toBeGreaterThan(1)
  })

  it('flies the loading screen’s rocket', () => {
    const ship = rocket()
    const keyframes = keyframesOf(ship)
    const transforms = keyframes.map((keyframe) => keyframe.transform).filter((transform) => transform !== undefined)

    expect(new Set(transforms).size).toBeGreaterThan(1)
    expect(ship.getAnimations()[0].effect?.getComputedTiming().iterations).toBe(Infinity)
  })

  it('streams the stars past the loading screen’s rocket, for as long as it shows', () => {
    const streaming = star()
    const animations = streaming.getAnimations()

    expect(animations).toHaveLength(1)
    const transforms = (animations[0].effect as KeyframeEffect).getKeyframes().map((keyframe) => keyframe.transform)
    expect(new Set(transforms.filter((transform) => transform !== undefined)).size).toBeGreaterThan(1)
    expect(animations[0].effect?.getComputedTiming().iterations).toBe(Infinity)
  })

  it('drifts each word of the loading screen’s message up into place', () => {
    const transforms = keyframesOf(messageWord()).map((keyframe) => keyframe.transform)

    expect(new Set(transforms.filter((transform) => transform !== undefined)).size).toBeGreaterThan(1)
  })

  it('lights the dots of the message’s ellipsis one after another, for as long as it shows', () => {
    const dots = [...messageDots().children] as HTMLElement[]
    const timings = dots.map((dot) => dot.getAnimations()[0].effect!.getComputedTiming())

    expect(timings.every((timing) => timing.iterations === Infinity)).toBe(true)
    expect(new Set(timings.map((timing) => timing.delay)).size).toBe(3)
  })

  it('fades the loading screen out as it leaves', () => {
    const screen = leavingLoadingScreen()
    const opacities = keyframesOf(screen).map((keyframe) => Number(keyframe.opacity))

    expect(opacities.at(0)).toBe(1)
    expect(opacities.at(-1)).toBe(0)
    expect(screen.getAnimations()[0].effect?.getComputedTiming().duration).toBeGreaterThan(0)
  })
})

describe('with reduce motion on', () => {
  beforeEach(async () => {
    await commands.reduceMotion(true)
  })

  it('keeps a hot game’s indicator, standing still', () => {
    const still = hotIndicator()

    expect(still.getAnimations({ subtree: true })).toEqual([])
    expect(getComputedStyle(still).display).not.toBe('none')
  })

  it.each(pinAnimations)('fades a pin’s %s ring in and out in place, without changing its size', (animation) => {
    const keyframes = keyframesOf(pinRing(animation))

    expect(keyframes.filter((keyframe) => 'transform' in keyframe)).toEqual([])
    const opacities = keyframes.map((keyframe) => Number(keyframe.opacity))
    expect(opacities.at(0)).toBe(0)
    expect(Math.max(...opacities)).toBeGreaterThan(0)
    expect(opacities.at(-1)).toBe(0)
  })

  it('fades the loading screen’s rocket in and out in place, without moving', () => {
    const keyframes = keyframesOf(rocket())

    expect(keyframes.filter((keyframe) => 'transform' in keyframe)).toEqual([])
    const opacities = keyframes.map((keyframe) => Number(keyframe.opacity))
    expect(Math.min(...opacities)).toBeLessThan(Math.max(...opacities))
  })

  it('keeps the stars round the loading screen’s rocket, standing still', () => {
    const still = star()

    expect(still.getAnimations()).toEqual([])
    expect(getComputedStyle(still).display).not.toBe('none')
  })

  it('shows the loading screen’s message at once, its ellipsis’s dots steady', () => {
    const dots = messageDots()

    expect(messageWord().getAnimations()).toEqual([])
    expect(dots.getAnimations({ subtree: true })).toEqual([])
  })

  it('takes the loading screen away at once as it leaves, without fading', () => {
    const screen = leavingLoadingScreen()

    expect(screen.getAnimations()).toEqual([])
    expect(getComputedStyle(screen).opacity).toBe('0')
  })
})
