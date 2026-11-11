# PROTOTYPE: game panel variants (throwaway)

**Question:** how should the game panel be laid out to use space better, especially on a phone, where today's panel takes too much room?

**Round 4** (this one): the user wants a combination of today's panel and round 3's Photo backdrop, with no Sport field, and an option with the last score in the panel's main strip rather than in a band under it. These variants are today's panel at today's sizes, with the venue photo filling the panel behind the venue, watch and band (in place of today's photo column, and on a phone too), and no Sport. They differ only in where the last score goes. Earlier rounds are in this branch's history: round 1 (radically different variants) at `2718d7a`, round 2 (layout updates) at `d1bd48b`, round 3 (content moved within today's layout) at `8087649`.

This lives on the throwaway branch `phillipbritain/game-panel-prototype`, never in main: no tests, no polish, values written straight into `prototype.css`.

- Open the app as usual (`http://localhost:5173`), then add `?variant=A` (or `current`, `backdrop`, `B`, `C`).
- Flip with the pink bar's ‹ and › buttons, or ← and → (Shift+← and → while the globe has focus, since it pans with the arrows). The URL keeps the variant across a reload.
- The bar reserves 40px at the bottom of the screen; every variant, today's included, sits above that, so ignore those 40px when judging height.

| Key | Name | Where the last score goes |
| --- | --- | --- |
| `current` | Today's panel (unchanged, Sport and all) | In the band under the strip |
| `backdrop` | Photo backdrop (round 3, now without Sport) | In the band under the strip |
| `A` | Today + backdrop | In the band under the strip, as today |
| `B` | Last score beside venue | A third column beside Venue and Watch, in the strip. A leaderboard, fight card or tennis sets go there too, so there's no band at all. On a phone it runs across the width under Venue and Watch. |
| `C` | Last score in score block | In the score block, under the teams and progress line, as a quiet line. A leaderboard, fight card or sets stay in the band under the strip. |

Heights measured in a browser (desktop 1280×800 / phone 390×844, in pixels; the soccer game is `worldwide`'s, the rest `edge-cases`'). The Faroe Islands venue has no photo, so it shows the faint glow today's panel shows in its place.

| Game | Today | backdrop | A | B | C |
| --- | --- | --- | --- | --- | --- |
| NASCAR (Coliseum) | 240 / 347 | 149 / 258 | 216 / 339 | 163 / 330 | 216 / 339 |
| UFC (Madison Square Garden) | 241 / 417 | 163 / 291 | 233 / 398 | 181 / 389 | 233 / 398 |
| Basketball, long names (Chicago) | 240 / 337 | 171 / 245 | 212 / 306 | 163 / 297 | 186 / 277 |
| No photo (Faroe Islands) | 240 / 326 | 145 / 203 | 212 / 276 | 163 / 267 | 186 / 251 |
| Soccer (Chelsea v Arsenal) | | | | 163 / 267 | 186 / 251 |

The real panel's code (`../GamePanel.tsx`) is untouched; `App.tsx` mounts `PanelVariant` and the switcher in its place.
