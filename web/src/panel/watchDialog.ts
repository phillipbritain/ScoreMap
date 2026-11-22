import type { MouseEvent } from 'react'

// The dialog is positioned in the browser's top layer, so it uses viewport coordinates.
export function anchorWatchDialog(dialog: HTMLDialogElement) {
  const panel = dialog.closest('.event-panel')
  if (!panel) return

  const update = () => {
    const { left, width, top, height } = panel.getBoundingClientRect()
    const box = dialog.getBoundingClientRect()
    // Keep the centered dialog on screen if its edges reach past the viewport.
    const x = Math.max(0, Math.min(left + (width - box.width) / 2, window.innerWidth - box.width))
    const y = Math.max(0, Math.min(top + (height - box.height) / 2, window.innerHeight - box.height))
    dialog.style.setProperty('--watch-dialog-left', `${x}px`)
    dialog.style.setProperty('--watch-dialog-top', `${y}px`)
  }
  update()
  const observer = new ResizeObserver(update)
  observer.observe(panel)
  observer.observe(dialog)
  window.addEventListener('resize', update)
  panel.addEventListener('animationend', update)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', update)
    panel.removeEventListener('animationend', update)
  }
}

// A dialog receives presses on its backdrop as well as in its own padding.
export function isWatchBackdrop(event: MouseEvent<HTMLDialogElement>) {
  const { target, currentTarget, clientX, clientY } = event
  if (target !== currentTarget) return false
  const { left, right, top, bottom } = currentTarget.getBoundingClientRect()
  return clientX < left || clientX >= right || clientY < top || clientY >= bottom
}
