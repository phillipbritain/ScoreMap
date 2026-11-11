# PROTOTYPE: game panel variants (throwaway)

**Question:** how should the game panel be laid out to use space better, especially on a phone, where today's panel takes too much room?

**Round 4** (this one): the user wants a combination of today's panel and round 3's Photo backdrop, with no Sport field, and an option with the last score in the panel's main strip rather than in a band under it. These variants are today's panel at today's sizes, with the venue photo filling the panel behind the venue, watch and band (in place of today's photo column, and on a phone too), and no Sport. They differ only in where the last score goes. Earlier rounds are in this branch's history: round 1 (radically different variants) at `2718d7a`, round 2 (layout updates) at `d1bd48b`, round 3 (content moved within today's layout) at `8087649`.

This lives on the throwaway branch `phillipbritain/game-panel-prototype`, never in main: no tests, no polish, values written straight into `prototype.css`.

- Open the app as usual (`http://localhost:5173`), then add `?variant=A` (or `current`, `backdrop`, `B`, `C`, `D`, `E`, `F`, `G`, `H`, `I`).
- Flip with the pink bar's ‹ and › buttons, or ← and → (Shift+← and → while the globe has focus, since it pans with the arrows). The URL keeps the variant across a reload.
- The bar reserves 40px at the bottom of the screen; every variant, today's included, sits above that, so ignore those 40px when judging height.

| Key | Name | Where the last score goes |
| --- | --- | --- |
| `current` | Today's panel (unchanged, Sport and all) | In the band under the strip |
| `backdrop` | Photo backdrop (round 3, now without Sport) | In the band under the strip |
| `A` | Today + backdrop | In the band under the strip, as today |
| `B` | Last score beside venue | A third column beside Venue and Watch, in the strip. A leaderboard, fight card or tennis sets go there too, so there's no band at all. On a phone it runs across the width under Venue and Watch. |
| `C` | Last score in score block | In the score block, under the teams and progress line, as a quiet line. A leaderboard, fight card or sets stay in the band under the strip. |
| `D` | A, no Venue label (round 5) | As A; the venue's name and place show without the "Venue" label over them. |
| `E` | D, photo under the score too (round 5) | As D, with the photo behind the whole panel: the score block has no solid color, only a dark wash so the names and scores stay readable. |
| `F` | D, Watch under the venue (round 6) | As D, with Watch (its label and links) under the venue's name and place in one column, rather than beside them. Same height as D on a desktop; on a phone about 40px taller, as the two stack. |
| `G` | F, photo behind the whole panel (round 7) | As F, with the photo behind the whole panel, the score block too, as E: the score block has no solid color, only a dark wash. |
| `H` | G, venue and watch in the corners (round 8) | As G, with no block, wash or slant behind the score section: the league, names and scores sit on the photo alone, with a soft shadow on the text (each score keeps its own small box). The venue's name and place sit in the top right corner, beside the close button; the watch links, on one line, sit in the bottom right corner. On a phone the venue is at the top right across from the league, and watch at the bottom right under the details. Basketball game: 203 / 281 (G: 212 / 352). |
| `I` | C, labeled last score, watch in the photo corner (round 9) | As C (the last score in the score block), with the "Last score" label over it, no "Venue" label, and the watch links on one line in the bottom left corner of the photo's part of the strip, under the venue. A leaderboard, fight card or sets still run in the band under the strip. Basketball game: 205 / 308 (C: 186 / 282). |

Heights measured in a browser (desktop 1280×800 / phone 390×844, in pixels; the soccer game is `worldwide`'s, the rest `edge-cases`'). The Faroe Islands venue has no photo, so it shows the faint glow today's panel shows in its place.

| Game | Today | backdrop | A | B | C |
| --- | --- | --- | --- | --- | --- |
| NASCAR (Coliseum) | 240 / 347 | 149 / 258 | 216 / 339 | 163 / 330 | 216 / 339 |
| UFC (Madison Square Garden) | 241 / 417 | 163 / 291 | 233 / 398 | 181 / 389 | 233 / 398 |
| Basketball, long names (Chicago) | 240 / 337 | 171 / 245 | 212 / 306 | 163 / 297 | 186 / 277 |
| No photo (Faroe Islands) | 240 / 326 | 145 / 203 | 212 / 276 | 163 / 267 | 186 / 251 |
| Soccer (Chelsea v Arsenal) | | | | 163 / 267 | 186 / 251 |

**Round 5** added D and E, and made-up watch links. Scenario games list no channels, so every panel, today's included, gets four made-up channels and one made-up unofficial stream for any game that lists none (`withDummyWatchLinks` in `PanelVariants.tsx`; DUMMY DATA, not real listings). With more than three, the first three show and the rest fold into "+2 more", as on today's panel; "Fox Sports 1" has no web address, so it shows as a plain name. Variants A–E list the links one per line, as today's panel does. That puts them about 40px taller on a phone than the heights above, which were measured with "No channels listed": the basketball game measured 348px on a phone for D and E, against 364px for today's panel.

**Round 6** added F, and cut the made-up watch links to two (ESPN and Peacock, both linked), so no panel shows "+N more" now. With two links, D measured 212 / 310 and F 212 / 352 for the basketball game (desktop / phone), against 240 / 337 for today's panel.

The real panel's code (`../GamePanel.tsx`) is untouched; `App.tsx` mounts `PanelVariant` and the switcher in its place.
