import { afterEach, describe, expect, it } from 'vitest'
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

describe('with reduce motion off', () => {
  it('blinks a Live score card’s status light', () => {
    const opacities = keyframesOf(liveLight()).map((keyframe) => keyframe.opacity)
    expect(opacities).toContain('0.3')
  })

  it.each(pinAnimations)('grows a pin’s %s ring', (animation) => {
    const transforms = keyframesOf(pinRing(animation)).map((keyframe) => keyframe.transform)
    expect(transforms.filter((transform) => transform !== undefined).length).toBeGreaterThan(1)
  })
})

describe('with reduce motion on', () => {
  it('keeps a Live score card’s status light fully lit, without blinking', async () => {
    await commands.reduceMotion(true)
    const light = liveLight()

    expect(light.getAnimations()).toEqual([])
    expect(getComputedStyle(light).opacity).toBe('1')
  })

  it.each(pinAnimations)('fades a pin’s %s ring in and out in place, without changing its size', async (animation) => {
    await commands.reduceMotion(true)
    const keyframes = keyframesOf(pinRing(animation))

    expect(keyframes.filter((keyframe) => 'transform' in keyframe)).toEqual([])
    const opacities = keyframes.map((keyframe) => Number(keyframe.opacity))
    expect(opacities.at(0)).toBe(0)
    expect(Math.max(...opacities)).toBeGreaterThan(0)
    expect(opacities.at(-1)).toBe(0)
  })
})
