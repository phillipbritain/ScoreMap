# PROTOTYPE: game panel variants (throwaway)

**Question:** how should the game panel be laid out to use space better, especially on a phone, where today's panel takes too much room?

**Round 3** (this one): the user liked today's panel and round 2's Compact best, and wants the venue photo kept. So these variants keep that general layout (a strip at the bottom center, the slanted score block, everything showing, no tabs and no expanding or collapsing), with the content in different spots and sizes. Every variant shows the photo, on a phone too (today's panel hides it there). Earlier rounds are in this branch's history: round 1 (radically different variants) at `2718d7a`, round 2 (layout updates) at `d1bd48b`.

This lives on the throwaway branch `phillipbritain/game-panel-prototype`, never in main: no tests, no polish, values written straight into `prototype.css`.

- Open the app as usual (`http://localhost:5173`), then add `?variant=A` (or `current`, `compact`, `B`, `C`, `D`, `E`).
- Flip with the pink bar's ‹ and › buttons, or ← and → (Shift+← and → while the globe has focus, since it pans with the arrows). The URL keeps the variant across a reload.
- The bar reserves 40px at the bottom of the screen; every variant, today's included, sits above that, so ignore those 40px when judging height.

| Key | Name | Where things go |
| --- | --- | --- |
| `current` | Today's panel | |
| `compact` | Compact (round 2) | Today's layout, smaller. Round 3 adds the photo on a phone, as a short banner across the top. |
| `A` | Photo first | The photo moves to the left edge, fading into the score; sport, venue and watch after the score; the band under the strip. On a phone the photo is a banner across the top with the league and progress over its foot. |
| `B` | Band inside | The band moves up into the details column, under one slim line of sport, venue and watch, so there's no band row; the photo stays at the right. On a phone the photo is a thumbnail beside the venue and watch lines. |
| `C` | Big score | The score block takes about half the strip, with bigger logos, names and scores; sport, venue and watch stack in a narrow column; the photo is larger at the right; the band is small type underneath. On a phone the photo sits behind the score block. |
| `D` | Venue card | The photo becomes the venue's card, with the venue's name and place over its foot and the sport over its top; the band moves up beside the score, with the watch links under it. No band row. On a phone the card goes across the width between the score and the details. |
| `E` | Photo backdrop | Compact's layout, with the photo filling the panel behind the details and band (darkened toward the score) instead of a column of its own. On a phone it fills behind everything under the score. |

Heights measured in a browser on `edge-cases` (desktop 1280×800 / phone 390×844, in pixels). The Faroe Islands game's venue has no photo, so it shows the faint glow today's panel shows in its place.

| Game | Today | Compact | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- | --- | --- |
| NASCAR (Coliseum) | 240 / 347 | 143 / 288 | 149 / 291 | 115 / 255 | 170 / 251 | 116 / 312 | 149 / 258 |
| UFC (Madison Square Garden) | 241 / 417 | 157 / 337 | 163 / 324 | 115 / 303 | 183 / 300 | 125 / 360 | 163 / 291 |
| Long names (Chicago) | 240 / 337 | 154 / 293 | 171 / 278 | 141 / 257 | 166 / 252 | 141 / 314 | 171 / 245 |
| No photo (Faroe Islands) | | 139 / 249 | 145 / 236 | 115 / 215 | 166 / 212 | 116 / 272 | 145 / 203 |

The real panel's code (`../GamePanel.tsx`) is untouched; `App.tsx` mounts `PanelVariant` and the switcher in its place.
