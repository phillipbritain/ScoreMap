// PROTOTYPE, throw away: the floating bar switching the game panel's close button and top edge (see panelLookPrototype.ts).
import { useEffect, useState } from 'react'
import { lookVariant, onLookPrototypeChange, stepLookVariant, type LookAxis } from './panelLookPrototype'

export function PanelLookPrototypeBar() {
  const [, redraw] = useState(0)
  useEffect(() => onLookPrototypeChange(() => redraw((n) => n + 1)), [])
  // [ and ] cycle the close button, { and } (with Shift) the top edge: the arrow keys pan the globe.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable]')) return
      if (event.key === '[') stepLookVariant('close', -1)
      else if (event.key === ']') stepLookVariant('close', 1)
      else if (event.key === '{') stepLookVariant('edge', -1)
      else if (event.key === '}') stepLookVariant('edge', 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const group = (axis: LookAxis, title: string, keys: string) => {
    const variant = lookVariant(axis)
    return (
      <span className="look-prototype__group">
        <span className="look-prototype__axis">{title}</span>
        <button type="button" title={`Previous (${keys[0]})`} onClick={() => stepLookVariant(axis, -1)}>←</button>
        <span className="look-prototype__label">
          <strong>{variant.key}</strong>
          <span className="look-prototype__name">: {variant.name}</span>
        </span>
        <button type="button" title={`Next (${keys[1]})`} onClick={() => stepLookVariant(axis, 1)}>→</button>
      </span>
    )
  }
  return (
    <div className="look-prototype" data-keeps-popovers>
      {group('close', 'Close', '[]')}
      {group('edge', 'Edge', '{}')}
    </div>
  )
}
