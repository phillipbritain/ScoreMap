# Style guide

How ScoreMap's look is made, so a theme can be made or changed without reading the code. It describes the theme as built: the settings in [`web/src/theme/theme.ts`](../web/src/theme/theme.ts) and the built-in dark theme, [`web/src/theme/builtInTheme.json`](../web/src/theme/builtInTheme.json). When they and this guide disagree, the code is right and this guide is stale.

The decisions behind it: [ADR-0011](adr/0011-themes-as-checked-json-with-a-palette.md) (themes as checked JSON with a palette worked out in OKLCH), [ADR-0012](adr/0012-colour-for-league-status-by-glow.md) (colour will stand for league; status shows by brightness and glow) and [ADR-0006](adr/0006-map-fonts-from-openmaptiles.md) (the globe's fonts come from fonts.openmaptiles.org). The words **theme**, **palette**, **colour job** and **scale** are the glossary's ([`GLOSSARY.md`](../GLOSSARY.md)).

## What a theme is

A **theme** is the whole of how ScoreMap looks, the globe included: one JSON file, checked when it's loaded. ScoreMap has one, the dark theme, built into the app and resolved as it starts, so the first paint is themed with no wait on the network. Loading other themes, a theme setting and a theme picker are later work.

A theme has two layers:

```json
{
  "palette": { "navy": { "base": "#2b4d7d" }, "...": {} },
  "settings": { "globe": { "surface": "navy.500", "...": {} }, "...": {} }
}
```

- The **palette** names a few base colours. Each is worked out into steps from light to dark (see [The palette](#the-palette)).
- The **settings** use it: every colour job, font, scale, corner, size, glow and fade in the app. A colour job names a palette step, such as `navy.700`, so changing a base colour changes every job that uses it.

Every setting is required, and nothing else is allowed: a theme missing a setting, or with one it doesn't know, is rejected (see [What checking rejects](#what-checking-rejects)).

### Where the theme reaches

The code reads only the resolved theme, never the JSON:

- **The page** (the game panel, score cards, the settings menu, the scenario controls): the resolved theme is written to the page's root as CSS custom properties, one per setting, named by where it sits in the settings in kebab case. `text.main` is `--text-main`, `status.live.color` is `--status-live-color`, `spacing.l` is `--spacing-l`, `panel.surface.top` is `--panel-surface-top`. Sizes are written in pixels (`12px`), or in ems where they go with their text (`0.14em`), on or off as `1` or `0`, and a shadow as one CSS shadow (`0px 8px 30px #000e28`). A globe font is written as its `-name`, `-family`, `-weight` and `-style`. The page's CSS (`web/src/index.css`) names no colour, font, text size, spacing, radius, size in pixels or ems, or opacity of its own, outside its animations (an opacity of 1 or 0 only shows or hides a thing), and a test (`indexCss.test.ts`) fails if it does. The web app's TypeScript and the globe's map layers have tests of their own (see [What stays in code](#what-stays-in-code)).
- **The globe**: its map style (surface, coastlines and borders), place names, the halo, pins, clusters, trails, the selected pin's ring and pulses read the resolved theme directly, since MapLibre needs the values themselves, not CSS custom properties. Widths and text sizes that change with zoom, the disputed borders' dash pattern and the halo's sizes are read only by the globe and aren't written to CSS.
- **The theme is chosen once**, in `web/src/main.tsx`: it's written to the page there and handed down through `App` and `Globe` to the globe.

Motion isn't part of a theme: durations, easings and the animations' shapes stay in the CSS.

With the device's reduce motion setting on, changes still show but nothing moves or blinks. A score or a start plays the finish's calm dim on its score card, without the bounce or the pop. A Live score card's status light stays fully lit, so Live is told from Upcoming by its glow and brightness alone. Every pulse over a small pin or a cluster is a still ring that fades in and out in place without growing. Camera moves jump instead of easing: MapLibre does this for any camera move not marked `essential`, so none is.

## The palette

Each palette colour has a `base`, a `#rrggbb` colour, and optional hand-set `steps`:

```json
"navy": { "base": "#2b4d7d", "steps": { "900": "#020814" } }
```

**Steps** run from `100`, the lightest, to `900`, the darkest; `500` is the base colour itself. A colour job names one as `<colour>.<step>`, such as `navy.700`. The other steps are worked out in OKLCH, at the base colour's hue:

- lighter steps (100 to 400) go evenly in lightness from the base towards white, darker ones (600 to 900) evenly towards black, the lightest and darkest stopping a fifth of the way short of white and black;
- each keeps the base colour's chroma, or as much of it as sRGB can show at that lightness, so its hue doesn't drift.

OKLCH because its lightness looks even and its hue holds as a colour lightens, where mixing with white or black in sRGB, or HSL's lightness, drifts. A step that looks off can be **hand-set** under `steps`: it replaces that one step and leaves the rest as worked out. A hand-set step must be one of `100` to `900` and a `#rrggbb` colour.

Two things follow from the working-out:

- A very light base, like off-white, has steps 100 to 400 that are practically white: only its darker steps are useful.
- A saturated base keeps its chroma into the dark steps, so navy's 700 to 900 are deep, saturated blues rather than near-blacks. Hand-set them if a darker step looks too blue.

### The dark theme's palette

No step is hand-set. The steps as worked out (the base in bold):

| Colour | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gold` | `#ffedcf` | `#ffda9a` | `#f3ca81` | `#e3bb72` | **`#d4ac63`** | `#a37d32` | `#725100` | `#3f2b00` | `#120a00` |
| `red` | `#ffd6d3` | `#ffaaa6` | `#ff7776` | `#ee484f` | **`#cd2435`** | `#9d001e` | `#6a0011` | `#3a0005` | `#100001` |
| `orange` | `#ffe1d7` | `#ffc1ad` | `#ff9f7f` | `#fe794c` | **`#e56335`** | `#b53b00` | `#7a2500` | `#441100` | `#140200` |
| `navy` | `#c1dbff` | `#8fb6ed` | `#6c91c6` | `#4b6ea1` | **`#2b4d7d`** | `#153664` | `#00204c` | `#000e28` | `#000209` |
| `offWhite` | `#fcfdff` | `#fafbfd` | `#f8f9fb` | `#f6f7f9` | **`#f4f5f7`** | `#b5b6b8` | `#7a7b7d` | `#444446` | `#141516` |

Navy is the globe and every surface, off-white the text, the selection and what's on, gold every game. Red and orange have no job yet: they're kept for league colours, or for errors and warnings.

## Colour jobs

A **colour job** is what a colour is for (the globe's surface, Live's colour, main text), not which colour it is. Each takes either:

- a palette step by name: `"navy.700"`; or
- a colour given directly, in a form both CSS and MapLibre read, since it's passed on to both as written: a hex colour of 3, 4, 6 or 8 digits (`#abc`, `#abcd`, `#0b1526`, `#0b152680`); `rgb(…)` or `rgba(…)`, its three channels all numbers or all percentages; `hsl(…)` or `hsla(…)`, a hue (in degrees, `deg` optional) and two percentages; each function's arguments comma-separated with an optional fourth for alpha (`rgba(255, 255, 255, 0.7)`), or space-separated with an optional `/ alpha` (`rgb(10% 20% 30% / 50%)`); or `transparent` (for a shadow or glow that isn't there). Named colours such as `red` aren't taken: `red` would read as a step's name. This is the escape hatch for a one-off the palette doesn't fit, at the cost of that colour no longer following the palette.

The dark theme gives every job a step but the four shadows, which are `transparent`. Every colour job, by where it shows:

### The globe

| Setting | What it colours | Dark theme |
| --- | --- | --- |
| `globe.surface` | The globe: land and sea alike | `navy.500` |
| `globe.coastlines.color` | The edges of the sea (lakes and rivers aren't outlined) | `navy.300` |
| `globe.countryBorders.color` | Country borders | `navy.300` |
| `globe.stateLines.color` | State and province lines | `navy.400` |
| `globe.disputedBorders.color` | Disputed borders, dashed | `navy.400` |
| `globe.halo.inner.color` | The halo close around the globe's edge | `navy.400` |
| `globe.halo.outer.color` | The halo's wider, fainter outer glow | `navy.700` |
| `placeNames.<kind>.color` | A kind of place's name: `city`, `capital`, `state`, `country` | city `navy.200`, capital `navy.100`, state `navy.300`, country `navy.200` |
| `placeNames.<kind>.outline.color` | The outline around its letters | `navy.600` for every kind |
| `page.sky` | The sky around the globe | `navy.900` |
| `page.stars.white`, `.cool`, `.warm` | The scattering of stars in the sky | `offWhite.500`, `navy.100`, `gold.100` |

### Games on the globe

| Setting | What it colours | Dark theme |
| --- | --- | --- |
| `status.<status>.color` | A game's colour, by status (`live`, `upcoming`, `final`, `disrupted`): its small pin's ring and glow, its score card's outline, header, status light and glow, its trail, a cluster's outline, glow and count, its pulse, and the game panel's top edge and progress line | `gold.500` for Live, Upcoming and Final; `offWhite.700` (grey) for Disrupted |
| `status.<status>.core.color` | A small pin's bright core | Live `gold.100`; Upcoming and Final `gold.500`; Disrupted `offWhite.700` |
| `cluster.fill` | The disc of a pin cluster or card cluster | `navy.700` |
| `selection.color` | The selected game's pin ring and score card outline | `offWhite.500` |
| `card.fill` | A score card's fill, solid | `navy.700` |
| `card.text` | A score card's text | `offWhite.500` |
| `card.disrupted.fill`, `card.disrupted.text` | A Disrupted game's score card fill and text | `navy.700`, `offWhite.700` |
| `card.shadow` | The drop shadow a starting game's score card settles with | `navy.900` |

### Panels and controls

| Setting | What it colours | Dark theme |
| --- | --- | --- |
| `page.background` | The page behind everything | `navy.900` |
| `text.main` | Main text on the game panel, the settings menu and the scenario controls | `offWhite.500` |
| `text.secondary` | Secondary text: the game panel's league and labels and the lines under a venue or a time; the settings gear; league chips that are off, and the count on the "All leagues" chip | `offWhite.600` |
| `text.link` | Links (the game panel's stream links) | `offWhite.500` |
| `text.onStatus` | Text written on a status's colour: the game panel's progress line | `navy.800` |
| `divider` | The lines between a menu's parts (under the settings tabs, under "All leagues") | `navy.600` |
| `hover` | Behind a control under the pointer (a scenario in the list, a speed key) | `navy.600` |
| `controls.surface` | The scenario pill and its list, the speed keys, the scenario clock and the "No games right now." message | `navy.800` |
| `controls.shadow.color` | Their drop shadow | `transparent` |
| `controls.on.fill`, `controls.on.text` | A speed key that's on | `offWhite.500`, `navy.800` |
| `panel.surface.top`, `.bottom` | The game panel, shading from top to bottom | `navy.800`, `navy.800` (solid) |
| `panel.scoreBlock.top`, `.bottom` | The game panel's score block, shading from top to bottom | `navy.700`, `navy.700` (solid) |
| `panel.score.fill`, `panel.score.text` | A team's score box on the game panel | `navy.600`, `offWhite.500` |
| `panel.unofficial` | The note on unofficial stream links | `offWhite.600` |
| `panel.photo` | The glow where the venue's photo goes | `navy.600` |
| `panel.credit.fill`, `panel.credit.text` | The photo's credit, shown on hover | `navy.900`, `offWhite.600` |
| `panel.close` | The game panel's close button | `navy.700` |
| `panel.shadow.color` | The game panel's drop shadow | `transparent` |
| `settingsMenu.surface` | The settings menu | `navy.800` |
| `settingsMenu.shadow.color` | Its drop shadow | `transparent` |
| `settingsMenu.gearOutline.color` | An outline around the settings gear, cast as a shadow, for a theme whose gear needs one to read over the globe | `transparent` (none) |
| `settingsMenu.tab` | A settings tab that's off | `offWhite.600` |
| `settingsMenu.count` | The count of a sport's leagues that are on | `offWhite.600` |
| `settingsMenu.hint` | The hint beside "All leagues" | `offWhite.600` |
| `settingsMenu.chip.outline` | A league chip's outline | `navy.500` |
| `settingsMenu.chip.badge` | The badge counting leagues on the "All leagues" chip | `navy.700` |
| `settingsMenu.on.fill`, `settingsMenu.on.text` | A settings tab or league chip that's on | `offWhite.500`, `navy.800` |

"On" is off-white everywhere (a settings tab, a league chip, a lit speed key, the selection), so chosen looks the same across the app.

## How a game's status shows

A game's status shows by **brightness and glow, not colour** (ADR-0012). Colour is the strongest signal on a map and only six to eight colours can be told apart on one, so it's kept to stand for a game's league later, when several leagues are shown at once. Until then the dark theme gives Live, Upcoming and Final games the one gold and Disrupted games a grey, so a game's colour says only whether it's being played as scheduled.

- **Live** glows widest, its small pin has a bright core, and its score card's status light pulses (that animation is in the CSS), unless reduce motion is on (see [Where the theme reaches](#where-the-theme-reaches)).
- **Upcoming** glows less and is a little dimmer.
- **Final** has no glow and fades.
- **Disrupted** has no glow and greys out.

Score cards stay solid as they fade, so the map never shows through the scores: a card fades by colour, its status colour, text and logos mixed into its fill, not by being see-through.

Each status still has its own colour job, though three point at the same gold, so league colours, or a theme that shows status its own way (a light theme, where glows barely show), can change them without a new job.

Each status's look, `status.<status>`:

| Setting | What it is |
| --- | --- |
| `color` | The game's colour (see [Games on the globe](#games-on-the-globe)) |
| `core.color`, `core.radius`, `core.opacity` | A small pin's bright core: its colour, radius in pixels and opacity |
| `core.ring` | The width of the ring of status colour around the core, in pixels (0 is no ring) |
| `glow.radius`, `glow.opacity` | The soft glow around a small pin: its radius out to where it's faded to nothing, and its opacity at the middle (radius 0 is no glow) |
| `clusterOpacity` | How opaque a pin cluster or card cluster showing as this status is: its disc, outline and count alike |
| `card.fade` | How far its score cards fade, from 0 (not at all) to 1 (all the way, a blank card). A card stays solid: its status colour (its outline, header, status light, pointer and glow), its text and its logos are mixed this far into the card's fill (a Disrupted game's fill for a Disrupted card). The selected game's card doesn't fade |
| `card.glow.radius`, `card.glow.opacity` | How far and how strongly its score cards glow in its colour (radius 0 is no glow). The CSS works out the rest from these: an inner glow 1.25 times as far at a third of the opacity, and the status light's glow 0.75 times as far |

The dark theme's:

| Status | Colour | Pin core | Pin glow | Cluster | Card fade | Card glow |
| --- | --- | --- | --- | --- | --- | --- |
| Live | `gold.500` | `gold.100`, 3.5px, opacity 1, 1.5px ring | 15px at 0.8 | 1 | 0 | 12px at 0.8 |
| Upcoming | `gold.500` | `gold.500`, 3px, 0.9, no ring | 9px at 0.4 | 0.9 | 0.15 | 4px at 0.3 |
| Final | `gold.500` | `gold.500`, 2.5px, 0.5, no ring | none | 0.55 | 0.45 | none |
| Disrupted | `offWhite.700` | `offWhite.700`, 2.5px, 0.7, no ring | none | 0.6 | 0.3 | none |

The card fades are what the cards' opacities were before cards were made solid (1 minus 1, 0.85, 0.55 and 0.7), so they look as close to that as a solid card can.

How status reaches the rest of the globe:

- **Clusters** show as the most prominent status among their games (Live, then Upcoming, Final, Disrupted). A cluster glows as strongly as `cluster.glowOpacity` times its status's pin glow opacity, so a cluster of a status whose pins don't glow doesn't either. In the dark theme that's 0.6, so a Live cluster glows at 0.48.
- **Pulses** play in the colour of the pin's, score card's or cluster's status after the change. A score, a start and a finish are told apart by the pulse's shape, never its colour.
- **The selected game** is outlined in `selection.color`, off-white, apart from the gold of every other game.
- **Glow means a game.** Panels and controls have no glow and no drop shadow: in the dark theme their shadows, the settings gear's outline among them, are `transparent` and the game panel's glow has opacity 0.
- **Pin clustering** depends on the widest pin glow: small pins gather into pin clusters when their glows (at 0.6 of their radius) would overlap. Widening Live's glow makes pins cluster sooner.

## Scales

A **scale** is a theme's set of named sizes, in pixels, that a kind of size is always a step of. The step names are fixed; a theme sets each step's pixels. The page's CSS uses only scale steps for text sizes, spacing, corners and borders, and chooses which step each thing on the page uses: a theme changes how big a step is, not which step a thing uses. A setting given as a step names it (`"m"`), and checking rejects a name that isn't one of its scale's steps.

| Scale | Steps | Dark theme | Custom property |
| --- | --- | --- | --- |
| `textSizes` | `xs`, `s`, `m`, `l`, `xl` | 11, 12, 14, 16, 20 | `--text-sizes-m` |
| `spacing` | `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl` | 2, 4, 6, 8, 12, 16, 24, 32 | `--spacing-l` |
| `radii` | `xs`, `s`, `m`, `l`, `pill` | 4, 6, 8, 12, 999 | `--radii-m` |
| `strokes` | `thin`, `medium`, `thick` | 1, 2, 3 | `--strokes-thin` |

- **Text sizes**: on the page, body text `l`; the game panel `m`, its team names `l`, scores `xl`, headings and secondary text `s`, labels and the photo credit `xs`; score cards `s`, their header line `xs`; the settings menu and the scenario controls `m`, the menu's counts and hint `s`. On the globe, place names and cluster counts name their steps in the theme (see [Fonts](#fonts)).
- **Spacing**: every padding, margin and gap on the page. Cards stay tight on the small steps and panels roomy on the large ones, from the same scale.
- **Radii**: used through the corners below. `pill` is large enough to round any control into a pill. Circles (clusters, the status light) stay circles whatever the radii.
- **Strokes**: the page's borders and dividers. The score card's border and header line, dividers and league chips are `thin`, the settings tab's underline `medium`, the game panel's top edge `thick`.

### Corners and the cut corner

Each kind of corner names a step of the radius scale:

| Setting | Which corners | Dark theme |
| --- | --- | --- |
| `corners.card` | A score card's | `s` (6px) |
| `corners.panel` | The game panel's | `m` (8px) |
| `corners.menu` | A menu's: the settings menu, the list of scenarios | `m` (8px) |
| `corners.menuItem` | An item's in a menu | `s` (6px) |
| `corners.message` | A message's, such as "No games right now." | `m` (8px) |
| `corners.control` | A control's: the scenario pill and clock, the speed keys, league chips | `pill` |

The **cut corner** cuts off the game panel's bottom left corner, like a broadcast graphic, for a more angular theme: `cutCorner.on` (`true` or `false`) and `cutCorner.size`, how far along each side, as a step of the spacing scale. The dark theme has it off (size `xl`, unused).

## Other sizes

Sizes that aren't on a scale are free values: pixels, any number from 0 up (an offset may be negative), or ems where a size goes with its text and should grow with it (letter spacing, which may be negative, and boxes sized to their characters). They're not forced onto the scales, which are for text sizes, spacing, corners and the page's line widths only. The dark theme keeps the look before it for all of these.

### On the globe

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `globe.<line>.width` | A line's width by zoom, for `coastlines`, `countryBorders`, `stateLines` and `disputedBorders`: a width at each of some zoom levels (`{ "2": 0.6, "8": 1.2 }`), growing evenly between them; one zoom level is a fixed width | coastlines 0.6 to 1.2 (zoom 2 to 8), country borders 0.6 to 1.4 (2 to 8), state lines 0.5 to 1 (3 to 8), disputed borders 0.8 |
| `globe.disputedBorders.dash` | The disputed borders' dash pattern: the lengths of the dashes and the gaps between them, in line widths, at least two | `[2, 2]` |
| `globe.halo.inner.blur`, `.spread`, and `outer`'s | How far each of the halo's glows blurs and spreads, growing with the globe on screen: `{ share, max }`, that share of the globe's radius on screen, but never more than `max` pixels | inner blur 0.12 up to 60, spread 0.04 up to 20; outer blur 0.35 up to 160, spread 0.08 up to 40 |
| `placeNames.<kind>.outline.width`, `.blur` | The outline around a place name's letters | 2 and 0.5; state names 1.2 and 0 |
| `cluster.radius.few`, `.some`, `.many` | A pin cluster's disc by how many games it holds: up to 4, up to 14, more. A card cluster is as wide as `some`, outline and all | 11, 13, 16 |
| `cluster.glowRadius.few`, `.some`, `.many` | Its glow's radius, likewise | 22, 26, 32 |
| `cluster.outlineWidth` | A cluster's outline | 1.5 |
| `cluster.glowOpacity` | A cluster's glow, as a share of its status's pin glow opacity (0 to 1) | 0.6 |
| `trail.width`, `trail.opacity` | A moved score card's trail back to its venue | 1.25, 0.9 |
| `trail.glow.width`, `.blur`, `.opacity` | The soft glow along a trail | 4, 3, 0.35 |
| `trail.venue.radius` | The dot at the trail's venue | 2 |
| `trail.venue.ring.radius`, `.width` | The ring around that dot | 5, 1 |
| `selection.width` | The selected pin's ring and score card's outline. The ring reaches as far out whatever its width | 2 |
| `pulse.size.pin`, `pulse.size.cluster` | How wide a pulse's ring starts, over a small pin and over a cluster | 16, 36 |
| `pulse.ring.lively`, `pulse.ring.calm` | How thick a pulse's ring is, for a score or a start, and for a finish | 3, 2 |

### On the page

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `panel.shadow`, `settingsMenu.shadow`, `controls.shadow` | A drop shadow: `{ x, y, blur, color }`, how far it falls across and down, how far it blurs, and its colour | none (`transparent`, blur 0) |
| `settingsMenu.gearOutline` | The outline around the settings gear, as a shadow | none (`transparent`, blur 0) |
| `panel.glow.y`, `.blur`, `.opacity` | The glow in the game's status colour along the game panel's top | 0, 0, 0 (none) |
| `card.headerTint` | How strongly a score card's header is tinted with its status colour, 0 to 1 | 0.28 |
| `controls.off.opacity` | How opaque a speed key that's off is, 0 to 1 (one that's on, or under the pointer, is opaque) | 0.6 |
| `letterSpacing.label` | How far apart the letters of the game panel's league and labels are spaced, in ems | 0.14 |
| `letterSpacing.cardHeader` | Likewise for a score card's header line | 0.06 |
| `page.stars.size.small`, `.large` | The stars in the sky around the globe, small and large | 1, 1.5 |
| `sizes.panel.width` | The game panel's width at most | 940 |
| `sizes.panel.height`, `.phoneHeight` | Its height, and its height on a phone, where the details go below the score block | 127, 236 |
| `sizes.panel.scoreBlock`, `.slant` | The score block's width, and how far its right edge slants | 290, 16 |
| `sizes.panel.photo`, `.logo`, `.close` | The venue photo's width, a team's logo, the close button | 180, 28, 24 |
| `sizes.panel.scoreWidth` | A team's score box, in ems of its digits: wide enough for three, so a score of 100 moves nothing | 2.6 |
| `sizes.card.minWidth` | A score card's narrowest | 92 |
| `sizes.card.logo`, `.light` | A team's logo on a score card, and its status light | 16, 6 |
| `sizes.card.pointer` | How far a score card's pointer reaches below it to the venue (the globe reads this to place cards) | 6 |
| `sizes.card.nameClearance` | How far score cards keep clear of the letters of a city named for a game (its outline included; the globe lays cards out by this) | 4 |
| `sizes.settingsMenu.width`, `.gear`, `.allLeagues` | The settings menu's width, the gear, the "All leagues" chip's height | 320, 28, 32 |
| `sizes.settingsMenu.countWidth`, `.mark` | On the "All leagues" chip, the narrowest its count is, and the box its mark (✓ or –) sits in, so the chip keeps its size whichever shows; in ems | 3.2, 1 |
| `sizes.controls.key`, `.icon` | A speed key and its icon. The game panel sits clear of the scenario controls by the keys' size | 34, 14 |

## Fonts

Every kind of text has its own font setting, so one can change without the rest. Text on the page and text on the globe come from different places, and take different settings.

### Text on the page

Each is `{ family, weight }`: a CSS font family and a weight from 1 to 1000.

| Setting | Which text | Dark theme's weight |
| --- | --- | --- |
| `fonts.body` | Body text | 400 |
| `fonts.heading` | The game panel's headings: its league, labels and progress line | 700 |
| `fonts.team` | Team names on the game panel | 700 |
| `fonts.score` | Scores on the game panel | 700 |
| `fonts.tab` | The settings menu's tabs and sport names | 600 |
| `fonts.button` | Buttons: league chips and their counts, the game panel's close button | 600 |
| `fonts.scenarioPill` | The scenario pill, and the scenario it has on | 600 |
| `fonts.scenarioClock` | The scenario clock | 400 |
| `fonts.card.clock` | A score card's clock line (and the rest of its text) | 600 |
| `fonts.card.team` | A score card's team abbreviations | 700 |
| `fonts.card.score` | A score card's scores | 700 |

The dark theme writes every one in `'Open Sans Variable', 'Open Sans', sans-serif`, so the app looks the same on Windows, Mac and phones. The theme gives only the family: the font itself has to be loaded by the app. Open Sans is bundled with it (`@fontsource-variable/open-sans`, imported in `web/src/main.tsx`, weights 300 to 800), so a theme using another web font needs its loading added in code. Scores keep their digits lined up as they change: the CSS asks for tabular figures, and Open Sans's figures are already tabular.

### Text on the globe

The globe's text (place names and the count on a pin or card cluster) is drawn by MapLibre from the map's font server, fonts.openmaptiles.org, not from the page's fonts (ADR-0006). A globe font is given by the name the server knows it by, and must be one it has: for a font it lacks, the server answers with a web page rather than an error and the text falls back to a browser font, so checking rejects any other. The fonts it has (listed in `globeFonts`, `web/src/theme/globeFonts.ts`, checked in October 2026):

- **Open Sans**: Light, Light Italic, Regular, Italic, Semibold, Semibold Italic, Bold, Bold Italic, Extra Bold;
- **Klokantech Noto Sans**: Regular, Italic, Bold (it has no plain "Noto Sans");
- **Metropolis**: Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black, each also Italic.

Each is written in full, family and variant: `"Open Sans Semibold"`, `"Metropolis Black Italic"`.

| Setting | Which text | Dark theme |
| --- | --- | --- |
| `placeNames.<kind>.font` | A kind of place's name | city `Open Sans Semibold`, capital `Open Sans Bold`, state `Open Sans Regular`, country `Open Sans Bold` |
| `placeNames.<kind>.size` | Its size by zoom: a step of the text size scale at each of some zoom levels (`{ "4": "s", "11": "xl" }`), growing evenly between them | city `s` at zoom 4, `m` at 7, `xl` at 11; capital `m`, `l`, `xl` at 4, 7, 11; state `xs` at 3 to `m` at 8; country `xs` at 1 to `l` at 4 |
| `placeNames.<kind>.letterSpacing` | How far apart its letters are spaced, in ems. State and country names are always in capitals, which want more | city and capital 0, state 0.25, country 0.12 |
| `fonts.clusterCount.font` | The count on a pin or card cluster | `Open Sans Bold` |
| `fonts.clusterCount.size` | Its size, a step of the text size scale | `s` |

## What checking rejects

A theme is checked when it's resolved, and every problem is listed, not just the first; checking never throws, whatever it's given. Checking rejects:

- a theme that isn't an object, or that has anything but a `palette` and `settings`;
- a missing palette, or a palette, a palette colour or a group of settings that isn't an object;
- a missing setting anywhere in the settings, and **a setting the theme doesn't know** (a misspelt one shows as itself, as well as the real one missing), or a part of a palette colour other than `base` and `steps`;
- a palette colour whose base isn't a `#rrggbb` colour, or a hand-set step that isn't `100` to `900` or isn't a `#rrggbb` colour;
- a colour job naming a step the palette doesn't have (an unknown colour or an unknown step), or giving a colour directly that isn't well formed (see [Colour jobs](#colour-jobs): `#12` or `rgb(1, 2)` is rejected), or that isn't a string;
- a size, spacing or radius given as a name that isn't one of its scale's steps, and a scale step that isn't a number of pixels;
- a size that isn't a number of pixels (or ems) from 0 up, an offset or letter spacing that isn't a number, an opacity or fade that isn't from 0 to 1, or a font weight that isn't from 1 to 1000;
- an on or off setting that isn't `true` or `false`, or a font family that's empty;
- a size by zoom with no zoom levels, or with a zoom level that isn't a number;
- a dash pattern that isn't two or more lengths from 0 up, or a halo size's share of the globe that isn't a number from 0 up;
- a globe font fonts.openmaptiles.org doesn't have.

It doesn't check how a theme looks: whether text reads against its surface, or whether the statuses can be told apart. That's for looking at it running (see [Making or changing a theme](#making-or-changing-a-theme)).

The built-in theme has a test (`web/src/theme/theme.test.ts`), so a broken theme fails its tests rather than shipping.

## Making or changing a theme

ScoreMap has one theme, built in, so making a theme today means changing `web/src/theme/builtInTheme.json`.

1. **Palette first.** Choose the base colours and look at their worked-out steps (`paletteSteps` in `web/src/theme/palette.ts` works them out). Hand-set a step only where the worked-out one looks off.
2. **Point every colour job at a step**, using the tables above. Keep a colour given directly for a true one-off.
3. **Set the scales, corners, sizes, fonts and each status's look.** Status shows by glow and brightness: if the theme's glows don't show (a light theme), give status its own way through each status's opacities, core and colours.
4. **Run the tests** (`npm test` in `web/`). Checking reports what's wrong with the theme. The built-in theme's tests also hold the dark theme's choices (navy globe, gold games, off-white selection, Open Sans and so on), so a deliberately different look means changing those tests with it.
5. **Look at it running.** How the app looks isn't tested automatically: check it in the `worldwide`, `crowded` and `edge-cases` scenarios (the `run-scoremap` skill), on the globe zoomed out and in, with the game panel and settings menu open, and on a phone-sized window.

### Adding a setting

A new setting goes in the settings in `web/src/theme/theme.ts` and in every theme's JSON, since a theme without it is rejected; its custom property then appears on the page by itself. The page's CSS reads it through that custom property. Likewise a setting taken out must leave every theme's JSON, since a theme with a setting it doesn't know is rejected.

### What stays in code

Some of the look is in code on purpose, as behaviour or layout rather than a theme's choices:

- motion: durations, easings and the shapes of the animations, including the status light's pulse and the sizes and opacities inside their keyframes;
- the starfield's pattern (where each star sits in its tile, how bright it is, the tile's size) and skew angles;
- layout: line heights, percentages, and slots sized in lines (`lh`, such as the game panel's room for two lines of a venue);
- score card and pin footprints, card layout distances (`cardLayout.ts`), how far the selected pin's ring reaches, and where a city's name sits from its dot (`text-radial-offset: 1.2` ems zoomed out, `text-radial-offset: 1` zoomed in) and where it wraps (as the base map style has them);
- that a glow on the globe (a small pin's, a pin cluster's or a card cluster's) fades out all the way to its edge (`circle-blur: 1`): how far it reaches and how strongly it glows are the theme's;
- icons' drawings: their shapes and line widths, in the units of their own `viewBox`, which the CSS sizes to the theme's sizes;
- which kinds of place are named in capitals (states and countries);
- which text size, spacing step and stroke each thing on the page uses (the CSS), and which status is most prominent and draws on top (the status look, `web/src/globe/statusLook.ts`).

Tests hold the code to this list. `indexCss.test.ts` fails on a look value written into the page's CSS. `lookInCode.test.ts` fails on a colour written anywhere in the web app's TypeScript outside the theme module (`web/src/theme/`), a size in pixels, points or ems written into its strings, a size or opacity written into a markup attribute, a component's props or an inline style, and a colour, width, radius, size, blur, opacity, dash pattern, letter spacing, offset or translation in a globe map layer's paint or layout that doesn't come from the theme (it builds every layer with the built-in theme and with one where every value is different, and fails on any that comes out the same). Only this list lets a value through: a code span here written as a name, a colon and a value allows that value by that name, in a map layer or in markup, and `viewBox` allows icons' drawings. Neither check counts an opacity of 1 or 0, which only shows or hides a thing, or `transparent`, which is no colour. Neither catches a number worked into a theme's value (`theme.trail.width * 2`), since the result still changes with the theme, so that's still for review.
