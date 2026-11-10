# PROTOTYPE: game panel variants (throwaway)

**Question:** how should the game panel be laid out to use space better, especially on a phone, where today's panel takes too much room?

Five variants of the game panel plus today's panel, on the existing app (no new route), switchable with `?variant=` and a pink floating bar at the bottom center (local runs only). This lives on the throwaway branch `phillipbritain/game-panel-prototype`, never in main: no tests, no polish, values written straight into `prototype.css`.

- Open the app as usual (`http://localhost:5173`), then add `?variant=A` (or `current`, `B`, `C`, `D`, `E`).
- Flip with the bar's ‹ and › buttons, or ← and → (Shift+← and → while the globe has focus, since it pans with the arrows). The URL keeps the variant across a reload.
- The bar reserves 40px at the bottom of the screen; every variant, today's included, sits above that, so ignore those 40px when judging height.

| Key | Name | Desktop | Phone |
| --- | --- | --- | --- |
| `current` | Today's panel | Bottom strip | Bottom sheet |
| `A` | Score bug | A one-line pill (league, abbreviations and scores, progress, More) at the bottom center; More opens a drawer above it | Two lines (~76px); More opens a drawer up to 55% of the screen |
| `B` | Side sheet / peek | A tall 340px column docked at the left, everything stacked and scrolling | A bottom sheet peeking at ~132px (handle, league, progress, two rows); tap the handle to pull it up to 78% |
| `C` | Ticker | A fixed 84px lower third: score bug at the left, everything else as chips that scroll sideways (the mouse wheel scrolls them) | ~110px: score bug on top, a swipeable chip row under it |
| `D` | Tabs | A fixed 168px card: score at the left, tabs (board, venue, watch) at the right | A fixed 200px sheet: score on top, tabs under it |
| `E` | Floating card | A small card in the bottom left corner; chips open the board, venue or watch above it | A small card at the top of the screen; chips drop the details under it, leaving the bottom of the screen to the globe |

The real panel's code (`../GamePanel.tsx`) is untouched; `App.tsx` mounts `PanelVariant` and the switcher in its place. Variants B (desktop) and E (phone) don't give the globe their box, because `panelClearance.ts` assumes a strip across the bottom: selecting a pin may leave it under the panel there.
