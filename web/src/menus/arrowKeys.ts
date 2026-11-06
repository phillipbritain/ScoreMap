/**
 * Arrow keys in the app's menus and popovers (the Games list, Leagues, Display Settings, the scenario
 * pill's list): ↓ and ↑ move focus to the next and previous control that can be used, in page order,
 * stopping at the ends; Home and End to the first and last. Coming in from outside the controls (the
 * button that opened them), ↓ goes to the first and ↑ to the last.
 */

/** Where a key moves focus among this many controls, from the one at this place (-1 from outside them). */
export function arrowStep(key: string, at: number, count: number): number | undefined {
  if (count === 0) return undefined
  switch (key) {
    case 'ArrowDown':
      return at < 0 ? 0 : Math.min(at + 1, count - 1)
    case 'ArrowUp':
      return at < 0 ? count - 1 : Math.max(at - 1, 0)
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return undefined
  }
}

/** The controls in a menu that can be used: buttons and boxes, not disabled, nor in anything inert or hidden. */
function controls(menu: HTMLElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href]')].filter(
    (control) => !control.matches(':disabled') && !control.closest('[inert]') && control.checkVisibility(),
  )
}

type KeyEvent = Pick<KeyboardEvent, 'key' | 'target' | 'preventDefault' | 'defaultPrevented' | 'altKey' | 'ctrlKey' | 'metaKey'>

/**
 * Moves focus in a menu for an arrow key, Home or End pressed in it (or on the button that opened it);
 * other keys, and ones another handler has taken, pass by. In a text box, Home and End still move its
 * cursor.
 */
export function moveByArrows(event: KeyEvent, menu: HTMLElement): void {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target as HTMLElement
  if ((event.key === 'Home' || event.key === 'End') && target.matches('input, textarea')) return
  const all = controls(menu)
  const next = arrowStep(event.key, all.indexOf(target), all.length)
  if (next === undefined) return
  event.preventDefault()
  all[next].focus()
}

/** Focuses a menu's first control that can be used, if it has one. */
export function focusFirst(menu: HTMLElement): void {
  controls(menu)[0]?.focus()
}
