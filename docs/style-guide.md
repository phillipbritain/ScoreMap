# Style guide

How ScoreMap's look is made, so a theme can be made or changed without reading the code. It describes the theme as built: the settings in [`web/src/theme/theme.ts`](../web/src/theme/theme.ts) and the built-in dark theme, [`web/src/theme/builtInTheme.json`](../web/src/theme/builtInTheme.json). When they and this guide disagree, the code is right and this guide is stale.

The decisions behind it: [ADR-0011](adr/0011-themes-as-checked-json-with-a-palette.md) (themes as checked JSON, with colours worked out in OKLCH), [ADR-0014](adr/0014-themes-shaped-like-mui.md) (a theme shaped as MUI's is), [ADR-0012](adr/0012-colour-for-league-status-by-glow.md) (colour will stand for league; status shows by brightness and glow) and [ADR-0006](adr/0006-map-fonts-from-openmaptiles.md) (the globe's fonts come from fonts.openmaptiles.org). The words **theme**, **theme colours**, **palette**, **colour job** and **type style** are the glossary's ([`GLOSSARY.md`](../GLOSSARY.md)).

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

- The **theme colours** (`colors`) name a few base colours. Each is worked out into steps from light to dark (see [The theme's colours](#the-themes-colours)), as MUI's own colours (`@mui/material/colors`) come in steps.
- The **palette** says what the main colours are for, as MUI's does: `primary`, `secondary`, `error` and `warning`, and a colour for each game status (`live`, `upcoming`, `final`, `disrupted`), as MUI takes colours of a theme's own, each a `main` shade, a `light` and a `dark` one and the `contrastText` written on it; the `background`, `text`, `divider` and `action.hover`. Each names a step of the theme's colours (see [The palette](#the-palette)).
- The **typography** is one font family and the type styles, MUI's typography variants: `h6`, `subtitle1`, `body2` and so on (see [Typography](#typography)).
- **`spacing`** is the spacing unit every space on the page is a number of, as MUI's `theme.spacing` is, and **`shape`** the corner radius every corner is a number of and the page's line widths (see [Spacing and shape](#spacing-and-shape)).
- **`components`** has each part of ScoreMap's own look, by part, as MUI's `components` has each component's: the globe, place names, pins, clusters, trails, score cards, the game panel, the menus, the controls and the loading screen. A part that looks different by game status has a group for each (`components.Pin.live`, `components.ScoreCard.final`), as MUI's components style each colour they come in (see [How a game's status shows](#how-a-games-status-shows)). A part's colour jobs name a step or one of the palette's colours (`primary.dark`, `text.secondary`), so changing the palette changes every part that uses it.

Every setting is required, and nothing else is allowed: a theme missing a setting, or with one it doesn't know, is rejected (see [What checking rejects](#what-checking-rejects)). This is where a theme differs most from MUI's, which fills in whatever it isn't given: ScoreMap's built-in theme is the only one, so a setting left out is a mistake, not a default.

### Where the theme reaches

The code reads only the resolved theme, never the JSON:

- **The page** (the game panel, score cards, the settings menu, the scenario controls, the loading screen): the resolved theme is written to the page's root as CSS custom properties, one per setting, named by where it sits in the theme in kebab case, as MUI's CSS theme variables are. `palette.text.primary` is `--palette-text-primary`, `typography.body2.fontSize` is `--typography-body2-font-size`, `spacing` is `--spacing`, `palette.live.main` is `--palette-live-main`. A component's are named by the component alone: `components.ScoreCard.fill` is `--score-card-fill`, `components.GamePanel.surface.top` is `--game-panel-surface-top`. Sizes are written in pixels (`12px`), or in ems where they go with their text (`0.14em`), on or off as `1` or `0`, and a shadow as one CSS shadow (`0px 8px 30px #000e28`). A globe font is written as its `-name`, `-family`, `-weight` and `-style`. The page's CSS (`web/src/index.css`) reads a settled look's colours, fonts, text sizes, spacing, corners, sizes and opacities through these, rather than naming its own (see [What stays in code](#what-stays-in-code) for what it may name, and for a look still being tried). A space is a number of spacing units, `calc(3 * var(--spacing))`, as MUI's `theme.spacing(3)` gives it.
- **The globe**: its map style (surface, coastlines and borders), place names, the halo, pins, clusters, trails, the selected pin's ring and pulses read the resolved theme directly, since MapLibre needs the values themselves, not CSS custom properties. Widths and text sizes that change with zoom, the disputed borders' dash pattern and the halo's sizes are read only by the globe and aren't written to CSS.
- **The theme is chosen** to start in, in `web/src/main.tsx`, and **changes one way**, as the app runs: through `useTheme` (`web/src/theme/useTheme.ts`), which writes it to the page before the page paints and hands it down through `App` and `Globe` to the globe. The globe restyles itself in place (`GlobeMap.setTheme`): it sets just the map layer properties that differ between the two themes, redraws the halo, reclusters small pins and measures score cards afresh. Nothing is made again and the camera stays where it is. On a local run the theme tuner changes the theme this way (see [Making or changing a theme](#making-or-changing-a-theme)).

Motion isn't part of a theme: durations, easings and the animations' shapes stay in the CSS.

With the device's reduce motion setting on, changes still show but nothing moves or blinks. A score or a start plays the finish's calm dim on its score card, without the bounce or the pop. A Live score card's status light stays fully lit, so Live is told from Upcoming by its glow and brightness alone. Every pulse over a small pin or a cluster is a still ring that fades in and out in place without growing. The loading screen's spinner fades in and out in place instead of turning, and its dim goes at once when ScoreMap is ready instead of fading. Camera moves jump instead of easing: MapLibre does this for any camera move not marked `essential`, so none is.

## The theme's colours

Each of the theme's colours (`colors`) has a `base`, a `#rrggbb` colour, and optional hand-set `steps`:

```json
"navy": { "base": "#2b4d7d", "steps": { "900": "#020814" } }
```

**Steps** run from `100`, the lightest, to `900`, the darkest; `500` is the base colour itself. A colour job names one as `<colour>.<step>`, such as `navy.700`. The other steps are worked out in OKLCH, at the base colour's hue:

- lighter steps (100 to 400) go evenly in lightness from the base towards white, darker ones (600 to 900) evenly towards black, the lightest and darkest stopping a fifth of the way short of white and black;
- each keeps the base colour's chroma, or as much of it as sRGB can show at that lightness, so its hue doesn't drift.

OKLCH because its lightness looks even and its hue holds as a colour lightens, where mixing with white or black in sRGB, or HSL's lightness, drifts. A step that looks off can be **hand-set** under `steps`: it replaces that one step and leaves the rest as worked out. A hand-set step must be one of `100` to `900` and a `#rrggbb` colour. A colour can't be named as one of the palette's parts are (`primary`, `text`, `divider` and so on), so a colour job naming it is never unclear.

Two things follow from the working-out:

- A very light base, like off-white, has steps 100 to 400 that are practically white: only its darker steps are useful.
- A saturated base keeps its chroma into the dark steps, so navy's 700 to 900 are deep, saturated blues rather than near-blacks. Hand-set them if a darker step looks too blue.

### The dark theme's colours

No step is hand-set. The steps as worked out (the base in bold):

| Colour | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `gold` | `#ffedcf` | `#ffda9a` | `#f3ca81` | `#e3bb72` | **`#d4ac63`** | `#a37d32` | `#725100` | `#3f2b00` | `#120a00` |
| `red` | `#ffd6d3` | `#ffaaa6` | `#ff7776` | `#ee484f` | **`#cd2435`** | `#9d001e` | `#6a0011` | `#3a0005` | `#100001` |
| `orange` | `#ffe1d7` | `#ffc1ad` | `#ff9f7f` | `#fe794c` | **`#e56335`** | `#b53b00` | `#7a2500` | `#441100` | `#140200` |
| `navy` | `#c1dbff` | `#8fb6ed` | `#6c91c6` | `#4b6ea1` | **`#2b4d7d`** | `#153664` | `#00204c` | `#000e28` | `#000209` |
| `offWhite` | `#fcfdff` | `#fafbfd` | `#f8f9fb` | `#f6f7f9` | **`#f4f5f7`** | `#b5b6b8` | `#7a7b7d` | `#444446` | `#141516` |

## The palette

The **palette** says what the theme's main colours are for, shaped as MUI's palette is. Each of its colours names a step of the theme's colours, or gives a colour directly; it can't name another of the palette's.

| Setting | What it's for | Dark theme |
| --- | --- | --- |
| `palette.primary` | The globe and every surface: `main`, `light`, `dark`, and `contrastText`, text on `main` | `navy.500`, `navy.300`, `navy.700`; `offWhite.500` |
| `palette.secondary` | The accent: gold, as every game is today. No part names it, as the statuses' colours name gold's steps themselves | `gold.500`, `gold.300`, `gold.700`; `navy.800` |
| `palette.live`, `.upcoming`, `.final`, `.disrupted` | A game's colour, by status: its small pin's ring and glow, its score card's outline, header, status light and glow, its trail, a cluster's outline, glow and count, its pulse, and the game panel's top edge; `contrastText` is the game panel's progress line, written on it (see [How a game's status shows](#how-a-games-status-shows)) | `gold.500`, `.300`, `.700` for Live, Upcoming and Final, `offWhite.700`, `.600`, `.800` (grey) for Disrupted; `navy.800` |
| `palette.error`, `palette.warning` | Kept for errors and warnings, or league colours: no part uses them yet | `red` and `orange`, at 500, 300 and 700; `offWhite.500` and `navy.800` |
| `palette.background.default` | The page behind everything | `navy.900` |
| `palette.background.paper` | The surfaces on it: the game panel, the menus and the controls | `navy.800` |
| `palette.text.primary` | Main text on the game panel, the settings menu and the scenario controls | `offWhite.500` |
| `palette.text.secondary` | Secondary text: the game panel's league and labels and the lines under a venue or a time; the settings gear; league chips that are off, and the count on the "All leagues" chip | `offWhite.600` |
| `palette.text.link` | Links (the game panel's stream links) | `offWhite.500` |
| `palette.divider` | The lines between a menu's parts (under the settings tabs, under "All leagues") | `navy.600` |
| `palette.action.hover` | Behind a control under the pointer (a scenario in the list, a speed key) | `navy.600` |

The statuses' colours and `text.link` are ScoreMap's own, beside MUI's. MUI works out a colour's `light`, `dark` and `contrastText` from its `main` when they're left out; ScoreMap's palette gives all four, so each is a step that can be seen and changed.

## Colour jobs

A **colour job** is what a colour is for (the globe's surface, Live's colour, main text), not which colour it is. Each takes one of:

- a step of the theme's colours by name: `"navy.700"`;
- outside the palette, one of the palette's colours by name, as MUI's `sx` takes one: `"primary.dark"`, `"text.secondary"`, `"background.paper"`, `"divider"`; or
- a colour given directly, in a form both CSS and MapLibre read, since it's passed on to both as written: a hex colour of 3, 4, 6 or 8 digits (`#abc`, `#abcd`, `#0b1526`, `#0b152680`); `rgb(…)` or `rgba(…)`, its three channels all numbers or all percentages; `hsl(…)` or `hsla(…)`, a hue (in degrees, `deg` optional) and two percentages; each function's arguments comma-separated with an optional fourth for alpha (`rgba(255, 255, 255, 0.7)`), or space-separated with an optional `/ alpha` (`rgb(10% 20% 30% / 50%)`); or `transparent` (for a shadow or glow that isn't there). Named colours such as `red` aren't taken: `red` would read as a step's name. This is the escape hatch for a one-off the theme's colours don't fit, at the cost of that colour no longer following them.

The dark theme names one of the palette's colours where a job is what that palette colour is for (a surface is `background.paper`, main text `text.primary`) and a step where it's a shade of its own (place names' paler navies), and gives the four shadows `transparent`. Every colour job, by where it shows:

### The globe

| Setting | What it colours | Dark theme |
| --- | --- | --- |
| `components.Globe.surface` | The globe: land and sea alike | `primary.main` |
| `components.Globe.coastlines.color` | The edges of the sea (lakes and rivers aren't outlined) | `primary.light` |
| `components.Globe.countryBorders.color` | Country borders | `primary.light` |
| `components.Globe.stateLines.color` | State and province lines | `navy.400` |
| `components.Globe.disputedBorders.color` | Disputed borders, dashed | `navy.400` |
| `components.Globe.halo.inner.color` | The halo close around the globe's edge | `navy.400` |
| `components.Globe.halo.outer.color` | The halo's wider, fainter outer glow | `primary.dark` |
| `components.PlaceNames.<kind>.color` | A kind of place's name: `city`, `capital`, `state`, `country` | city `navy.200`, capital `navy.100`, state `primary.light`, country `navy.200` |
| `components.PlaceNames.<kind>.outline.color` | The outline around its letters | `navy.600` for every kind |
| `components.Sky.color` | The sky around the globe | `background.default` |
| `components.Sky.stars.white`, `.cool`, `.warm` | The scattering of stars in the sky | `offWhite.500`, `navy.100`, `gold.100` |

### Games on the globe

| Setting | What it colours | Dark theme |
| --- | --- | --- |
| `palette.<status>.main` | A game's colour, by status (`live`, `upcoming`, `final`, `disrupted`; see [The palette](#the-palette)) | `gold.500` for Live, Upcoming and Final; `offWhite.700` (grey) for Disrupted |
| `components.Pin.<status>.core.color` | A small pin's bright core | Live `gold.100`; the others their status's colour (`upcoming.main` and so on) |
| `components.Cluster.fill` | The disc of a pin cluster or card cluster | `primary.dark` |
| `components.Selection.color` | The selected game's pin ring and score card outline | `offWhite.500` |
| `components.ScoreCard.fill` | A score card's fill, solid | `primary.dark` |
| `components.ScoreCard.text` | A score card's text | `text.primary` |
| `components.ScoreCard.disrupted.fill`, `.text` | A Disrupted game's score card fill and text | `primary.dark`, `offWhite.700` |
| `components.ScoreCard.shadow` | The drop shadow a starting game's score card settles with | `background.default` |

### Panels and controls

Beside the palette's background, text, divider and hover:

| Setting | What it colours | Dark theme |
| --- | --- | --- |
| `components.Controls.surface` | The scenario pill and its list, the speed keys, the scenario clock and the "No games right now." message | `background.paper` |
| `components.Controls.shadow.color` | Their drop shadow | `transparent` |
| `components.Controls.on.fill`, `.text` | A speed key that's on | `offWhite.500`, `navy.800` |
| `components.GamePanel.surface.top`, `.bottom` | The game panel, shading from top to bottom | `background.paper`, `background.paper` (solid) |
| `components.GamePanel.scoreBlock.top`, `.bottom` | The game panel's score block, shading from top to bottom | `primary.dark`, `primary.dark` (solid) |
| `components.GamePanel.score.fill`, `.text` | A team's score box on the game panel | `navy.600`, `text.primary` |
| `components.GamePanel.unofficial` | The note on unofficial stream links | `text.secondary` |
| `components.GamePanel.photo` | The glow where the venue's photo goes | `navy.600` |
| `components.GamePanel.credit.fill`, `.text` | The photo's credit, shown on hover | `background.default`, `text.secondary` |
| `components.GamePanel.close` | The game panel's close button | `primary.dark` |
| `components.GamePanel.shadow.color` | The game panel's drop shadow | `transparent` |
| `components.SettingsMenu.surface` | The settings menu | `background.paper` |
| `components.SettingsMenu.shadow.color` | Its drop shadow | `transparent` |
| `components.SettingsMenu.gearOutline.color` | An outline around the settings gear, cast as a shadow, for a theme whose gear needs one to read over the globe | `transparent` (none) |
| `components.SettingsMenu.tab` | A settings tab that's off | `text.secondary` |
| `components.SettingsMenu.count` | The count of a sport's leagues that are on | `text.secondary` |
| `components.SettingsMenu.hint` | The hint beside "All leagues" | `text.secondary` |
| `components.SettingsMenu.chip.outline` | A league chip's outline | `primary.main` |
| `components.SettingsMenu.chip.badge` | The badge counting leagues on the "All leagues" chip | `primary.dark` |
| `components.SettingsMenu.on.fill`, `.text` | A settings tab or league chip that's on | `offWhite.500`, `navy.800` |
| `components.LoadingScreen.dim.color` | The dim over the globe while ScoreMap loads, as opaque as `components.LoadingScreen.dim.opacity` (see [On the page](#on-the-page)) so the globe shows through | `background.default`, as the sky |
| `components.LoadingScreen.spinner.color` | The loading screen's ring spinner: the arc that turns | `text.primary` |
| `components.LoadingScreen.spinner.track` | The rest of the spinner's ring, that the arc turns around | `navy.600` |
| `components.LoadingScreen.message` | The message under the loading screen's spinner when loading is slow | `text.primary` |

"On" is off-white everywhere (a settings tab, a league chip, a lit speed key, the selection), so chosen looks the same across the app.

## How a game's status shows

A game's status shows by **brightness and glow, not colour** (ADR-0012). Colour is the strongest signal on a map and only six to eight colours can be told apart on one, so it's kept to stand for a game's league later, when several leagues are shown at once. Until then the dark theme gives Live, Upcoming and Final games the one gold and Disrupted games a grey, so a game's colour says only whether it's being played as scheduled.

- **Live** glows widest, its small pin has a bright core, and its score card's status light pulses (that animation is in the CSS), unless reduce motion is on (see [Where the theme reaches](#where-the-theme-reaches)).
- **Upcoming** glows less and is a little dimmer.
- **Final** has no glow and fades.
- **Disrupted** has no glow and greys out.

Score cards stay solid as they fade, so the map never shows through the scores: a card fades by colour, its status colour, text and logos mixed into its fill, not by being see-through.

Each status still has its own colour in the palette, though three are the same gold, so league colours, or a theme that shows status its own way (a light theme, where glows barely show), can change them without a new setting.

A status's colour is the palette's; the rest of its look is each component's own, as MUI's components style each colour they come in, so a component's tab in the tuner holds all of how it looks:

| Setting | What it is |
| --- | --- |
| `palette.<status>` | The game's colour, and the text written on it (see [The palette](#the-palette)) |
| `components.Pin.<status>.core.color`, `.radius`, `.opacity` | A small pin's bright core: its colour, radius in pixels and opacity |
| `components.Pin.<status>.core.ring` | The width of the ring of status colour around the core, in pixels (0 is no ring) |
| `components.Pin.<status>.glow.radius`, `.opacity` | The soft glow around a small pin: its radius out to where it's faded to nothing, and its opacity at the middle (radius 0 is no glow) |
| `components.Cluster.<status>.opacity` | How opaque a pin cluster or card cluster showing as this status is: its disc, outline and count alike |
| `components.ScoreCard.<status>.fade` | How far its score cards fade, from 0 (not at all) to 1 (all the way, a blank card). A card stays solid: its status colour (its outline, header, status light, pointer and glow), its text and its logos are mixed this far into the card's fill (a Disrupted game's fill for a Disrupted card). The selected game's card doesn't fade |
| `components.ScoreCard.<status>.glow.radius`, `.opacity` | How far and how strongly its score cards glow in its colour (radius 0 is no glow). The CSS works out the rest from these: an inner glow 1.25 times as far at a third of the opacity, and the status light's glow 0.75 times as far |

The dark theme's:

| Status | Colour | Pin core | Pin glow | Cluster | Card fade | Card glow |
| --- | --- | --- | --- | --- | --- | --- |
| Live | `gold.500` | `gold.100`, 3.5px, opacity 1, 1.5px ring | 15px at 0.8 | 1 | 0 | 12px at 0.8 |
| Upcoming | `gold.500` | `upcoming.main`, 3px, 0.9, no ring | 9px at 0.4 | 0.9 | 0.15 | 4px at 0.3 |
| Final | `gold.500` | `final.main`, 2.5px, 0.5, no ring | none | 0.55 | 0.45 | none |
| Disrupted | `offWhite.700` | `disrupted.main`, 2.5px, 0.7, no ring | none | 0.6 | 0.3 | none |

The card fades are what the cards' opacities were before cards were made solid (1 minus 1, 0.85, 0.55 and 0.7), so they look as close to that as a solid card can.

How status reaches the rest of the globe:

- **Clusters** show as the most prominent status among their games (Live, then Upcoming, Final, Disrupted). A cluster glows as strongly as `components.Cluster.glowOpacity` times its status's pin glow opacity, so a cluster of a status whose pins don't glow doesn't either. In the dark theme that's 0.6, so a Live cluster glows at 0.48.
- **Pulses** play in the colour of the pin's, score card's or cluster's status after the change. A score, a start and a finish are told apart by the pulse's shape, never its colour.
- **The selected game** is outlined in `components.Selection.color`, off-white, apart from the gold of every other game.
- **Glow means a game.** Panels and controls have no glow and no drop shadow: in the dark theme their shadows, the settings gear's outline among them, are `transparent` and the game panel's glow has opacity 0.
- **Pin clustering** depends on the widest pin glow: small pins gather into pin clusters when their glows (at 0.6 of their radius) would overlap. Widening Live's glow makes pins cluster sooner.

## Typography

The page's text is one font family, `typography.fontFamily`, in **type styles**, MUI's typography variants: each a `fontWeight` (1 to 1000), a `fontSize` in pixels and a `letterSpacing` in ems. The page's CSS chooses which type style each kind of text is, as a component's styles choose a variant in MUI; a theme changes how a type style looks, not which one a thing uses. Some text takes a style's weight but stays at the size of the text around it (a score card's team abbreviations and scores), or a style's size in another's weight (the game panel's close button).

| Type style | Which text | Dark theme |
| --- | --- | --- |
| `h6` | Scores on the game panel; a score card's scores take its weight | 700, 20 |
| `subtitle1` | Team names on the game panel; a score card's team abbreviations take its weight | 700, 16 |
| `subtitle2` | A score card's clock line, and the rest of its text | 600, 12 |
| `body1` | Body text; the game panel's close button takes its size | 400, 16 |
| `body2` | The game panel, the settings menu, the scenario clock and the loading screen's message | 400, 14 |
| `button` | Buttons: the settings menu's tabs and sport names, league chips and their counts, the scenario pill and the scenario it has on, the game panel's close button | 600, 14 |
| `caption` | Secondary lines: the game panel's notes and stream links, the settings menu's counts and hint | 400, 12 |
| `overline` | The game panel's headings: its league and labels, tracked out, and its progress line | 700, 12, 0.14em |
| `footnote` | The smallest: the photo's credit, a score card's header line, and the game panel's labels on a phone | 400, 11 |

`footnote` is ScoreMap's own, smaller than MUI's `caption`. The dark theme writes everything in `'Open Sans Variable', 'Open Sans', sans-serif`, so the app looks the same on Windows, Mac and phones. The theme gives only the family: the font itself has to be loaded by the app. Open Sans is bundled with it (`@fontsource-variable/open-sans`, imported in `web/src/main.tsx`, weights 300 to 800), so a theme using another web font needs its loading added in code. Scores keep their digits lined up as they change: the CSS asks for tabular figures, and Open Sans's figures are already tabular.

Text on the globe is drawn in other fonts (see [Text on the globe](#text-on-the-globe)), but its sizes are type styles' sizes.

## Spacing and shape

- **`spacing`**: the spacing unit, in pixels: every padding, margin and gap on the page is a number of them, as MUI's `theme.spacing(n)` gives one. The CSS writes `calc(3 * var(--spacing))`. Cards stay tight on a few units and panels roomy on more, from the same unit. The dark theme's is 4, so its spaces are 2, 4, 6, 8, 12, 16, 24 and 32 pixels (half a unit to 8).
- **`shape.borderRadius`**: the corner radius, in pixels, every corner is a number of (below), as MUI's `sx` takes `borderRadius: 2`. The dark theme's is 4. Circles (clusters, the status light) stay circles whatever it is.
- **`shape.borderWidth.thin`, `.medium`, `.thick`**: the page's borders and dividers. The score card's border and header line, dividers and league chips are `thin`, the settings tab's underline `medium`, the game panel's top edge and the loading screen's spinner ring `thick`. The dark theme's are 1, 2 and 3.

### Corners and the cut corner

Each component's corners are a number of corner radii, or `"pill"`, round enough to make any control a pill:

| Setting | Which corners | Dark theme |
| --- | --- | --- |
| `components.ScoreCard.corner` | A score card's | 1.5 (6px) |
| `components.GamePanel.corner` | The game panel's | 2 (8px) |
| `components.Menu.corner` | A menu's: the settings menu, the list of scenarios | 2 (8px) |
| `components.MenuItem.corner` | An item's in a menu | 1.5 (6px) |
| `components.Controls.message.corner` | A message's, such as "No games right now." | 2 (8px) |
| `components.Controls.corner` | A control's: the scenario pill and clock, the speed keys, league chips | `pill` |

The **cut corner** cuts off the game panel's bottom left corner, like a broadcast graphic, for a more angular theme: `components.GamePanel.cutCorner.on` (`true` or `false`) and `.size`, how far along each side, in spacing units. The dark theme has it off (size 4, unused).

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
| `components.Trail.width`, `.opacity` | A moved score card's trail back to its venue | 1.25, 0.9 |
| `components.Trail.glow.width`, `.blur`, `.opacity` | The soft glow along a trail | 4, 3, 0.35 |
| `components.Trail.venue.radius` | The dot at the trail's venue | 2 |
| `components.Trail.venue.ring.radius`, `.width` | The ring around that dot | 5, 1 |
| `components.Selection.width` | The selected pin's ring and score card's outline. The ring reaches as far out whatever its width | 2 |
| `components.Pulse.size.pin`, `.cluster` | How wide a pulse's ring starts, over a small pin and over a cluster | 16, 36 |
| `components.Pulse.ring.lively`, `.calm` | How thick a pulse's ring is, for a score or a start, and for a finish | 3, 2 |

### On the page

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.GamePanel.shadow`, `components.SettingsMenu.shadow`, `components.Controls.shadow` | A drop shadow: `{ x, y, blur, color }`, how far it falls across and down, how far it blurs, and its colour | none (`transparent`, blur 0) |
| `components.SettingsMenu.gearOutline` | The outline around the settings gear, as a shadow | none (`transparent`, blur 0) |
| `components.GamePanel.glow.y`, `.blur`, `.opacity` | The glow in the game's status colour along the game panel's top | 0, 0, 0 (none) |
| `components.ScoreCard.header.tint` | How strongly a score card's header is tinted with its status colour, 0 to 1 | 0.28 |
| `components.ScoreCard.header.letterSpacing` | How far apart the letters of a score card's header line are spaced, in ems | 0.06 |
| `components.Controls.off.opacity` | How opaque a speed key that's off is, 0 to 1 (one that's on, or under the pointer, is opaque) | 0.6 |
| `components.LoadingScreen.dim.opacity` | How opaque the loading screen's dim is over the globe, 0 to 1 | 0.6 |
| `components.Sky.stars.size.small`, `.large` | The stars in the sky around the globe, small and large | 1, 1.5 |
| `components.GamePanel.size.width` | The game panel's width at most | 940 |
| `components.GamePanel.size.height`, `.phoneHeight` | Its height, and its height on a phone, where the details go below the score block | 127, 236 |
| `components.GamePanel.size.scoreBlock`, `.slant` | The score block's width, and how far its right edge slants | 290, 16 |
| `components.GamePanel.size.photo`, `.logo`, `.close` | The venue photo's width, a team's logo, the close button | 180, 28, 24 |
| `components.GamePanel.size.scoreWidth` | A team's score box, in ems of its digits: wide enough for three, so a score of 100 moves nothing | 2.6 |
| `components.ScoreCard.size.minWidth` | A score card's narrowest | 92 |
| `components.ScoreCard.size.logo`, `.light` | A team's logo on a score card, and its status light | 16, 6 |
| `components.ScoreCard.size.pointer` | How far a score card's pointer reaches below it to the venue (the globe reads this to place cards) | 6 |
| `components.ScoreCard.size.nameClearance` | How far score cards keep clear of the letters of a city named for a game (its outline included; the globe lays cards out by this) | 4 |
| `components.SettingsMenu.size.width`, `.gear`, `.allLeagues` | The settings menu's width, the gear, the "All leagues" chip's height | 320, 28, 32 |
| `components.SettingsMenu.size.countWidth`, `.mark` | On the "All leagues" chip, the narrowest its count is, and the box its mark (✓ or –) sits in, so the chip keeps its size whichever shows; in ems | 3.2, 1 |
| `components.Controls.size.key`, `.icon` | A speed key and its icon. The game panel sits clear of the scenario controls by the keys' size | 34, 14 |
| `components.LoadingScreen.spinner.size` | The loading screen's spinner, across | 32 |

## Text on the globe

The globe's text (place names and the count on a pin or card cluster) is drawn by MapLibre from the map's font server, fonts.openmaptiles.org, not from the page's fonts (ADR-0006). A globe font is given by the name the server knows it by, and must be one it has: for a font it lacks, the server answers with a web page rather than an error and the text falls back to a browser font, so checking rejects any other. The fonts it has (listed in `globeFonts`, `web/src/theme/globeFonts.ts`, checked in October 2026):

- **Open Sans**: Light, Light Italic, Regular, Italic, Semibold, Semibold Italic, Bold, Bold Italic, Extra Bold;
- **Klokantech Noto Sans**: Regular, Italic, Bold (it has no plain "Noto Sans");
- **Metropolis**: Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black, each also Italic.

Each is written in full, family and variant: `"Open Sans Semibold"`, `"Metropolis Black Italic"`.

| Setting | Which text | Dark theme |
| --- | --- | --- |
| `components.PlaceNames.<kind>.font` | A kind of place's name | city `Open Sans Semibold`, capital `Open Sans Bold`, state `Open Sans Regular`, country `Open Sans Bold` |
| `components.PlaceNames.<kind>.size` | Its size by zoom: a type style, whose size it takes, at each of some zoom levels (`{ "4": "caption", "11": "h6" }`), growing evenly between them | city `caption` at zoom 4, `body2` at 7, `h6` at 11; capital `body2`, `body1`, `h6` at 4, 7, 11; state `footnote` at 3 to `body2` at 8; country `footnote` at 1 to `body1` at 4 |
| `components.PlaceNames.<kind>.letterSpacing` | How far apart its letters are spaced, in ems. State and country names are always in capitals, which want more | city and capital 0, state 0.25, country 0.12 |
| `components.Cluster.count.font` | The count on a pin or card cluster | `Open Sans Bold` |
| `components.Cluster.count.size` | Its size, a type style's | `caption` |

## What checking rejects

A theme is checked when it's resolved, and every problem is listed, not just the first; checking never throws, whatever it's given. Checking rejects:

- a theme that isn't an object, or that has anything but `colors`, `palette`, `typography`, `spacing`, `shape` and `components`;
- missing colours, or colours, one of the theme's colours or a group of settings that isn't an object, or a colour named as one of the palette's parts are;
- a missing setting anywhere in the theme, and **a setting the theme doesn't know** (a misspelt one shows as itself, as well as the real one missing), or a part of one of the theme's colours other than `base` and `steps`;
- one of the theme's colours whose base isn't a `#rrggbb` colour, or a hand-set step that isn't `100` to `900` or isn't a `#rrggbb` colour;
- a colour job naming a colour the theme doesn't have (an unknown colour, an unknown step, or, in the palette, another of the palette's colours), or giving a colour directly that isn't well formed (see [Colour jobs](#colour-jobs): `#12` or `rgb(1, 2)` is rejected), or that isn't a string. A job naming one of the palette's colours that has a problem of its own isn't rejected as well: the problem is listed once, where it is;
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

To try changes first, use the **theme tuner**, the "Theme" button at the top right of a local run (it's left out of a build). It shows every setting but the theme's colours themselves: first the whole theme's (the palette, the typography, spacing and shape), then a tab for each component, named as it is (Pin, Score card, Game panel, Loading screen…), under a heading of their own and ruled off, as each changes only that part. A colour job picks one of the palette's colours, or a step from a grid of the theme's colours, light to dark, or steps lighter (▲) or darker (▼) in its colour, so it stays within the theme's colours; numbers have sliders, and type styles and globe fonts a list. A change shows at once, on the page and on the globe alike. The Theme button counts the settings changed from the built-in theme, each tab those it shows, and a changed setting is marked, with a button to put it back. The draft is kept in that browser until the built-in theme's JSON changes. "Copy changes" copies what's changed, a setting to a line, to put into the JSON.

1. **Colours first.** Choose the base colours and look at their worked-out steps (`paletteSteps` in `web/src/theme/palette.ts` works them out). Hand-set a step only where the worked-out one looks off.
2. **Then the palette:** which steps are the primary and secondary colours, each status's colour, the background, the text, the divider and hover.
3. **Point every colour job at one of the palette's colours or a step**, using the tables above. Keep a colour given directly for a true one-off.
4. **Set the typography, spacing, shape, and each component's sizes, fonts and looks by status.** Status shows by glow and brightness: if the theme's glows don't show (a light theme), give status its own way through the statuses' colours and the pins', clusters' and score cards' opacities and cores.
5. **Run the tests** (`npm test` in `web/`). Checking reports what's wrong with the theme (see [What checking rejects](#what-checking-rejects)). No test holds the theme's choices, so a different look changes no test.
6. **Look at it running.** How the app looks isn't tested automatically: check it in the `worldwide`, `crowded` and `edge-cases` scenarios (the `run-scoremap` skill), on the globe zoomed out and in, with the game panel and settings menu open, and on a phone-sized window.

### Adding a setting

A new setting goes in the settings in `web/src/theme/theme.ts` and in every theme's JSON, since a theme without it is rejected; its custom property then appears on the page by itself. A part's own look goes in its component, under `components`; what's shared goes where MUI keeps it, in the palette, the typography, `spacing` or `shape`. The page's CSS reads it through that custom property. Likewise a setting taken out must leave every theme's JSON, since a theme with a setting it doesn't know is rejected.

### What stays in code

Some of the look is in code on purpose, as behaviour or layout rather than a theme's choices:

- motion: durations, easings and the shapes of the animations, including the status light's pulse and the sizes and opacities inside their keyframes;
- the starfield's pattern (where each star sits in its tile, how bright it is, the tile's size) and skew angles;
- layout: line heights, percentages, and slots sized in lines (`lh`, such as the game panel's room for two lines of a venue);
- score card and pin footprints, card layout distances (`cardLayout.ts`), how far the selected pin's ring reaches, and where a city's name sits from its dot (`text-radial-offset: 1.2` ems zoomed out, `text-radial-offset: 1` zoomed in) and where it wraps (as the base map style has them);
- that a glow on the globe (a small pin's, a pin cluster's or a card cluster's) fades out all the way to its edge (`circle-blur: 1`): how far it reaches and how strongly it glows are the theme's;
- icons' drawings: their shapes and line widths, in the units of their own `viewBox`, which the CSS sizes to the theme's sizes;
- which kinds of place are named in capitals (states and countries);
- which type style, how many spacing units and which border width each thing on the page uses (the CSS), and which status is most prominent and draws on top (the status look, `web/src/globe/statusLook.ts`).

No test holds the code to this list; that's for review. While a look is being tried, a value may go straight into the CSS or the TypeScript. Once it's settled, it moves into the theme (see [Adding a setting](#adding-a-setting)), unless it belongs on this list.
