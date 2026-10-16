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

const liveLight = () => element('score-card score-card--live', 'score-card__light')
const pinRing = (animation: string) => element(`pin-pulse pin-pulse--pin pin-pulse--${animation}`)
const pinAnimations = ['score', 'start', 'finish'] as const
const rocket = () => element('loading-screen', 'loading-screen__rocket-ship')
const leavingLoadingScreen = () => element('loading-screen loading-screen--leaving')

describe('with reduce motion off', () => {
  it('blinks a Live score card’s status light', () => {
    const opacities = keyframesOf(liveLight()).map((keyframe) => keyframe.opacity)
    expect(opacities).toContain('0.3')
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

  it('keeps a Live score card’s status light fully lit, without blinking', () => {
    const light = liveLight()

    expect(light.getAnimations()).toEqual([])
    expect(getComputedStyle(light).opacity).toBe('1')
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

  it('takes the loading screen away at once as it leaves, without fading', () => {
    const screen = leavingLoadingScreen()

    expect(screen.getAnimations()).toEqual([])
    expect(getComputedStyle(screen).opacity).toBe('0')
  })
})
