/** Where a touch lands: the middle of what a selector picks, or a point in the viewport (CSS px). */
export type TouchAt = { selector: string } | { x: number; y: number }

/** A touch `npm run page` makes: a tap, or a swipe by (dx, dy) px taking `ms` at a steady speed. */
export type Touch = { kind: 'tap'; at: TouchAt } | { kind: 'swipe'; at: TouchAt; by: [dx: number, dy: number]; ms: number }

/** How long a swipe takes when not given (ms): a slow drag, well under the panel's flick speed for a short one. */
export const defaultSwipeMs = 500

/**
 * Reads `npm run page -- tap <selector|x y>` and `swipe <selector|x y> <dx> <dy> [ms]`: two numbers
 * first are a point, anything else a selector. Gives null when they don't read.
 */
export function touchArgs(command: string, args: string[]): Touch | null {
  const number = (arg: string | undefined) => (arg !== undefined && arg.trim() !== '' && Number.isFinite(Number(arg)) ? Number(arg) : null)
  const [x, y] = [number(args[0]), number(args[1])]
  const point = x !== null && y !== null
  if (!args[0]) return null
  const at: TouchAt = point ? { x, y } : { selector: args[0] }
  const rest = args.slice(point ? 2 : 1)
  if (command === 'tap') return rest.length === 0 ? { kind: 'tap', at } : null
  if (command !== 'swipe' || rest.length < 2 || rest.length > 3) return null
  const [dx, dy, ms] = [number(rest[0]), number(rest[1]), rest.length === 3 ? number(rest[2]) : defaultSwipeMs]
  if (dx === null || dy === null || ms === null || ms <= 0) return null
  return { kind: 'swipe', at, by: [dx, dy], ms }
}
