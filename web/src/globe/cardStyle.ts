/** The looks a viewer can pick for score cards, in the order the picker lists them. HUD is the default. */
export const cardStyles = [
  { key: 'hud', name: 'HUD' },
  { key: 'led', name: 'LED scoreboard' },
  { key: 'broadcast', name: 'Broadcast bug' },
  { key: 'tactical', name: 'Tactical' },
  { key: 'neon', name: 'Neon sign' },
] as const

export type CardStyle = (typeof cardStyles)[number]['key']

export const defaultCardStyle: CardStyle = 'hud'

export function isCardStyle(value: unknown): value is CardStyle {
  return cardStyles.some((style) => style.key === value)
}
