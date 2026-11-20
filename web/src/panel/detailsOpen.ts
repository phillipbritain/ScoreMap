/**
 * Whether the game panel's details (its tabs' panes) are open: the last panel's choice, so the next game
 * panel opened, or another game picked into it, opens its details the same way. Kept for the page's life.
 */
let open = false

export const detailsOpen = () => open

export function rememberDetailsOpen(value: boolean) {
  open = value
}
