/** A stable keyboard destination when a game control disappears or joins a cluster. */
export function focusGameNavigation(fallback?: HTMLElement): void {
  const control = document.querySelector<HTMLElement>('[data-game-navigation]')
  if (control && !control.closest('[inert]') && control.checkVisibility({ visibilityProperty: true })) control.focus({ preventScroll: true })
  else fallback?.focus({ preventScroll: true })
}
