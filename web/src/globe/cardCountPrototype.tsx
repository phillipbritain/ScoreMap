// PROTOTYPE, throw away: the card count slider's bar (see cardCountPrototypeState).
import { useEffect, useState } from 'react'
import { chooseCardCount, chosenCardCount } from './cardCountPrototypeState'

export function CardCountPrototypeBar({ defaultCount }: { defaultCount: (width: number) => number }) {
  const [width, setWidth] = useState(window.innerWidth)
  const [count, setCount] = useState<number | null>(chosenCardCount)
  useEffect(() => {
    const resized = () => setWidth(window.innerWidth)
    window.addEventListener('resize', resized)
    return () => window.removeEventListener('resize', resized)
  }, [])
  const set = (next: number | null) => {
    chooseCardCount(next)
    setCount(next)
  }
  const phone = width <= 640
  const today = defaultCount(width)
  const shown = count ?? today
  return (
    <div
      style={{
        position: 'fixed', top: 8, ...(phone ? { left: 52 } : { left: '50%', transform: 'translateX(-50%)' }), zIndex: 10000,
        display: 'flex', alignItems: 'center', gap: phone ? 6 : 8, padding: phone ? '4px 8px' : '6px 10px', borderRadius: 8,
        background: 'rgba(0,0,0,0.85)', color: '#fff', font: '13px system-ui', whiteSpace: 'nowrap',
      }}
    >
      {!phone && <span>Proto cards</span>}
      <input type="range" min={1} max={60} value={shown} onChange={(e) => set(Number(e.target.value))} style={{ width: phone ? 120 : 160 }} />
      <strong style={{ minWidth: 22, textAlign: 'right' }}>{shown}</strong>
      <span style={{ opacity: 0.7 }}>
        {phone ? 'phone' : 'wide'}, now {today}
      </span>
      <button type="button" onClick={() => set(null)} disabled={count === null}>
        ↺
      </button>
    </div>
  )
}
