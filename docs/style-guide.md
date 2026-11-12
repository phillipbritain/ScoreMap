# Style guide

How ScoreMap's look is made, so a theme can be made or changed without reading the code. It describes the theme as built: the settings in [`web/src/theme/theme.ts`](../web/src/theme/theme.ts) and the built-in dark theme, [`web/src/theme/builtInTheme.json`](../web/src/theme/builtInTheme.json). When they and this guide disagree, the code is right and this guide is stale.

The decisions behind it: [ADR-0011](adr/0011-themes-as-checked-json-with-a-palette.md) (themes as checked JSON, with colors worked out in OKLCH), [ADR-0014](adr/0014-themes-shaped-like-mui.md) (a theme shaped as MUI's is), [ADR-0012](adr/0012-color-for-league-status-by-glow.md) (color will stand for league; status shows by brightness and glow), [ADR-0017](adr/0017-viewers-pick-the-colors.md) (viewers pick the colors games show in) [ADR-0006](adr/0006-map-fonts-from-openmaptiles.md) (the globe's fonts come from fonts.openmaptiles.org), [ADR-0018](adr/0018-surfaces-are-glass.md) (the original glass treatment, which score cards keep) and [ADR-0023](adr/0023-solid-backgrounds-for-panels.md) (solid backgrounds for everything else). The words **theme**, **theme colors**, **palette**, **color job** and **type style** are the glossary's ([`GLOSSARY.md`](../GLOSSARY.md)).

## Contents

