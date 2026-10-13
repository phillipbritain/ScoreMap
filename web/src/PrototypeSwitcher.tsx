// PROTOTYPE, throwaway: flips between the card radius variants (see globe/cardRadius.prototype). Not for main.
import { useEffect, useState } from 'react'
import { currentVariant, onVariantChange, setVariant, variants } from './globe/cardRadius.prototype'

export function PrototypeSwitcher() {
  const [variant, setShown] = useState(currentVariant)
  useEffect(() => onVariantChange(() => setShown(currentVariant())), [])

  const step = (by: number) => {
    const at = variants.findIndex((each) => each.key === currentVariant().key)
    setVariant(variants[(at + by + variants.length) % variants.length].key)
  }

  // [ and ]: the arrow keys turn the globe.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') step(-1)
      if (event.key === ']') step(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!import.meta.env.DEV) return null
  const button = { background: 'none', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: '0 8px' }
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: '#fff',
        color: '#000',
        borderRadius: 999,
        padding: '6px 10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
        font: '600 14px system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      <button style={button} onClick={() => step(-1)} title="Previous ([)">
        ◀
      </button>
      <span>
        PROTOTYPE card radius: {variant.key} ({variant.name})
      </span>
      <button style={button} onClick={() => step(1)} title="Next (])">
        ▶
      </button>
    </div>
  )
}
