// PROTOTYPE, throw away: the floating bar for flipping between card reach variants (see cardReach.prototype).
import { useEffect, useState } from 'react'
import { currentReachVariant, reachStats, reachVariants } from './cardReach.prototype'

function go(by: number) {
  const index = reachVariants.indexOf(currentReachVariant())
  const next = reachVariants[(index + by + reachVariants.length) % reachVariants.length]
  const url = new URL(window.location.href)
  url.searchParams.set('variant', next.key)
  // A reload lays every card out afresh; the camera comes back from localStorage.
  window.location.replace(url)
}

export function CardReachSwitcher() {
  const variant = currentReachVariant()
  const [stats, setStats] = useState({ ...reachStats })
  useEffect(() => {
    const timer = setInterval(() => setStats({ ...reachStats }), 250)
    // [ and ] cycle: the arrow keys pan the map.
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') go(-1)
      if (event.key === ']') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
  if (import.meta.env.PROD) return null
  return (
    <div className="reach-switcher">
      <button type="button" onClick={() => go(-1)} aria-label="Previous variant">
        ◀
      </button>
      <div>
        <strong>{variant.name}</strong>
        <small>
          reach {stats.reach}px · {stats.cards} cards · {stats.clustered} clustered in {stats.clusters} · longest trail{' '}
          {stats.longestTrail}px
        </small>
      </div>
      <button type="button" onClick={() => go(1)} aria-label="Next variant">
        ▶
      </button>
    </div>
  )
}
