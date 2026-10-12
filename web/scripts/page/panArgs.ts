import { defaultPan, type Pan } from './panGlobe.ts'

/**
 * Reads `npm run page -- pan`'s arguments: `<file> [--center <longitude>,<latitude>] [--zoom <zoom>]
 * [--by <x>,<y>,<frames>]...`, each left out keeping the default's. Gives null when they don't read.
 */
export function panArgs(args: string[]): { file: string; pan: Pan } | null {
  const [file, ...options] = args
  if (!file || file.startsWith('--')) return null
  let { center, zoom } = defaultPan.camera
  const steps: Pan['pan'] = []
  for (let i = 0; i < options.length; i += 2) {
    const numbers = (options[i + 1] ?? '').split(',').map(Number)
    if (numbers.some(Number.isNaN)) return null
    if (options[i] === '--center' && numbers.length === 2) center = [numbers[0], numbers[1]]
    else if (options[i] === '--zoom' && numbers.length === 1 && options[i + 1]) zoom = numbers[0]
    else if (options[i] === '--by' && numbers.length === 3 && Number.isInteger(numbers[2]) && numbers[2] > 0)
      steps.push({ by: [numbers[0], numbers[1]], frames: numbers[2] })
    else return null
  }
  return { file, pan: { camera: { center, zoom }, pan: steps.length ? steps : defaultPan.pan } }
}
