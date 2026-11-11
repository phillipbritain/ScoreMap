# PROTOTYPE: game panel variants (throwaway)

**Question:** how should the game panel be laid out to use space better, especially on a phone, where today's panel takes too much room?

**Round 2** (this one): the user liked today's panel best (a strip at the bottom center, everything showing, no tabs and no expanding or collapsing), so these five variants are layout updates of it: the same content, moved around and resized. Round 1's radically different variants (score bug, side sheet, ticker, tabs, floating card) are in this branch's history at commit `2718d7a`.

This lives on the throwaway branch `phillipbritain/game-panel-prototype`, never in main: no tests, no polish, values written straight into `prototype.css`.

- Open the app as usual (`http://localhost:5173`), then add `?variant=A` (or `current`, `B`, `C`, `D`, `E`).
- Flip with the pink bar's ‹ and › buttons, or ← and → (Shift+← and → while the globe has focus, since it pans with the arrows). The URL keeps the variant across a reload.
- The bar reserves 40px at the bottom of the screen; every variant, today's included, sits above that, so ignore those 40px when judging height.

| Key | Name | What moves or changes from today's panel |
| --- | --- | --- |
| `current` | Today's panel | |
| `A` | One row | The band (leaderboard, fight card, sets, last score) moves up beside the score block, and venue and watch become a narrow column at the right: one short row. No photo. On a phone: score, details, then venue and watch side by side. |
| `B` | Compact | Today's layout as it is, shrunk: smaller logos, scores, type and padding, a narrower photo. On a phone, venue and watch fold into a line each under the score. |
| `C` | Narrow card | A 720px card, stacked: league and progress, the score, the details, then one footer line for sport, venue (with the photo as a thumbnail) and watch. The sides of the globe stay clear on a desktop. |
| `D` | Head to head | The two sides face each other across one centered scoreboard row (name, logo, score – score, logo, name), progress under the scores; under it, the details and venue and watch side by side. A field keeps its two rows. On a phone, names wrap under their logos. |
| `E` | Info ribbon | Sport, venue and watch become one thin ribbon across the top with the league and progress, the photo fades in behind the right of the panel, and under it the score block and details sit side by side. |

Heights measured in a browser on `edge-cases` (desktop 1280×800 / phone 390×844, in pixels):

| Game | Today | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- | --- |
| NASCAR (Coliseum) | 240 / 347 | 130 / 268 | 143 / 224 | 219 / 244 | 199 / 282 | 116 / 241 |
| UFC (Madison Square Garden) | 241 / 417 | 116 / 326 | 157 / 273 | 236 / 306 | 186 / 348 | 131 / 318 |
| Long names (Chicago) | 240 / 337 | 131 / 249 | 154 / 229 | 195 / 234 | 161 / 300 | 147 / 246 |
| Missing logos (Edmonton) | 240 / 326 | 112 / 223 | 139 / 185 | 195 / 203 | 161 / 264 | 116 / 215 |

The real panel's code (`../GamePanel.tsx`) is untouched; `App.tsx` mounts `PanelVariant` and the switcher in its place.
