// PROTOTYPE (throwaway, not for main): the floating bar at the bottom of the page that flips the
// Leagues popover between its prototype looks (`?pickerProto=`). Left out of a build.
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { pickerProtoVariants, setPickerProto, usePickerProto } from './pickerProto'

export function PickerPrototypeBar() {
  const current = usePickerProto()
  const index = pickerProtoVariants.findIndex((variant) => variant.key === current)
  const step = (by: number) =>
    setPickerProto(pickerProtoVariants[(index + by + pickerProtoVariants.length) % pickerProtoVariants.length].key)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      // Only when nothing else wants the arrows: not a text box, the globe or a popover's own arrow keys.
      const target = event.target as Element | null
      const free = !target || target === document.body || !!target.closest('.picker-proto-bar')
      if (!free) return
      event.preventDefault()
      step(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!import.meta.env.DEV) return null
  const variant = pickerProtoVariants[index]
  return createPortal(
    // data-keeps-popovers: pressing the bar leaves the Leagues popover open, to compare looks in place.
    <div className="picker-proto-bar" data-keeps-popovers>
      <button type="button" aria-label="Previous picker look" onClick={() => step(-1)}>
        ←
      </button>
      <span className="picker-proto-bar__label">
        <span className="picker-proto-bar__long">Leagues picker prototype · </span>
        {index + 1}/{pickerProtoVariants.length} <b>{variant.key}</b>
        <span className="picker-proto-bar__long"> ({variant.name})</span>
      </span>
      <button type="button" aria-label="Next picker look" onClick={() => step(1)}>
        →
      </button>
    </div>,
    document.body,
  )
}
