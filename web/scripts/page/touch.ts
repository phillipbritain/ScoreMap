/** How often a swipe moves its touch (ms): once a frame, as a finger on a phone is sampled. */
export const moveEvery = 16

/** How long a tap holds its touch down (ms), short of a long press. */
const tapHold = 50

/**
 * Where a swipe from `from` by `by` taking `ms` touches, and when (ms from the start): the same
 * distance every `moveEvery`, ending at `ms` on the end point, so the speed at letting go is the
 * swipe's own rather than a flick's.
 */
export function swipeMoves(from: [x: number, y: number], by: [dx: number, dy: number], ms: number): { x: number; y: number; at: number }[] {
  const count = Math.max(1, Math.round(ms / moveEvery))
  return Array.from({ length: count }, (_, i) => {
    const share = (i + 1) / count
    return { x: from[0] + by[0] * share, y: from[1] + by[1] * share, at: ms * share }
  })
}

/**
 * Touches a page as a finger does, through the Chrome DevTools Protocol (Input.dispatchTouchEvent)
 * at `pageUrl` (a page target's WebSocket URL), so the page has real touch input: touch and pointer
 * events with pointerType "touch", and a click after a tap.
 */
export async function touchPage(pageUrl: string) {
  const socket = new WebSocket(pageUrl)
  await new Promise<void>((resolve, reject) => {
    socket.onopen = () => resolve()
    socket.onerror = () => reject(new Error(`Couldn't reach the page through the DevTools Protocol at ${pageUrl}`))
  })
  let lastId = 0
  const pending = new Map<number, { resolve: () => void; reject: (error: Error) => void }>()
  socket.onmessage = (message) => {
    const { id, error } = JSON.parse(String(message.data)) as { id?: number; error?: { message: string } }
    const call = id === undefined ? undefined : pending.get(id)
    if (!call) return
    pending.delete(id!)
    if (error) call.reject(new Error(`The DevTools Protocol refused a touch: ${error.message}`))
    else call.resolve()
  }
  const send = (method: string, params: object) =>
    new Promise<void>((resolve, reject) => {
      const id = ++lastId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x?: number, y?: number) =>
    send('Input.dispatchTouchEvent', { type, touchPoints: x === undefined ? [] : [{ x, y, id: 0, radiusX: 4, radiusY: 4, force: 1 }] })
  const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)))

  return {
    async tap(x: number, y: number) {
      await touch('touchStart', x, y)
      await wait(tapHold)
      await touch('touchEnd')
    },
    /**
     * Each move goes at its time, without waiting for the browser to answer the one before (it answers
     * once it has handled it, often two frames later, which would make the swipe twice as slow as asked).
     * Lets go once every move is handled. Gives how long it took (ms).
     */
    async swipe(from: [number, number], by: [number, number], ms: number): Promise<number> {
      await touch('touchStart', ...from)
      const start = performance.now()
      const moves: Promise<void>[] = []
      for (const { x, y, at } of swipeMoves(from, by, ms)) {
        await wait(start + at - performance.now())
        moves.push(touch('touchMove', x, y))
      }
      await Promise.all(moves)
      await touch('touchEnd')
      return performance.now() - start
    },
    close: () => socket.close(),
  }
}
