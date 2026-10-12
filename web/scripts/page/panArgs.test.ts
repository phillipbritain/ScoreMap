import { describe, expect, it } from 'vitest'
import { panArgs } from './panArgs.ts'
import { defaultPan } from './panGlobe.ts'

describe('panArgs', () => {
  it('pans the default way when given only the file', () => {
    expect(panArgs(['trace.json'])).toEqual({ file: 'trace.json', pan: defaultPan })
  })

  it('takes the camera, and each step of the pan in order, in place of the defaults', () => {
    expect(panArgs(['trace.json', '--center', '8,51.5', '--zoom', '5', '--by', '-4,0,250', '--by', '0,-4,80'])).toEqual({
      file: 'trace.json',
      pan: {
        camera: { center: [8, 51.5], zoom: 5 },
        pan: [
          { by: [-4, 0], frames: 250 },
          { by: [0, -4], frames: 80 },
        ],
      },
    })
  })

  it('keeps the default zoom when given only the centre, and the default pan when given only the camera', () => {
    expect(panArgs(['trace.json', '--center', '8,51.5'])).toEqual({
      file: 'trace.json',
      pan: { camera: { center: [8, 51.5], zoom: defaultPan.camera.zoom }, pan: defaultPan.pan },
    })
  })

  it.each([
    [[]],
    [['trace.json', 'extra.json']],
    [['trace.json', '--center', '8']],
    [['trace.json', '--zoom', 'far']],
    [['trace.json', '--by', '-4,0']],
    [['trace.json', '--by', '-4,0,0']],
    [['trace.json', '--by']],
    [['trace.json', '--tilt', '30']],
  ])('gives nothing for %j, to say how it’s used', (args) => {
    expect(panArgs(args)).toBeNull()
  })
})
