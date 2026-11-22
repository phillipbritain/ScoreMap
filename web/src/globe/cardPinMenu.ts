import type { PinnedCards } from '../games/pinnedCards'

/** Right-click, long-press, and keyboard access to the pin action for this globe's score cards. */
export function cardPinMenu(container: HTMLElement, pins: PinnedCards): () => void {
  const menu = document.createElement('div')
  menu.className = 'card-pin-menu'
  menu.hidden = true
  const action = document.createElement('button')
  action.className = 'card-pin-menu__action'
  action.type = 'button'
  menu.append(action)
  document.body.append(menu)
  const controller = new AbortController()
  const capture = { capture: true, signal: controller.signal }
  let origin: HTMLElement | undefined
  let menuFrame = 0
  let hold: { card: HTMLElement; id: number; x: number; y: number; timer: number } | undefined
  const cardAt = (event: Event) => {
    const card = event.target instanceof Element ? event.target.closest<HTMLElement>('.score-card[data-pinnable]') : null
    return card && container.contains(card) && !card.closest('[inert]') ? card : null
  }
  const cancelHold = () => {
    if (!hold) return
    window.clearTimeout(hold.timer)
    if (hold.card !== origin) hold.card.removeAttribute('data-pin-press')
    hold = undefined
  }
  const close = (restoreFocus = false) => {
    const hadFocus = menu.contains(document.activeElement)
    cancelAnimationFrame(menuFrame)
    menu.hidden = true
    if (restoreFocus && hadFocus) origin?.focus({ preventScroll: true })
    origin?.removeAttribute('data-pin-press')
    origin = undefined
  }
  const placeAbove = (card: HTMLElement) => {
    const box = card.getBoundingClientRect()
    const left = box.left + (box.width - menu.offsetWidth) / 2
    const top = box.top - menu.offsetHeight - 4
    menu.style.left = `${Math.max(4, Math.min(left, innerWidth - menu.offsetWidth - 4))}px`
    menu.style.top = `${Math.max(4, top)}px`
  }
  const followCard = () => {
    if (!origin?.checkVisibility({ visibilityProperty: true }) || origin.closest('[inert]')) {
      close()
      return
    }
    placeAbove(origin)
    menuFrame = requestAnimationFrame(followCard)
  }
  const open = (card: HTMLElement, fromKeyboard = false) => {
    if (origin && origin !== card) close()
    origin = card
    action.textContent = pins.games().includes(card.dataset.gameId!) ? 'Unpin Card' : 'Pin Card'
    menu.toggleAttribute('data-keyboard', fromKeyboard)
    menu.hidden = false
    cancelAnimationFrame(menuFrame)
    followCard()
    if (fromKeyboard) action.focus({ preventScroll: true })
  }
  const completeHold = () => {
    if (!hold) return
    const { card } = hold
    if (card.isConnected) open(card)
    cancelHold()
  }
  action.addEventListener('click', () => {
    const gameId = origin?.dataset.gameId
    close(true)
    if (gameId) pins.toggle(gameId)
  })
  document.addEventListener('contextmenu', event => {
    const card = cardAt(event)
    if (!card) return
    event.preventDefault()
    event.stopPropagation()
    if (hold?.card === card) {
      completeHold()
    } else {
      cancelHold()
      open(card)
    }
  }, capture)
  document.addEventListener('pointerdown', event => {
    if (event.target instanceof Node && !menu.contains(event.target)) close()
    const card = cardAt(event)
    if (!card || event.pointerType !== 'touch' || !event.isPrimary) return
    cancelHold()
    card.setAttribute('data-pin-press', '')
    const { pointerId, clientX, clientY } = event
    hold = { card, id: pointerId, x: clientX, y: clientY, timer: window.setTimeout(completeHold, 500) }
  }, capture)
  document.addEventListener('pointermove', event => {
    if (hold?.id === event.pointerId && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10) cancelHold()
  }, capture)
  const endHold = (event: PointerEvent) => {
    if (hold?.id === event.pointerId) cancelHold()
  }
  document.addEventListener('pointerup', endHold, capture)
  document.addEventListener('pointercancel', endHold, capture)
  document.addEventListener('wheel', () => close(), { ...capture, passive: true })
  document.addEventListener('click', event => {
    if (!menu.hidden && cardAt(event) === origin) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, capture)
  document.addEventListener('keydown', event => {
    if (!menu.hidden && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
    const card = cardAt(event)
    if (!card || !(event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) return
    event.preventDefault()
    open(card, true)
  }, capture)
  return () => {
    controller.abort()
    cancelHold()
    close()
    menu.remove()
  }
}