The guide is long: read this list, then only the sections the task needs (`grep -n '^## ' docs/style-guide.md` gives each one's line).

- [What a theme is](#what-a-theme-is): the theme's JSON shape and parts, where it reaches (CSS custom properties, the globe, switching themes), and motion: score changes, cards coming and going, reduce motion.
- [The theme's colors](#the-themes-colors): base colors and how their light-to-dark steps are worked out; the dark theme's colors.
- [The palette](#the-palette): what each main color is for (`primary`, status colors, background, text), with the dark theme's values.
- [Color jobs](#color-jobs): what a color job may name, and every part's color jobs: the globe, games on the globe, panels and controls.
- [How a game's status shows](#how-a-games-status-shows): Live, upcoming and final by brightness and glow; hot games' flames, glass, tooltips and hover.
- [Typography](#typography): the font family and each type style, and which text uses it.
- [Spacing and shape](#spacing-and-shape): the spacing unit, corner radius and border widths; the cut corner and logo plates.
- [Other sizes](#other-sizes): free sizes on the globe (pins, clusters, trails, halo) and on the page.
- [Text on the globe](#text-on-the-globe): globe fonts from the map's font server, and which it has.
- [What checking rejects](#what-checking-rejects): every way a theme fails its check.
- [Making or changing a theme](#making-or-changing-a-theme): editing the built-in theme, trying it on a local run, adding a setting, and what stays in code.

## What a theme is

A **theme** is the whole of how ScoreMap looks, the globe included: one JSON file, checked when it's loaded. ScoreMap has one, the dark theme, built into the app and resolved as it starts, so the first paint is themed with no wait on the network. Loading other themes, a theme setting and a theme picker are later work.

A theme is shaped as a [Material UI](https://mui.com/material-ui/customization/theming/) theme is, so its parts are where someone who knows MUI would look for them, though ScoreMap doesn't use MUI itself:

```json
{
  "colors": { "navy": { "base": "#2b4d7d" }, "...": {} },
  "palette": { "primary": { "main": "navy.500", "...": "" }, "live": { "main": "gold.500", "...": "" }, "...": {} },
  "typography": { "fontFamily": "'Open Sans Variable', …", "body2": { "fontWeight": 400, "fontSize": 14, "letterSpacing": 0 }, "...": {} },
  "spacing": 4,
  "shape": { "borderRadius": 4, "borderWidth": { "thin": 1, "medium": 2, "thick": 3 } },
  "components": { "ScoreCard": { "fill": "primary.dark", "final": { "fade": 0.45, "...": {} }, "...": {} }, "...": {} }
}
```

- The **theme colors** (`colors`) name a few base colors. Each is worked out into steps from light to dark (see [The theme's colors](#the-themes-colors)), as MUI's own colors (`@mui/material/colors`) come in steps.
- The **palette** says what the main colors are for, as MUI's does: `primary`, `secondary`, `error` and `warning`, each a `main` shade, a `light` and a `dark` one and the `contrastText` written on it; a color for each game status (`live`, `upcoming`, `final`), as MUI takes colors of a theme's own, each a `main`, `light` and `dark` shade; and the `background`, `text`, `divider` and `action.hover`. Each names a step of the theme's colors (see [The palette](#the-palette)).
- The **typography** is one font family and the type styles, MUI's typography variants: `h6`, `subtitle1`, `body2` and so on (see [Typography](#typography)).
- **`spacing`** is the spacing unit every space on the page is a number of, as MUI's `theme.spacing` is, and **`shape`** the corner radius every corner is a number of and the page's line widths (see [Spacing and shape](#spacing-and-shape)).
- **`components`** has each part of ScoreMap's own look, by part, as MUI's `components` has each component's: the globe, place names, pins, clusters, trails, score cards, the game panel, the menus, the controls and the loading screen. A part that looks different by game status has a group for each (`components.Pin.live`, `components.ScoreCard.final`), as MUI's components style each color they come in (see [How a game's status shows](#how-a-games-status-shows)). A part's color jobs name a step or one of the palette's colors (`primary.dark`, `text.secondary`), so changing the palette changes every part that uses it.

Every setting is required, and nothing else is allowed: a theme missing a setting, or with one it doesn't know, is rejected (see [What checking rejects](#what-checking-rejects)). This is where a theme differs most from MUI's, which fills in whatever it isn't given: ScoreMap's built-in theme is the only one, so a setting left out is a mistake, not a default.

### Where the theme reaches

The code reads only the resolved theme, never the JSON:

- **The page** (the game panel, score cards, the rail, the scenario controls, the loading screen): the resolved theme is written to the page's root as CSS custom properties, one per setting, named by where it sits in the theme in kebab case, as MUI's CSS theme variables are. `palette.text.primary` is `--palette-text-primary`, `typography.body2.fontSize` is `--typography-body2-font-size`, `spacing` is `--spacing`, `palette.live.main` is `--palette-live-main`. A component's are named by the component alone: `components.ScoreCard.fill` is `--score-card-fill`, `components.GamePanel.surface.top` is `--game-panel-surface-top`. Sizes are written in pixels (`12px`), or in ems where they go with their text (`0.14em`), on or off as `1` or `0`, and a shadow as one CSS shadow (`0px 8px 30px #000e28`). A globe font is written as its `-name`, `-family`, `-weight` and `-style`. The page's CSS (`web/src/index.css`) reads a settled look's colors, fonts, text sizes, spacing, corners, sizes and opacities through these, rather than naming its own (see [What stays in code](#what-stays-in-code) for what it may name, and for a look still being tried). A space is a number of spacing units, `calc(3 * var(--spacing))`, as MUI's `theme.spacing(3)` gives it.
- **The globe**: its map style (surface, coastlines and borders), place names, the halo, pins, clusters, trails, the selected pin's ring and pulses read the resolved theme directly, since MapLibre needs the values themselves, not CSS custom properties. Widths and text sizes that change with zoom, the disputed borders' dash pattern and the halo's sizes are read only by the globe and aren't written to CSS.
- **The theme is chosen** to start in, in `web/src/main.tsx`, and **changes one way**, as the app runs: through `useTheme` (`web/src/theme/useTheme.ts`), which writes it to the page before the page paints and hands it down through `App` and `Globe` to the globe. The globe restyles itself in place (`GlobeMap.setTheme`): it sets just the map layer properties that differ between the two themes, redraws the halo, reclusters small pins and measures score cards afresh. Nothing is made again and the camera stays where it is.

Motion isn't part of a theme: durations, easings and the animations' shapes stay in the CSS.

When a game's score changes, nothing on its score card moves: the card's edge glows in the game's color and fades over 1.6 seconds, and the score takes that color as it fades. When a two-sided game's score changes, the side that scored is also lit for 3 seconds, on its score card's row and in the game panel: a tint and inner glow in the game's color, its name and score brighter and glowing, steady for two seconds and then fading. A card redrawn, or a panel opened, partway through carries on from there rather than starting over. A field or a fight card has no scorer to light.

A score card comes in when its game arrives on the board, or is shown again from Leagues on the rail: it drops in from a little above as it fades in, landing on its trail, its trail and venue dot fading in with it. It lifts up and away as it fades out when its game drops off after finishing or is hidden, its trail and venue dot fading with it, out of the card layout at once so it holds no room as the others move in. Each takes 300 ms (`cardComingDuration`, in `web/src/globe/cardComings.ts`, as the trails need it too). A card that comes or goes as the camera moves, or as it moves into or out of a card cluster, just appears or goes.

With the device's reduce motion setting on, changes still show but nothing moves or blinks. A score's glow fades in place without shrinking. A score card coming in or going out fades in place, without dropping in or lifting away. The side that scored stays lit, steady, for its 3 seconds, then goes at once. A hot game's flames stay, standing still. Every pulse over a small pin or a cluster is a still ring that fades in and out in place without growing. The loading screen's rocket fades in and out in place instead of flying, its flame steady and with no speed lines, and its dim goes at once when ScoreMap is ready instead of fading. Camera moves jump instead of easing: MapLibre does this for any camera move not marked `essential`, so none is.

## The theme's colors

Each of the theme's colors (`colors`) has a `base`, a `#rrggbb` color, and optional hand-set `steps`:

```json
"navy": { "base": "#2b4d7d", "steps": { "900": "#020814" } }
```

**Steps** run from `100`, the lightest, to `900`, the darkest; `500` is the base color itself. A color job names one as `<color>.<step>`, such as `navy.700`. The other steps are worked out in OKLCH, at the base color's hue:

- lighter steps (100 to 400) go evenly in lightness from the base toward white, darker ones (600 to 900) evenly toward black, the lightest and darkest stopping a fifth of the way short of white and black;
- each keeps the base color's chroma, or as much of it as sRGB can show at that lightness, so its hue doesn't drift.

OKLCH because its lightness looks even and its hue holds as a color lightens, where mixing with white or black in sRGB, or HSL's lightness, drifts. A step that looks off can be **hand-set** under `steps`: it replaces that one step and leaves the rest as worked out. A hand-set step must be one of `100` to `900` and a `#rrggbb` color. A color can't be named as one of the palette's parts are (`primary`, `text`, `divider` and so on), so a color job naming it is never unclear.

Two things follow from the working-out:

- A very light base, like off-white, has steps 100 to 400 that are practically white: only its darker steps are useful.
- A saturated base keeps its chroma into the dark steps, so navy's 700 to 900 are deep, saturated blues rather than near-blacks. Hand-set them if a darker step looks too blue.

### The dark theme's colors

No step is hand-set. The steps as worked out (the base in bold):

| Color | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gold` | `#ffedcf` | `#ffda9a` | `#f3ca81` | `#e3bb72` | **`#d4ac63`** | `#a37d32` | `#725100` | `#3f2b00` | `#120a00` |
| `red` | `#ffd6d3` | `#ffaaa6` | `#ff7776` | `#ee484f` | **`#cd2435`** | `#9d001e` | `#6a0011` | `#3a0005` | `#100001` |
| `orange` | `#ffe1d7` | `#ffc1ad` | `#ff9f7f` | `#fe794c` | **`#e56335`** | `#b53b00` | `#7a2500` | `#441100` | `#140200` |
| `navy` | `#c1dbff` | `#8fb6ed` | `#6c91c6` | `#4b6ea1` | **`#2b4d7d`** | `#153664` | `#00204c` | `#000e28` | `#000209` |
| `offWhite` | `#fcfdff` | `#fafbfd` | `#f8f9fb` | `#f6f7f9` | **`#f4f5f7`** | `#b5b6b8` | `#7a7b7d` | `#444446` | `#141516` |

## The palette

The **palette** says what the theme's main colors are for, shaped as MUI's palette is. Each of its colors names a step of the theme's colors, or gives a color directly; it can't name another of the palette's.

| Setting | What it's for | Dark theme |
| --- | --- | --- |
| `palette.primary` | The globe and every surface: `main`, `light`, `dark`, and `contrastText`, text on `main` | `navy.500`, `navy.300`, `navy.700`; `offWhite.500` |
| `palette.secondary` | The accent: gold, as every game is today. The statuses' colors name gold's steps themselves; a league chip that's on names it (`main` for its outline and glow, `light` for its text), as does the welcome tour's switch in My leagues (`main` when on, with a knob in `contrastText`) | `gold.500`, `gold.300`, `gold.700`; `navy.800` |
| `palette.live`, `.upcoming`, `.final` | A game's color, by status, unless the viewer picked one for its sport or league: its small pin's ring and glow, its score card's outline, header and glow, its trail, a cluster's outline, glow and count, its pulse, and the game panel's top edge and progress line. Text written on it is `text.primary` or `background.paper`, whichever reads better, so a status has no `contrastText` (see [How a game's status shows](#how-a-games-status-shows)) | `gold.500`, `.300`, `.700` for each |
| `palette.error`, `palette.warning` | Errors and warnings: the Feedback panel's error, and its counter past the limit, in `error.light`; nothing uses `warning` yet (league colors are the viewer's, in Display Settings on the rail) | `red` and `orange`, at 500, 300 and 700; `offWhite.500` and `navy.800` |
| `palette.background.default` | The page behind everything | `navy.900` |
| `palette.background.paper` | The surfaces on it: the game panel, the menus and the controls | `navy.800` |
| `palette.text.primary` | Main text on the game panel, the rail and the scenario controls | `offWhite.500` |
| `palette.text.secondary` | Secondary text: the game panel's league and labels and the lines under a venue or a time; league chips that are off, and the count on the "All leagues" chip | `offWhite.600` |
| `palette.text.link` | Links (the game panel's watch links and its ESPN link) | `offWhite.500` |
| `palette.divider` | The lines between a menu's parts (between the rail's buttons, under "All leagues") | `navy.600` |
| `palette.action.hover` | Behind a control under the pointer (a scenario in the list, a speed key) | `navy.600` |

The statuses' colors and `text.link` are ScoreMap's own, beside MUI's. MUI works out a color's `light`, `dark` and `contrastText` from its `main` when they're left out; ScoreMap's palette gives them all (a status's color has no `contrastText`), so each is a step that can be seen and changed.

## Color jobs

A **color job** is what a color is for (the globe's surface, Live's color, main text), not which color it is. Each takes one of:

- a step of the theme's colors by name: `"navy.700"`;
- outside the palette, one of the palette's colors by name, as MUI's `sx` takes one: `"primary.dark"`, `"text.secondary"`, `"background.paper"`, `"divider"`; or
- a color given directly, in a form both CSS and MapLibre read, since it's passed on to both as written: a hex color of 3, 4, 6 or 8 digits (`#abc`, `#abcd`, `#0b1526`, `#0b152680`); `rgb(…)` or `rgba(…)`, its three channels all numbers or all percentages; `hsl(…)` or `hsla(…)`, a hue (in degrees, `deg` optional) and two percentages; each function's arguments comma-separated with an optional fourth for alpha (`rgba(255, 255, 255, 0.7)`), or space-separated with an optional `/ alpha` (`rgb(10% 20% 30% / 50%)`); or `transparent` (for a shadow or glow that isn't there). Named colors such as `red` aren't taken: `red` would read as a step's name. This is the escape hatch for a one-off the theme's colors don't fit, at the cost of that color no longer following them.

The dark theme names one of the palette's colors where a job is what that palette color is for (a surface is `background.paper`, main text `text.primary`) and a step where it's a shade of its own (place names' paler navies), and gives the four shadows `transparent`. Every color job, by where it shows:

### The globe

| Setting | What it colors | Dark theme |
| --- | --- | --- |
| `components.Globe.surface` | The globe: land and sea alike | `primary.main` |
| `components.Globe.coastlines.color` | The edges of the sea (lakes and rivers aren't outlined) | `primary.light` |
| `components.Globe.countryBorders.color` | Country borders | `primary.light` |
| `components.Globe.stateLines.color` | State and province lines | `navy.400` |
| `components.Globe.disputedBorders.color` | Disputed borders, dashed | `navy.400` |
| `components.Globe.halo.inner.color` | The halo close around the globe's edge | `navy.400` |
| `components.Globe.halo.outer.color` | The halo's wider, fainter outer glow | `primary.dark` |
| `components.PlaceNames.<kind>.color` | A kind of place's name: `city` (national capitals included), `state`, `country` | city `navy.200`, state `primary.light`, country `navy.200` |
| `components.PlaceNames.<kind>.outline.color` | The outline around its letters | `navy.600` for every kind |
| `components.Sky.color` | The sky around the globe | `background.default` |
| `components.Sky.stars.white`, `.cool`, `.warm` | The scattering of stars in the sky | `offWhite.500`, `navy.100`, `gold.100` |

### Games on the globe

| Setting | What it colors | Dark theme |
| --- | --- | --- |
| `palette.<status>.main` | A game's color, by status (`live`, `upcoming`, `final`; see [The palette](#the-palette)) | `gold.500` for each |
| `components.Pin.<status>.core.color` | A small pin's bright core. One that's its status's color is drawn in the game's color; any other (Live's paler core) stays, so status shows by brightness | Live `gold.100`; the others their status's color (`upcoming.main` and so on) |
| `components.Cluster.fill` | The disc of a pin cluster or card cluster | `primary.dark` |
| `components.Selection.color` | The selected game's pin ring and score card outline | `offWhite.500` |
| `components.ScoreCard.fill` | A score card's fill, tinting its glass (see [Glass](#glass)) | `primary.dark` |
| `components.ScoreCard.text` | A score card's text | `text.primary` |
| `components.ScoreCard.shadow` | The drop shadow a starting game's score card settles with | `background.default` |

### Panels and controls

Beside the palette's background, text, divider and hover:

| Setting | What it colors | Dark theme |
| --- | --- | --- |
| `components.Controls.surface` | The "No games right now." message, and the Feedback button and panel | `background.paper` |
| `components.Controls.shadow.color` | Their drop shadow | `transparent` |
| `components.Controls.on.fill`, `.text` | A speed key that's on, and the Feedback panel's Submit | `offWhite.500`, `navy.800` |
| `components.GamePanel.surface.top`, `.bottom` | The game panel (on a desktop, its venue part and band), shading from top to bottom | `background.paper`, `background.paper` (solid) |
| `components.GamePanel.scoreBlock.top`, `.bottom` | The game panel's score block, shading from top to bottom: on a desktop the tint of its glass (see [Glass](#glass)) | `primary.dark`, `primary.dark` |
| `components.GamePanel.score.fill`, `.text` | A team's score box on the game panel; on a desktop the box is a pane of the score block's glass instead, only its text this color | `navy.600`, `text.primary` |
| `components.GamePanel.unofficial` | The note on unofficial stream links | `text.secondary` |
| `components.GamePanel.photo.glow` | The glow behind the venue and its watch links when the venue has no photo | `navy.600` |
| `components.GamePanel.shadow.color` | The game panel's drop shadow | `transparent` |
| `components.Rail.surface` | The rail's groups of buttons and its popovers (Leagues, Display Settings and Games); on local runs, the top rail and its Scenario popover too | `background.paper` |
| `components.Tooltip.surface` | A tooltip (see [Tooltips](#tooltips)) | `background.paper` |
| `components.Rail.shadow.color` | Their drop shadow | `transparent` |
| `components.Rail.open` | A rail button's icon while its popover is open, the count on the Games button, and the ring round the map showing in Map Type | `secondary.main` (gold) |
| `components.Rail.count` | The count of leagues that are on, after a sport's name and on the "All leagues" chip (in `Rail.on.text` while a sport's are all on) | `text.secondary` |
| `components.Rail.hint` | The hint beside "All leagues" | `text.secondary` |
| `components.Rail.chip.outline` | A league chip's outline, and "Reset colors"' | `primary.main` |
| `components.Rail.chip.badge` | The badge counting leagues, after a sport's name and on the "All leagues" chip | `primary.dark` |
| `components.Rail.on.fill`, `.outline`, `.text` | A league chip that's on, lit as a Live score card is: its fill, with `Rail.on.tint` of its outline's color mixed in (0.14), its outline and glow (`Rail.on.glow.radius` and `.opacity`, 8 and 0.35), and its text. The chosen "Top Events" or "My leagues" is underlined in the outline's color, and the welcome tour's Next and Done buttons are lit the same way | `primary.dark`, `secondary.main`, `secondary.light` |
| `components.LoadingScreen.dim.color` | The dim over the globe while ScoreMap loads, as opaque as `components.LoadingScreen.dim.opacity` (see [On the page](#on-the-page)) so the globe shows through | `background.default`, as the sky |
| `components.LoadingScreen.rocket.color` | The loading screen's flying rocket: its body, fins and speed lines (its window is the dim's color) | `text.primary` |
| `components.LoadingScreen.rocket.flame` | The flame under the rocket | `secondary.main` |
| `components.LoadingScreen.message` | The message under the loading screen's rocket when loading is slow | `text.primary` |

A league that's on is lit in gold, as a game is, rather than filled in off-white: a white chip stood out against the dark theme. A lit speed key and the selection stay off-white; a rail button whose popover is open is gold.

## How a game's status shows

A game's status shows by **brightness and glow, not color** (ADR-0012). Color is the strongest signal on a map, so it's kept to stand for a game's sport or league, in a color the viewer picks in Display Settings on the rail (ADR-0017). With none picked, the dark theme gives every game the one gold. Disrupted games (postponed, suspended or canceled) aren't shown, so have no look (ADR-0021).

- **Live** glows widest and its small pin has a bright core.
- **Upcoming** glows less and is a little dimmer.
- **Final** has no glow and fades.

A score card fades by color, not by being see-through: its game's color, text and logos are mixed into its fill. A card of clear glass (see [Glass](#glass)) fades the same way, keeping its status look.

Each status still has its own color in the palette, though all three are the same gold, so a theme that shows status its own way (a light theme, where glows barely show) can change them without a new setting. A color the viewer picks takes the place of its status's, and text written on it (the game panel's progress line) is the theme's main text or its paper surface, whichever stands out from it more.

A status's color is the palette's; the rest of its look is each component's own, as MUI's components style each color they come in, so a component's settings hold all of how it looks:

| Setting | What it is |
| --- | --- |
| `palette.<status>` | The game's color, and the text written on it (see [The palette](#the-palette)) |
| `components.Pin.<status>.core.color`, `.radius`, `.opacity` | A small pin's bright core: its color, radius in pixels and opacity |
| `components.Pin.<status>.core.ring` | The width of the ring of the game's color around the core, in pixels (0 is no ring) |
| `components.Pin.<status>.glow.radius`, `.opacity` | The soft glow around a small pin: its radius out to where it's faded to nothing, and its opacity at the middle (radius 0 is no glow) |
| `components.Cluster.<status>.opacity` | How opaque a pin cluster or card cluster showing as this status is: its disc, outline and count alike. A venue cluster doesn't fade, as a venue dot doesn't |
| `components.ScoreCard.<status>.fade` | How far its score cards fade, from 0 (not at all) to 1 (all the way, a blank card). A card stays solid: its game's color (its outline, header, pointer and glow), its text and its logos are mixed this far into the card's fill. The selected game's card doesn't fade |
| `components.ScoreCard.<status>.glow.radius`, `.opacity` | How far and how strongly its score cards glow in its color (radius 0 is no glow). The CSS works out the rest from these: an inner glow 1.25 times as far at a third of the opacity |

The dark theme's:

| Status | Color | Pin core | Pin glow | Cluster | Card fade | Card glow |
| --- | --- | --- | --- | --- | --- | --- |
| Live | `gold.500` | `gold.100`, 3.5px, opacity 1, 1.5px ring | 15px at 0.8 | 1 | 0 | 12px at 0.8 |
| Upcoming | `gold.500` | `upcoming.main`, 3px, 0.9, no ring | 9px at 0.4 | 0.9 | 0.15 | 4px at 0.3 |
| Final | `gold.500` | `final.main`, 2.5px, 0.5, no ring | none | 0.55 | 0.45 | none |

The card fades are what the cards' opacities were before cards were made solid (1 minus 1, 0.85 and 0.55), so they look as close to that as a solid card can.

How status reaches the rest of the globe:

- **Clusters** show as the most prominent status among their games (Live, then Upcoming, then Final). A pin or card cluster glows as strongly as `components.Cluster.glowOpacity` times its status's pin glow opacity, so a cluster of a status whose pins don't glow doesn't either. In the dark theme that's 0.6, so a Live cluster glows at 0.48. A cluster's color (outline, glow and count; a venue cluster's dot and ring) is the game color its games share, or the accent (`palette.live.main`) when their colors differ.
- **Pulses** play in the game's color, over its small pin, score card or cluster alike. A score and a start play the same pulse: one small ring over a small pin or a cluster, and the card's edge lit over a score card, which doesn't move (a pop there made cards jump). A finish plays none.
- **The selected game** is outlined in `components.Selection.color`, off-white, apart from the gold of every other game, and its score card and trail are picked out as a hovered one's (see [Hover](#hover)).
- **Glow means a game.** Panels and controls have no glow: in the dark theme the game panel's glow has opacity 0, and their drop shadows are `transparent`, so they cast none (see [Glass](#glass)).
- **Pin clustering** depends on the widest pin glow: small pins gather into pin clusters when their glows (at 0.6 of their radius) would overlap. Widening Live's glow makes pins cluster sooner.

### Hot games' flames

A hot game (see [`GLOSSARY.md`](../GLOSSARY.md)) shows fire around its whole edge, gone as soon as it stops being hot. The chosen look is E for cards and option 14, Gentle crawl, for pins and clusters, from the local throwaway branch `prototype-flame-looks`.

- A **score card** has a glowing fire outline around all four sides, with warm highlights crawling around it once every 2.4 seconds and a lightly flickering glow. The card's box is cut out of the effect, so no fire shows through its glass. There are no floating embers.
- A **small pin** has a thin fire outline around its core and ring, with a steady soft glow. Its highlight turns slowly, once every 7.68 seconds.
- A **pin cluster** or **card cluster** holding a hot game has the same slowly moving outline around its disc, as faded as the cluster. A **venue cluster** has none, as its games' cards are on screen, fire and all.

The fire is in **fire's colors**, wherever it shows, so hot games look the same across leagues: the one place color doesn't say league (ADR-0012). With reduce motion on, every fire outline and glow stays visible and still; changing that setting while the app runs stops or resumes the motion.

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.ScoreCard.flames.width` | Width of the fire outline outside the card's edge, in pixels | 3 |
| `components.ScoreCard.flames.glow.radius`, `.spread`, `.opacity` | The surrounding glow's blur and outward reach, spread (pixels), and strength. A tighter glow of the tips' color follows the outline | 14.4, 4.32, 0.75 |
| `components.ScoreCard.flames.tips`, `.middle`, `.core` | Shared fire colors: red, orange and white-hot highlights, on cards, pins and clusters | `#d42a12`, `#ff8a00`, `#fff3a8`, given directly as none of the theme's colors is fire's |
| `components.Pin.flame.size` | How far a small pin's fire glow reaches beyond its core and ring, in pixels | 6.6 |
| `components.Cluster.flame.size` | How far a pin or card cluster's fire glow reaches beyond its outline, in pixels | 7.2 |
| `components.Pin.flame.width`, `.opacity`, `.glowOpacity` | Small pins' fire outline width (pixels), its opacity and its glow's opacity | 1.5, 0.9, 0.4 |
| `components.Cluster.flame.width`, `.opacity`, `.glowOpacity` | The same settings for pin and card clusters | 1.5, 0.9, 0.4 |

The gradients' shapes, the card glow's tighter band and flicker, and animation timing stay in code. The globe updates the pixels of each used fire image in place; it keeps one image per size and color, and stops scheduling animation when the image is no longer used.

### Glass

Score cards are glass (ADR-0018): a pane the globe shows through, tinted with the card's fill (`components.ScoreCard.fill`). So, on a desktop, is the game panel's score block: the globe shows through it blurred, tinted with the score block's colors as solid as `components.GamePanel.frost` (0.55 in the dark theme), its top and left edges lit; its scores sit on panes of the same glass, a faint light tint with a hairline rim, and its records are lifted off it. The rest of the panel, and the score block on a phone (where the venue's photo fills the panel), is solid. Everything else over the globe is solid, its theme surface color with nothing behind it blurred, so its contents stay readable (ADR-0023): the rest of the game panel, the rail's groups and popovers (including Map Type, Games, Leagues and Display Settings, and the top rail on local runs), welcome tour panels, the no-pins message, the demo label, the Feedback button and panel, and tooltips. Pins are unchanged.

A score card's glass has a **frost**, from 0 to 1 (`components.ScoreCard.frost`, 0.6 in the dark theme):

- at **0**, clear glass: the globe behind is sharp, its color lifted; the edges catch the light, brightest at the top left, with a faint sheen across;
- at **1**, opaque: the card's fill, solid.

In between, the fill is as solid as the frost, while the edges and sheen dim, and the card casts a soft shadow onto the globe in the background's color. The frost clears more than the fill: its header's tint, its status glow inside it and its logo plates clear with it too, so at 0 a card is only its edge, text and logos, and its outline and glow outside keep its status look (Live's glow, Final's fade). Logos drawn for a light background are harder to see the clearer the glass. A score card's glass isn't blurred, whatever its frost: the globe behind it shows sharp under its tint (ADR-0018), so its frost is how solid that tint is.

Trails let the map show through by their own `opacity` (see [On the globe](#on-the-globe)), their glow keeping its own.

### Tooltips

Tooltips are drawn by the page, not the browser, whose own can't be styled: anything on the page with a `data-tooltip` shows it in a small panel (`web/src/tooltip/Tooltips.tsx`), centered above it, or below where there's no room (beside a rail button, level with it on its left, so it covers none of the others), after the pointer rests on it half a second, or at once on keyboard focus. It eases in from what it's for, or shows at once with reduce motion on, and goes on the pointer leaving, a press, Escape or a scroll. The app sets no `title`, so the browser never shows a tooltip of its own; only the local-run tools keep the browser's.

### Hover

While the pointer is on a score card, its game is picked out: the card's border is bolder, and so are its trail and the venue dot the trail ends at, the dot lit in a glow of the game's color. Its settings are `components.Hover`: `card.borderWidth` and `card.solid` (whether a card frosts over fully, as if its frost were 1, written to CSS as `1` or `0`), `trail.width` and `.opacity` (the hovered trail's own, in place of the trail's opacity; the venue dot's ring takes the width too), and `venue.radius` and `.glow.radius`, `.opacity`. The bolder border is drawn as a ring around the card, so a hovered card keeps its size and never moves. The card eases into its hover look, or changes at once with reduce motion on; the trail and dot change at once. The selected game's card and trail keep this look for as long as it's selected, so it shows on touch screens too, where a tap selects; selection's outline is drawn around it as well. Deselecting it, or selecting another game, returns it to normal.

## Typography

The page's text is one font family, `typography.fontFamily`, in **type styles**, MUI's typography variants: each a `fontWeight` (1 to 1000), a `fontSize` in pixels and a `letterSpacing` in ems. The page's CSS chooses which type style each kind of text is, as a component's styles choose a variant in MUI; a theme changes how a type style looks, not which one a thing uses. Some text takes a style's weight but stays at the size of the text around it (a score card's team abbreviations and scores), or a style's size in another's weight (the game panel's close button).

| Type style | Which text | Dark theme |
| --- | --- | --- |
| `h6` | Scores on the game panel; a score card's scores take its weight | 700, 20 |
| `subtitle1` | Team names on the game panel; a score card's team abbreviations take its weight | 700, 16 |
| `subtitle2` | A score card's clock line, and the rest of its text | 600, 12 |
| `body1` | Body text | 400, 16 |
| `body2` | The game panel, the rail's popovers, the scenario clock and the loading screen's message | 400, 14 |
| `button` | Buttons: sport names in Display Settings, league chips, the scenario pill and the scenario it has on, the game panel's close button | 600, 14 |
| `caption` | Secondary lines: the game panel's notes and stream links, the counts and hint in Leagues; tooltips; the game panel's close button takes its size | 400, 12 |
| `overline` | The game panel's headings: its league and labels, tracked out, and its progress line; a sport's name in Leagues, in capitals | 700, 12, 0.14em |
| `footnote` | The smallest on the page: a score card's header line, and the game panel's labels on a phone | 400, 11 |

`footnote` is ScoreMap's own, smaller than MUI's `caption`. The dark theme writes everything in `'Open Sans Variable', 'Open Sans', sans-serif`, so the app looks the same on Windows, Mac and phones. The theme gives only the family: the font itself has to be loaded by the app. Open Sans is bundled with it (`@fontsource-variable/open-sans`, imported in `web/src/main.tsx`, weights 300 to 800), so a theme using another web font needs its loading added in code. Scores keep their digits lined up as they change: the CSS asks for tabular figures, and Open Sans's figures are already tabular.

Text on the globe is drawn in other fonts (see [Text on the globe](#text-on-the-globe)), but its sizes are type styles' sizes.

## Spacing and shape

- **`spacing`**: the spacing unit, in pixels: every padding, margin and gap on the page is a number of them, as MUI's `theme.spacing(n)` gives one. The CSS writes `calc(3 * var(--spacing))`. Cards stay tight on a few units and panels roomy on more, from the same unit. The dark theme's is 4, so its spaces are 2, 4, 6, 8, 12, 16, 24 and 32 pixels (half a unit to 8).
- **`shape.borderRadius`**: the corner radius, in pixels, every corner is a number of (below), as MUI's `sx` takes `borderRadius: 2`. The dark theme's is 4. Circles (clusters) stay circles whatever it is.
- **`shape.borderWidth.thin`, `.medium`, `.thick`**: the page's borders and dividers. The score card's border and header line, dividers and league chips are `thin`, a color swatch's ring `medium`, the game panel's top edge `thick`. The dark theme's are 1, 2 and 3.

### Corners and the cut corner

Each component's corners are a number of corner radii, or `"pill"`, round enough to make any control a pill:

| Setting | Which corners | Dark theme |
| --- | --- | --- |
| `components.ScoreCard.corner` | A score card's | 1.5 (6px) |
| `components.GamePanel.corner` | The game panel's | 2 (8px) |
| `components.Menu.corner` | A menu's: the rail's groups, buttons and popovers, the Feedback panel and its text box, a tooltip | 2 (8px) |
| `components.MenuItem.corner` | An item's in a menu | 1.5 (6px) |
| `components.Controls.message.corner` | A message's, such as "No games right now." | 2 (8px) |
| `components.Controls.corner` | A control's: a speed key, league chips, "Reset colors", the Feedback panel's buttons | `pill` |

The **cut corner** cuts off the game panel's bottom left corner, like a broadcast graphic, for a more angular theme: `components.GamePanel.cutCorner.on` (`true` or `false`) and `.size`, how far along each side, in spacing units. It's beveled (CSS `corner-shape`) rather than clipped, which would stop the score block's glass seeing the globe, and only on a desktop. The dark theme has it off (size 4, unused). The panel's top right corner is square, where the close button's tab rises from it, and on a phone (640px wide or less) every corner is.

### Logo plates

Every team logo, on a score card and in the game panel, sits on a **plate**: a block of a color that contrasts with the card's fill and the panel, so that a logo near their color (a navy logo on a navy card) can still be seen. A missing logo leaves its space empty, with no plate. A score card's plate fades into its fill with the logo as the card fades. A plate is as solid as the glass it's on is frosted, so on clear glass there's none (see [Glass](#glass)).

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.ScoreCard.logo.plate.fill`, `components.GamePanel.logo.plate.fill` | The plate's color (a color job) | `offWhite.500`, `offWhite.500` |
| `components.ScoreCard.logo.plate.padding`, `components.GamePanel.logo.plate.padding` | How far the plate reaches past the logo on each side, in spacing units. The logo keeps its size (`size.logo`); the plate adds to it | 0.5 (2px), 1 (4px) |
| `components.ScoreCard.logo.plate.corner`, `components.GamePanel.logo.plate.corner` | The plate's corners, in corner radii or `"pill"` | 0.5 (2px), 1 (4px) |

The logos are ESPN's usual ones, drawn for a light background, which the plate gives them. ESPN also lists a logo for dark backgrounds for most teams, but for about half of them it's the same picture, and the feed's scoreboard doesn't carry it, so ScoreMap doesn't use it: the plate is the fix for every team alike.

## Other sizes

Sizes that aren't a type style's, a number of spacing units or of corner radii are free values: pixels, any number from 0 up (an offset may be negative), or ems where a size goes with its text and should grow with it (letter spacing, which may be negative, and boxes sized to their characters). The dark theme keeps the look before it for all of these.

### On the globe

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.Globe.<line>.width` | A line's width by zoom, for `coastlines`, `countryBorders`, `stateLines` and `disputedBorders`: a width at each of some zoom levels (`{ "2": 0.6, "8": 1.2 }`), growing evenly between them; one zoom level is a fixed width | coastlines 0.6 to 1.2 (zoom 2 to 8), country borders 0.6 to 1.4 (2 to 8), state lines 0.5 to 1 (3 to 8), disputed borders 0.8 |
| `components.Globe.disputedBorders.dash` | The disputed borders' dash pattern: the lengths of the dashes and the gaps between them, in line widths, at least two | `[2, 2]` |
| `components.Globe.halo.inner.blur`, `.spread`, and `outer`'s | How far each of the halo's glows blurs and spreads, growing with the globe on screen: `{ share, max }`, that share of the globe's radius on screen, but never more than `max` pixels | inner blur 0.12 up to 60, spread 0.04 up to 20; outer blur 0.35 up to 160, spread 0.08 up to 40 |
| `components.PlaceNames.<kind>.outline.width`, `.blur` | The outline around a place name's letters | 2 and 0.5; state names 1.2 and 0 |
| `components.Cluster.radius.few`, `.some`, `.many` | A pin cluster's disc by how many games it holds: up to 4, up to 14, more. A card cluster is as wide as `some`, outline and all | 11, 13, 16 |
| `components.Cluster.glowRadius.few`, `.some`, `.many` | Its glow's radius, likewise | 22, 26, 32 |
| `components.Cluster.outlineWidth` | A cluster's outline | 1.5 |
| `components.Cluster.glowOpacity` | A cluster's glow, as a share of its status's pin glow opacity (0 to 1) | 0.6 |
| `components.Trail.width`, `.opacity` | A moved score card's trail back to its venue: its width, and how opaque it is, below 1 letting the map show through | 1.25, 0.63 |
| `components.Trail.glow.width`, `.blur`, `.opacity` | The soft glow along a trail | 4, 3, 0.25 |
| `components.Trail.venue.radius` | The dot at the trail's venue | 2 |
| `components.Trail.venue.ring.radius`, `.width` | The ring around that dot. A venue cluster is the same dot and ring | 5, 1 |
| `components.Selection.width` | The selected pin's ring and score card's outline. The ring reaches as far out whatever its width | 2 |
| `components.Hover.trail.width`, `.opacity` | A hovered card's trail, and its venue dot ring's width (see [Hover](#hover)) | 2.5, 1 |
| `components.Hover.venue.radius` | A hovered card's venue dot | 3.5 |
| `components.Hover.venue.glow.radius`, `.opacity` | The glow around that dot, in its game's color | 12, 0.6 |
| `components.Pulse.size.pin`, `.cluster` | How wide a pulse's ring starts, over a small pin and over a cluster | 16, 36 |
| `components.Pulse.ring` | How thick a pulse's ring is | 3 |

### On the page

Game-panel team and player names wrap in the existing logo, rank, name, record and score rows, without a line limit or hover requirement. The strip grows with the names; the panel never scrolls, on any screen.

The game panel's strip is the score block (the league, the score, the progress line, and the last score under its label, on one line, cut short with an ellipsis and in full on hover), then the venue's name and place at the top and, at the foot, a "Game page on ESPN" link over the watch links (the first two, on one line), over the venue's photo. A game ESPN lists no page for has no ESPN link, and one that lists no watch links has no Watch line. On a desktop the score block is glass (see [Glass](#glass)), and the photo fills the rest of the strip right up to the score block's slanted edge, dimmed to `components.GamePanel.photo.opacity`; with no photo, a faint glow holds its place. There's no Sport, and no "Venue" label. A band under the strip, on the panel's own surface with no photo, holds a field's leaderboard, a fight card's bouts or a tennis match's sets, when the game has them; a game with none has no band. The close button is on a small tab in the game's color, rising from the panel's lit top edge at its right end, so it covers nothing. When a team scores, its row lights up (see [Where the theme reaches](#where-the-theme-reaches)): the light reaches a little past the row, as far beyond the logo as beyond the score, its right edge on the score box's slant.

At viewport widths up to 960px, the photo fills the whole panel, behind the score block and the band too, the score block has no color of its own, and a fade behind each line of it, dark under the logo and name and clearing by the score, keeps it readable over the photo. The score block uses the full panel width, then the band, then the venue in the bottom left corner and the ESPN link and watch links in the bottom right, the ESPN link over Watch's label, which is over its links, all spaced more tightly than on a desktop (the padding and gaps about a third smaller), so the panel takes less of a phone's screen. At 640px wide or less the panel runs edge to edge along the bottom of the screen. The photo's credit isn't shown (ADR-0025). This grew from variant K in the comparison preserved on the throwaway branch `phillipbritain/game-panel-prototype`, selected by the user on November 10, 2026, and was tuned with them on November 11.

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.GamePanel.shadow`, `components.Rail.shadow`, `components.Controls.shadow` | A drop shadow: `{ x, y, blur, color }`, how far it falls across and down, how far it blurs, and its color | none (`transparent`, blur 0) |
| `components.GamePanel.glow.y`, `.blur`, `.opacity` | The glow in the game's color along the game panel's top | 0, 0, 0 (none) |
| `components.Hover.card.borderWidth`, `.solid` | A hovered score card's border width, and whether it frosts over fully (see [Hover](#hover)) | 2.5, on |
| `components.ScoreCard.header.tint` | How strongly a score card's header is tinted with its game's color, 0 to 1, at a frost of 1: the tint clears with the card's glass (see [Glass](#glass)). The header's text is the card's text or its fill, whichever reads better on the tint | 0.28 |
| `components.ScoreCard.header.letterSpacing` | How far apart the letters of a score card's header line are spaced, in ems | 0.06 |
| `components.Controls.off.opacity` | How opaque a speed key that's off, a rail button that can't be used (zoom at its limit) and "Reset colors" with no colors to reset are, 0 to 1 (a speed key that's on, or under the pointer, is opaque) | 0.6 |
| `components.LoadingScreen.dim.opacity` | How opaque the loading screen's dim is over the globe, 0 to 1 | 0.6 |
| `components.WelcomeTour.dim.opacity`, `.arrow.width` | How opaque the welcome tour's dim is over the globe (in the background's color, under a step's panel and around its spotlight), 0 to 1, and how wide the flowing arrow from a step's panel is | 0.3, 2.5 |
| `components.Sky.stars.size.small`, `.large` | The stars in the sky around the globe, small and large | 1, 1.5 |
| `components.GamePanel.photo.opacity` | How opaque the venue's photo is behind the venue and its watch links (on a phone, behind the whole panel), 0 to 1 | 0.4 |
| `components.GamePanel.size.width` | The game panel's width at most | 1200 |
| `components.GamePanel.size.height` | The strip's minimum height on a desktop; it grows for wrapped names. On a phone the panel is as tall as its contents | 140 |
| `components.GamePanel.size.scoreBlock`, `.slant` | The score block's maximum width (also capped at 42% of the desktop panel), and how far its right edge slants | 504, 16 |
| `components.GamePanel.size.logo` | A team's logo | 28 |
| `components.GamePanel.size.close.width`, `.height` | The close button's tab, above the panel's top right corner | 28, 18 |
| `components.GamePanel.size.scoreWidth` | A team's score box, in ems of its digits: wide enough for three, so a score of 100 moves nothing | 2.6 |
| `components.ScoreCard.size.minWidth` | A score card's narrowest | 92 |
| `components.ScoreCard.size.logo` | A team's logo on a score card | 16 |
| `components.ScoreCard.size.venueGap` | How far above its venue a score card sits, and how near it may come when moved aside, its trail between (the globe places cards by this) | 16 |
| `components.ScoreCard.size.nameClearance` | How far score cards keep clear of the letters of a city named for a game (its outline included; the globe lays cards out by this) | 4 |
| `components.Rail.size.button`, `.icon` | A button on the rail, and its icon; the Feedback button too, round | 36, 18 |
| `components.Rail.size.mapType` | Each map's picture in Map Type, square: a tile of the satellite map's imagery, and the plain map drawn small in the globe's surface, coastline and border colors | 64 |
| `components.Rail.size.width`, `.allLeagues` | A popover's width (on a phone, all the width left of the rail) and the Feedback panel's, the "All leagues" chip's height | 320, 32 |
| `components.Rail.size.countWidth` | The narrowest a count of leagues is, in ems | 3.2 |
| `components.Controls.size.key`, `.icon` | A speed key and its icon | 34, 14 |
| `components.LoadingScreen.rocket.size` | The loading screen's rocket, its box across | 64 |

## Text on the globe

The globe's text (place names and the count on a pin or card cluster) is drawn by MapLibre from the map's font server, fonts.openmaptiles.org, not from the page's fonts (ADR-0006). A globe font is given by the name the server knows it by, and must be one it has: for a font it lacks, the server answers with a web page rather than an error and the text falls back to a browser font, so checking rejects any other. The fonts it has (listed in `globeFonts`, `web/src/theme/globeFonts.ts`, checked in October 2026):

- **Open Sans**: Light, Light Italic, Regular, Italic, Semibold, Semibold Italic, Bold, Bold Italic, Extra Bold;
- **Klokantech Noto Sans**: Regular, Italic, Bold (it has no plain "Noto Sans");
- **Metropolis**: Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black, each also Italic.

Each is written in full, family and variant: `"Open Sans Semibold"`, `"Metropolis Black Italic"`.

| Setting | Which text | Dark theme |
| --- | --- | --- |
| `components.PlaceNames.<kind>.font` | A kind of place's name | city `Open Sans Semibold`, state `Open Sans Regular`, country `Open Sans Bold` |
| `components.PlaceNames.<kind>.size` | Its size by zoom: a type style, whose size it takes, at each of some zoom levels (`{ "4": "caption", "11": "h6" }`), growing evenly between them | city `caption` at zoom 4, `body2` at 7, `h6` at 11; state `footnote` at 3 to `body2` at 8; country `footnote` at 1 to `body1` at 4 |
| `components.PlaceNames.<kind>.letterSpacing` | How far apart its letters are spaced, in ems. State and country names are always in capitals, which want more | city 0, state 0.25, country 0.12 |
| `components.Cluster.count.font` | The count on a pin or card cluster | `Open Sans Bold` |
| `components.Cluster.count.size` | Its size, a type style's | `caption` |

## What checking rejects

A theme is checked when it's resolved, and every problem is listed, not just the first; checking never throws, whatever it's given. Checking rejects:

- a theme that isn't an object, or that has anything but `colors`, `palette`, `typography`, `spacing`, `shape` and `components`;
- missing colors, or colors, one of the theme's colors or a group of settings that isn't an object, or a color named as one of the palette's parts are;
- a missing setting anywhere in the theme, and **a setting the theme doesn't know** (a misspelled one shows as itself, as well as the real one missing), or a part of one of the theme's colors other than `base` and `steps`;
- one of the theme's colors whose base isn't a `#rrggbb` color, or a hand-set step that isn't `100` to `900` or isn't a `#rrggbb` color;
- a color job naming a color the theme doesn't have (an unknown color, an unknown step, or, in the palette, another of the palette's colors), or giving a color directly that isn't well formed (see [Color jobs](#color-jobs): `#12` or `rgb(1, 2)` is rejected), or that isn't a string. A job naming one of the palette's colors that has a problem of its own isn't rejected as well: the problem is listed once, where it is;
- a text size that isn't a type style, a spacing or corner that isn't a number (or, for a corner, `"pill"`), and a type style's size, the spacing unit or the corner radius that isn't a number of pixels;
- a size that isn't a number of pixels (or ems) from 0 up, an offset or letter spacing that isn't a number, an opacity or fade that isn't from 0 to 1, or a font weight that isn't from 1 to 1000;
- an on or off setting that isn't `true` or `false`, or a font family that's empty;
- a size by zoom with no zoom levels, or with a zoom level that isn't a number;
- a dash pattern that isn't two or more lengths from 0 up, or a halo size's share of the globe that isn't a number from 0 up;
- a globe font fonts.openmaptiles.org doesn't have.

It doesn't check how a theme looks: whether text reads against its surface, or whether the statuses can be told apart. That's for looking at it running (see [Making or changing a theme](#making-or-changing-a-theme)).

The built-in theme has a test (`web/src/theme/theme.test.ts`), so a broken theme fails its tests rather than shipping.

## Making or changing a theme

ScoreMap has one theme, built in, so making a theme today means changing `web/src/theme/builtInTheme.json`.

To try a change, edit the JSON on a local run: Vite reloads the page with it, on the page and on the globe alike. To see the loading screen, which shows once a page, use the `slow-initial-load` scenario (the `run-scoremap` skill), which holds it up for 15 seconds with its slow message.

1. **Colors first.** Choose the base colors and look at their worked-out steps (`paletteSteps` in `web/src/theme/palette.ts` works them out). Hand-set a step only where the worked-out one looks off.
2. **Then the palette:** which steps are the primary and secondary colors, each status's color, the background, the text, the divider and hover.
3. **Point every color job at one of the palette's colors or a step**, using the tables above. Keep a color given directly for a true one-off.
4. **Set the typography, spacing, shape, and each component's sizes, fonts and looks by status.** Status shows by glow and brightness: if the theme's glows don't show (a light theme), give status its own way through the statuses' colors and the pins', clusters' and score cards' opacities and cores.
5. **Run the tests** (`npm test` in `web/`). Checking reports what's wrong with the theme (see [What checking rejects](#what-checking-rejects)). No test holds the theme's choices, so a different look changes no test.
6. **Look at it running.** How the app looks isn't tested automatically: check it in the `worldwide`, `crowded` and `edge-cases` scenarios (the `run-scoremap` skill), on the globe zoomed out and in, with the game panel and the rail's popovers open, and on a phone-sized window.

### Adding a setting

A new setting goes in the settings in `web/src/theme/theme.ts` and in every theme's JSON, since a theme without it is rejected; its custom property then appears on the page by itself. A part's own look goes in its component, under `components`; what's shared goes where MUI keeps it, in the palette, the typography, `spacing` or `shape`. The page's CSS reads it through that custom property. Likewise a setting taken out must leave every theme's JSON, since a theme with a setting it doesn't know is rejected. Either way, change its count in the "writes every setting" test (`web/src/theme/applyTheme.test.ts`), which counts every setting written to the page by hand.

### What stays in code

Some of the look is in code on purpose, as behavior or layout rather than a theme's choices:

- motion: durations, easings and the shapes of the animations, including the sizes and opacities inside their keyframes;
- how a score card's glass works out from its frost (see [Glass](#glass)): how bright the edges and sheen are, and the shadow it casts; and the game panel score block's: how far it blurs, its lit edges, and its score boxes' panes and lifted records;
- the game panel's fade behind each line on a phone, and how far a scoring row's light reaches;
- the starfield's pattern (where each star sits in its tile, how bright it is, the tile's size) and skew angles;
- layout: line heights, percentages, and slots sized in lines (`lh`, such as the game panel's room for two lines of a venue);
- score card and pin footprints, card layout distances (`cardLayout.ts`), how far the selected pin's ring reaches, and where a city's name sits from its dot (`text-radial-offset: 1.2` ems zoomed out, `text-radial-offset: 1` zoomed in) and where it wraps (as the base map style has them);
- that a glow on the globe (a small pin's, a pin cluster's or a card cluster's) fades out all the way to its edge (`circle-blur: 1`): how far it reaches and how strongly it glows are the theme's;
- a flame's drawing, and a score card's tongues of flame: how many, their heights and pace (see [Hot games' flames](#hot-games-flames));
- icons' drawings: their shapes and line widths, in the units of their own `viewBox`, which the CSS sizes to the theme's sizes;
- which kinds of place are named in capitals (states and countries);
- that a text box is at least 16px on a touch screen, so Safari on an iPhone doesn't zoom the page in on focusing it;
- which type style, how many spacing units and which border width each thing on the page uses (the CSS), and which status is most prominent and draws on top (the status look, `web/src/globe/statusLook.ts`).

No test holds the code to this list; that's for review. While a look is being tried, a value may go straight into the CSS or the TypeScript. Once it's settled, it moves into the theme (see [Adding a setting](#adding-a-setting)), unless it belongs on this list.
