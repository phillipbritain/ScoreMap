# Style guide

How ScoreMap's look is made, so a theme can be made or changed without reading the code. It describes the theme as built: the settings in [`web/src/theme/theme.ts`](../web/src/theme/theme.ts) and the built-in dark theme, [`web/src/theme/builtInTheme.json`](../web/src/theme/builtInTheme.json). When they and this guide disagree, the code is right and this guide is stale.

The decisions behind it: [ADR-0011](adr/0011-themes-as-checked-json-with-a-palette.md) (themes as checked JSON, with colors worked out in OKLCH), [ADR-0014](adr/0014-themes-shaped-like-mui.md) (a theme shaped as MUI's is), [ADR-0012](adr/0012-color-for-league-status-by-glow.md) (color will stand for league; status shows by brightness and glow), [ADR-0017](adr/0017-viewers-pick-the-colors.md) (viewers pick the colors games show in) [ADR-0006](adr/0006-map-fonts-from-openmaptiles.md) (the globe's fonts come from fonts.openmaptiles.org), [ADR-0018](adr/0018-surfaces-are-glass.md) (the original glass treatment, which score cards keep) and [ADR-0023](adr/0023-solid-backgrounds-for-panels.md) (solid backgrounds for everything else). The words **theme**, **theme colors**, **palette**, **color job** and **type style** are the glossary's ([`GLOSSARY.md`](../GLOSSARY.md)).

## Contents

The guide is long: read this list, then only the sections the task needs (`grep -n '^## ' docs/style-guide.md` gives each one's line).

- [What a theme is](#what-a-theme-is): the theme's JSON shape and parts, where it reaches (CSS custom properties, the globe, switching themes), and motion: score changes, cards coming and going, a game's celebration, the first load's reveal, switching map type, reduce motion.
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
- **`components`** has each part of ScoreMap's own look, by part, as MUI's `components` has each component's: the globe, place names, pins, clusters, trails, score cards, the event panel, the menus, the controls and the loading screen. A part that looks different by game status has a group for each (`components.Pin.live`, `components.ScoreCard.final`), as MUI's components style each color they come in (see [How a game's status shows](#how-a-games-status-shows)). A part's color jobs name a step or one of the palette's colors (`primary.dark`, `text.secondary`), so changing the palette changes every part that uses it.

Every setting is required, and nothing else is allowed: a theme missing a setting, or with one it doesn't know, is rejected (see [What checking rejects](#what-checking-rejects)). This is where a theme differs most from MUI's, which fills in whatever it isn't given: ScoreMap's built-in theme is the only one, so a setting left out is a mistake, not a default.

### Where the theme reaches

The code reads only the resolved theme, never the JSON:

- **The page** (the event panel, score cards, the rail, the scenario controls, the loading screen): the resolved theme is written to the page's root as CSS custom properties, one per setting, named by where it sits in the theme in kebab case, as MUI's CSS theme variables are. `palette.text.primary` is `--palette-text-primary`, `typography.body2.fontSize` is `--typography-body2-font-size`, `spacing` is `--spacing`, `palette.live.main` is `--palette-live-main`. A component's are named by the component alone: `components.ScoreCard.fill` is `--score-card-fill`, `components.EventPanel.surface.top` is `--event-panel-surface-top`. Sizes are written in pixels (`12px`), or in ems where they go with their text (`0.14em`), on or off as `1` or `0`, and a shadow as one CSS shadow (`0px 8px 30px #000e28`). A globe font is written as its `-name`, `-family`, `-weight` and `-style`. The page's CSS (`web/src/index.css`) reads a settled look's colors, fonts, text sizes, spacing, corners, sizes and opacities through these, rather than naming its own (see [What stays in code](#what-stays-in-code) for what it may name, and for a look still being tried). A space is a number of spacing units, `calc(3 * var(--spacing))`, as MUI's `theme.spacing(3)` gives it.
- **The globe**: its map style (land, sea, coastlines and borders), place names, the halo, pins, clusters, trails, the selected pin's ring and pulses read the resolved theme directly, since MapLibre needs the values themselves, not CSS custom properties. Widths and text sizes that change with zoom, the disputed borders' dash pattern and the halo's sizes are read only by the globe and aren't written to CSS.
- **The theme is chosen** to start in, in `web/src/main.tsx`, and **changes one way**, as the app runs: through `useTheme` (`web/src/theme/useTheme.ts`), which writes it to the page before the page paints and hands it down through `App` and `Globe` to the globe. The globe restyles itself in place (`GlobeMap.setTheme`): it sets just the map layer properties that differ between the two themes, redraws the halo, reclusters small pins and measures score cards afresh. Nothing is made again and the camera stays where it is.

Motion isn't part of a theme: durations, easings and the animations' shapes stay in the CSS.

When a game's score changes, nothing on its score card moves: the card's edge glows in the game's color and fades over 1.6 seconds, and the score takes that color as it fades. When a two-sided game's score changes, the side that scored is also lit for 3 seconds, on its score card's row and in the event panel: a tint and inner glow in the game's color, its name and score brighter and glowing, steady for two seconds and then fading. A card redrawn, or a panel opened, partway through carries on from there rather than starting over. A field or a fight card has no scorer to light.

A score card comes in when its game arrives on the board, or is shown again from Leagues on the rail: it drops in from a little above as it fades in, landing on its trail, its trail and venue dot fading in with it. It lifts up and away as it fades out when its game drops off after finishing or is hidden, its trail and venue dot fading with it, out of the card layout at once so it holds no room as the others move in. Each takes 300 ms (`cardComingDuration`, in `web/src/globe/cardComings.ts`, as the trails need it too). A card that comes or goes as the camera moves (its venue crossing the horizon or the edge of the screen, as a venue out of view has no card but the selected game's) fades in or out in place over the same 300 ms, its trail with it; one moving into or out of a card cluster fades out or in over 200 ms (the CSS's `[data-in-card-cluster]`). A card the card layout moves further than a few pixels (`cardMoveStep`) glides there over 300 ms, easing out, its trail's start with it (`web/src/globe/cardMoves.ts`); the small steps of a card pushed along as the globe turns follow at once. Cards move only as the camera moves: to keep clear of each other, to come back over their venues, or to come within 80 px of their venues where there's room (`venueReach` in `web/src/globe/cardLayout.ts`). Once it stops, every card and trail holds where it is, whatever changes on screen, until the camera moves again. A card keeps the size it was first drawn at, with room for a three-digit score, so no score, clock or selection resizes it: a clock line or a name that grows after is cut short with an ellipsis. Neither fades nor glides play until ScoreMap is ready: behind the loading screen, cards are just there.

The loading screen's rocket, and the cut-off note's, flies up and to the right, bobbing as it goes, its flame of two layers (`components.LoadingScreen.rocket.flame.outer` around `.inner`) flickering out of step, and stars streaming past it, nearer ones bigger and quicker, fading out toward the edge of a circle around it. The user picked this, today's rocket with a new flame and stars in place of its speed lines, from two rounds prototyped on November 19, 2026, preserved on the throwaway branch `phillipbritain/rocket-loader-prototype`.

The message under the loading screen's rocket, and the cut-off note's, drifts in a word at a time: each word rises into place out of a blur over 0.3 seconds, 35 ms after the one before, glowing in `components.LoadingScreen.glow`. A message ending in an ellipsis ends instead in three dots in the glow's color, lit one after another for as long as it shows. This is variant E2 of the comparison preserved on the throwaway branch `prototype/loading-text`, chosen by the user on November 14, 2026.

ScoreMap comes in as one on its first load. From its first paint the page is the theme's background (the theme is written into `index.html`, so it never flashes white), and the loading screen is solid, hiding the globe as it draws, its rocket alone in the middle: the rail, the top rail and any message wait out of sight. When ScoreMap is ready, the loading screen fades away over 0.4 s, and as it does the rail (its Games count with it), the top rail, the welcome tour on a first visit and any message fade in over the same 0.4 s, so the globe, its score cards and place names, and the controls arrive together (`web/src/loading/revealPhase.ts`). This was the user's pick of three prototyped on November 18, 2026, preserved on the throwaway branch `phillipbritain/load-reveal-prototype`.

Switching map type cross-fades. The old map stays on screen while the new one's tiles load out of sight; then the satellite imagery, which lies over the plain map's land and sea, fades in over it, or out from over it, in one go over 0.4 s, and the old map's layers go once they're covered (`web/src/globe/mapTypeFade.ts`). Tiles still missing after 4 seconds don't hold the switch up: it fades then, and they arrive as they load.

A rail popover (Leagues, Display Settings, Map Type, Games, More, Feedback, and the top rail's Scenario) opening slides out a little from the rail, or down from the top rail's row, as it fades in over 160 ms; closed, it slides back as it fades out over 120 ms, out of reach as it goes. The event panel opening slides up into place from below the screen's foot over 220 ms, and closed, slides back down off it over 160 ms. It doesn't fade, as the score block's glass would flash as its blur stopped seeing the globe. Picking another game while it's open changes it in place. With reduce motion a popover fades in place as it opens, the panel is there at once, and either goes at once.

The rail's Hide controls button, a cross above its other buttons, gold while they show, folds them up into itself over 220 ms, their groups rising and fading one after another, leaving itself alone at the top right as Show controls, a menu, which drops them back down the same way; with reduce motion they go and come back at once. The rail stays collapsed on the viewer's next visit, but is open while the welcome tour shows.

On a phone, where the event panel is a bottom sheet, it can be swiped down to close as well as by its close button: a drag down from anywhere on it but its band (which scrolls) moves the panel with the finger, giving only a little upward. Let go past 30% of its height, or flicked down, it slides off the screen over 180 ms and closes; otherwise it springs back over 260 ms, overshooting slightly. There's no handle. This is variant B of the comparison preserved on the throwaway branch `phillipbritain/swipe-close-proto`, chosen by the user on November 14, 2026.

A game finishing celebrates (`GLOSSARY.md`, "Celebration"; `web/src/celebration/celebration.ts`). Its score card, where it has one on screen, gets confetti in its teams' colors (the two strongest colors of each logo, else the color the game played in) and white: a small shower of 34 pieces that pop out along the card's very top edge and drift down through it, more falling in from its top over the first half of its 2.8 seconds, kept to the card (3 px past its edges at most) and moving with it, under the event panel and the rail. In an open event panel, a fireworks show plays inside the panel: six rockets go up from along its foot over 1.8 seconds, each bursting between a fifth and half of the way down it into a ring of sparks in one of those colors, lifted toward white so they glow, fading and twinkling out over 1.7 seconds. 4.2 seconds after the finish the panel closes itself, sliding down off the screen as a close does but slower, over 550 ms, easing in, and the game's score card goes out at the same moment, the card dimmed as Final throughout.

With the device's reduce motion setting on, changes still show but nothing moves or blinks. A game finishing plays no confetti or fireworks, and its panel closing itself goes at once. A score's glow fades in place without shrinking. A score card coming in or going out fades in place, without dropping in or lifting away, and one the card layout moves goes straight there without gliding. The side that scored stays lit, steady, for its 3 seconds, then goes at once. A hot game's flames stay, standing still. Every pulse over a small pin or a cluster is a still ring that fades in and out in place without growing. The loading screen's rocket fades in and out in place instead of flying, its flame steady and the stars standing still, its message is there at once with its dots steady, and it goes at once when ScoreMap is ready instead of fading, everything it hid there at once with it. A event panel let go after a swipe closes or springs back at once. Camera moves jump instead of easing: MapLibre does this for any camera move not marked `essential`, so none is.

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
| `palette.secondary` | The accent: gold, as every game is today. The statuses' colors name gold's steps themselves; a league chip that's on names it (`main` for its outline and glow, `light` for its text), as does Display Settings' "Display venue photo on Event Panel" (`main` when on, with a knob in `contrastText`) and Display Settings' "Card colors" heading (`main`) | `gold.500`, `gold.300`, `gold.700`; `navy.800` |
| `palette.live`, `.upcoming`, `.final` | A game's color, by status, unless the viewer picked one for its sport or league: its small pin's ring and glow, its score card's outline, header and glow, its trail, a cluster's outline, glow and count, its pulse, and the event panel's top edge and progress line. Text written on it is `text.primary` or `background.paper`, whichever reads better, so a status has no `contrastText` (see [How a game's status shows](#how-a-games-status-shows)) | `gold.500`, `.300`, `.700` for each |
| `palette.error`, `palette.warning` | Errors and warnings: the Feedback panel's error, and its counter past the limit, in `error.light`; nothing uses `warning` yet (league colors are the viewer's, in Display Settings on the rail) | `red` and `orange`, at 500, 300 and 700; `offWhite.500` and `navy.800` |
| `palette.background.default` | The page behind everything | `navy.900` |
| `palette.background.paper` | The surfaces on it: the event panel, the menus and the controls | `navy.800` |
| `palette.text.primary` | Main text on the event panel, the rail and the scenario controls | `offWhite.500` |
| `palette.text.secondary` | Secondary text: the event panel's league and labels and the lines under a venue or a time; league chips that are off, and the count on the "All leagues" chip; a ranked team's poll place on a score card | `offWhite.600` |
| `palette.text.link` | Links (the feedback form's thanks) | `offWhite.500` |
| `palette.divider` | The lines between a menu's parts (under "All leagues", running on from "Card colors") | `navy.600` |
| `palette.action.hover` | Behind a control under the pointer (a scenario in the list, a speed key) | `navy.600` |

The statuses' colors and `text.link` are ScoreMap's own, beside MUI's. MUI works out a color's `light`, `dark` and `contrastText` from its `main` when they're left out; ScoreMap's palette gives them all (a status's color has no `contrastText`), so each is a step that can be seen and changed.

## Color jobs

A **color job** is what a color is for (the globe's surface, Live's color, main text), not which color it is. Each takes one of:

- a step of the theme's colors by name: `"navy.700"`;
- outside the palette, one of the palette's colors by name, as MUI's `sx` takes one: `"primary.dark"`, `"text.secondary"`, `"background.paper"`, `"divider"`; or
- a color given directly, in a form both CSS and MapLibre read, since it's passed on to both as written: a hex color of 3, 4, 6 or 8 digits (`#abc`, `#abcd`, `#0b1526`, `#0b152680`); `rgb(…)` or `rgba(…)`, its three channels all numbers or all percentages; `hsl(…)` or `hsla(…)`, a hue (in degrees, `deg` optional) and two percentages; each function's arguments comma-separated with an optional fourth for alpha (`rgba(255, 255, 255, 0.7)`), or space-separated with an optional `/ alpha` (`rgb(10% 20% 30% / 50%)`); or `transparent` (for a shadow or glow that isn't there). Named colors such as `red` aren't taken: `red` would read as a step's name. This is the escape hatch for a one-off the theme's colors don't fit, at the cost of that color no longer following them.

The dark theme names one of the palette's colors where a job is what that palette color is for (a surface is `background.paper`, main text `text.primary`) and a step where it's a shade of its own (place names' paler navies, the globe's land and lines), gives the sea a color directly, as no step falls where it should, and gives the four shadows `transparent`. Every color job, by where it shows:

### The globe

| Setting | What it colors | Dark theme |
| --- | --- | --- |
| `components.Globe.surface` | The globe's land, a step darker than `primary.main` so the globe reads behind score cards | `navy.600` |
| `components.Globe.sea` | The sea: oceans and lakes, darker than the land so the coast stands out (rivers stay the land's color; the satellite map shows its own) | `#071a3c`, given directly, between `navy.700` and `navy.800` |
| `components.Globe.coastlines.color` | The edges of the sea (lakes and rivers aren't outlined) | `navy.200` |
| `components.Globe.countryBorders.color` | Country borders | `navy.200` |
| `components.Globe.stateLines.color` | State and province lines, the United States' and Canada's only (ADR-0026) | `navy.300` |
| `components.Globe.disputedBorders.color` | Disputed borders, dashed | `navy.300` |
| `components.Globe.halo.inner.color` | The halo close around the globe's edge | `navy.400` |
| `components.Globe.halo.outer.color` | The halo's wider, fainter outer glow | `primary.dark` |
| `components.PlaceNames.<kind>.color` | A kind of place's name: `city` (national capitals included), `state`, `country` | `navy.200` for every kind: state names stay quieter than city names by their smaller size and capitals, not a dimmer color, which got lost on the land |
| `components.PlaceNames.<kind>.outline.color` | The outline around its letters | `navy.800` for every kind |
| `components.Sky.color` | The sky around the globe | `background.default` |
| `components.Sky.stars.white`, `.cool`, `.warm` | The scattering of stars in the sky | `offWhite.500`, `navy.100`, `gold.100` |

### Games on the globe

| Setting | What it colors | Dark theme |
| --- | --- | --- |
| `palette.<status>.main` | A game's color, by status (`live`, `upcoming`, `final`; see [The palette](#the-palette)) | `gold.500` for each |
| `components.Pin.<status>.core.color` | A small pin's bright core. One that's its status's color is drawn in the game's color; any other (Live's paler core) stays, so status shows by brightness | Live `gold.100`; the others their status's color (`upcoming.main` and so on) |
| `components.Cluster.fill` | The disc of a card cluster | `primary.dark` |
| `components.Selection.color` | The selected game's pin ring and score card outline | `offWhite.500` |
| `components.ScoreCard.fill` | A score card's fill, tinting its glass (see [Glass](#glass)) | `primary.dark` |
| `components.ScoreCard.text` | A score card's text | `text.primary` |
| `components.ScoreCard.shadow` | The drop shadow a starting game's score card settles with | `background.default` |

### Panels and controls

Beside the palette's background, text, divider and hover:

| Setting | What it colors | Dark theme |
| --- | --- | --- |
| `components.Controls.surface` | The "No games right now." message | `background.paper` |
| `components.Controls.shadow.color` | Their drop shadow | `transparent` |
| `components.Controls.on.fill`, `.text` | A speed key that's on, and the Feedback panel's Submit | `offWhite.500`, `navy.800` |
| `components.EventPanel.surface.top`, `.bottom` | The event panel (on a desktop, its venue part and band), shading from top to bottom | `background.paper`, `background.paper` (solid) |
| `components.EventPanel.scoreBlock.top`, `.bottom` | The event panel's score block, shading from top to bottom: on a desktop the tint of its glass (see [Glass](#glass)) | `primary.dark`, `primary.dark` |
| `components.EventPanel.score.fill`, `.text` | A team's score box on the event panel; on a desktop the box is a pane of the score block's glass instead, only its text this color | `navy.600`, `text.primary` |
| `components.EventPanel.unofficial` | The note on unofficial stream links | `text.secondary` |
| `components.EventPanel.photo.glow` | The glow behind the venue and its links when the venue has no photo | `navy.600` |
| `components.EventPanel.shadow.color` | The event panel's drop shadow | `transparent` |
| `components.Rail.surface` | The rail's popovers (Leagues, Display Settings, Games, More and the Feedback panel); on local runs, the top rail's Scenario popover too. The rail's groups of buttons are score cards' glass instead (see [Glass](#glass)) | `background.paper` |
| `components.Rail.outline` | The thin outline round the rail's popovers, lighter than the globe's land and sea so a popover stands off the globe under it, on the plain map and the satellite map alike, at desktop size and as a phone's sheet | `primary.light` |
| `components.Tooltip.surface`, `.outline` | A tooltip (see [Tooltips](#tooltips)), a step lighter than the panels it may sit over, and its thin outline, which sets it off from them | `navy.700`, `navy.500` |
| `components.Rail.shadow.color` | Their drop shadow | `transparent` |
| `components.Rail.open` | A rail button's icon while its popover is open, and Hide controls' while the rail's buttons show; the count on the Games button and its ring; the dot on the Leagues button while games are filtered; and the ring round the map showing in Map Type | `secondary.main` (gold) |
| `components.Rail.count` | The count of leagues that are on, after a sport's name and on the "All leagues" chip (in `Rail.on.text` while a sport's are all on) | `text.secondary` |
| `components.Rail.hint` | The hint beside "All leagues" | `text.secondary` |
| `components.Rail.chip.outline` | A league chip's outline, and "Reset colors"' | `primary.main` |
| `components.Rail.chip.badge` | The badge counting leagues, after a sport's name and on the "All leagues" chip | `primary.dark` |
| `components.Rail.on.fill`, `.outline`, `.text` | A league chip that's on, lit as a Live score card is: its fill, with `Rail.on.tint` of its outline's color mixed in (0.14), its outline and glow (`Rail.on.glow.radius` and `.opacity`, 8 and 0.35), and its text. The chosen "Top Events" or "My leagues" in Leagues is lit the same way, its radio dot filled in the outline's color, and the welcome tour's Next and Done buttons are lit the same way | `primary.dark`, `secondary.main`, `secondary.light` |
| `components.LoadingScreen.dim.color` | The loading screen, solid, hiding the globe while ScoreMap loads; and the cut-off note's dim over the globe, as opaque as `components.LoadingScreen.dim.opacity` (see [On the page](#on-the-page)) so the globe shows through | `background.default`, as the sky |
| `components.LoadingScreen.rocket.color` | The loading screen's flying rocket: its body and fins, and the stars streaming past it (its window is the dim's color) | `text.primary` |
| `components.LoadingScreen.rocket.flame.outer`, `.inner` | The flame under the rocket: its outer layer, and the inner one inside it | `warning.main` (orange), `secondary.main` (gold) |
| `components.LoadingScreen.message` | The message under the loading screen's rocket | `text.primary` |
| `components.LoadingScreen.glow.color` | The glow around the loading screen's message, and the dots of its closing ellipsis | `secondary.main` |

A league that's on is lit in gold, as a game is, rather than filled in off-white: a white chip stood out against the dark theme. A lit speed key and the selection stay off-white; a rail button whose popover is open is gold.

## How a game's status shows

A game's status shows by **brightness and glow, not color** (ADR-0012). Color is the strongest signal on a map, so it's kept to stand for a game's sport or league, in a color the viewer picks in Display Settings on the rail (ADR-0017). With none picked, the dark theme gives every game the one gold. Disrupted games (postponed, suspended or canceled) aren't shown, so have no look (ADR-0021).

- **Live** glows widest and its small pin has a bright core.
- **Upcoming** glows less and is a little dimmer.
- **Final** has no glow and fades.

A score card fades by color, not by being see-through: its game's color, text and logos are mixed into its fill. A card of clear glass (see [Glass](#glass)) fades the same way, keeping its status look.

Each status still has its own color in the palette, though all three are the same gold, so a theme that shows status its own way (a light theme, where glows barely show) can change them without a new setting. A color the viewer picks takes the place of its status's, and text written on it (the event panel's progress line) is the theme's main text or its paper surface, whichever stands out from it more.

A status's color is the palette's; the rest of its look is each component's own, as MUI's components style each color they come in, so a component's settings hold all of how it looks:

| Setting | What it is |
| --- | --- |
| `palette.<status>` | The game's color, and the text written on it (see [The palette](#the-palette)) |
| `components.Pin.<status>.core.color`, `.radius`, `.opacity` | A small pin's bright core: its color, radius in pixels and opacity |
| `components.Pin.<status>.core.ring` | The width of the ring of the game's color around the core, in pixels (0 is no ring) |
| `components.Pin.<status>.glow.radius`, `.opacity` | The soft glow around a small pin: its radius out to where it's faded to nothing, and its opacity at the middle (radius 0 is no glow) |
| `components.Cluster.<status>.opacity` | How opaque a card cluster showing as this status is: its disc, outline and count alike. A venue cluster doesn't fade, as a venue dot doesn't |
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
- **Pulses** play in the game's color, over its small pin, score card or cluster alike. A score and a start play the same pulse: one small ring over a small pin or a cluster, and the card's edge lit over a score card, which doesn't move (a pop there made cards jump). A finish plays none; it celebrates instead (see [Where the theme reaches](#where-the-theme-reaches)).
- **The selected game** is outlined in `components.Selection.color`, off-white, apart from the gold of every other game, and its score card and trail are picked out as a hovered one's (see [Hover](#hover)).
- **Glow means a game.** Panels and controls have no glow: in the dark theme the event panel's glow has opacity 0, and their drop shadows are `transparent`, so they cast none (see [Glass](#glass)).

### Hot games' flames

A hot game (see [`GLOSSARY.md`](../GLOSSARY.md)) shows fire around its whole edge, gone as soon as it stops being hot. The chosen look is E for cards and option 14, Gentle crawl, for pins and clusters, from the local throwaway branch `prototype-flame-looks`.

- A **score card** has a glowing fire outline around all four sides, with warm highlights crawling around it once every 2.4 seconds and a lightly flickering glow. The card's box is cut out of the effect, so no fire shows through its glass. There are no floating embers.
- A **small pin** has a thin fire outline around its core and ring, with a steady soft glow. Its highlight turns slowly, once every 7.68 seconds.
- A **card cluster** holding a hot game has the same slowly moving outline around its disc, as faded as the cluster. A **venue cluster** has none, as its games' cards are on screen, fire and all.

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

Score cards are glass (ADR-0018): a pane the globe shows through, tinted with the card's fill (`components.ScoreCard.fill`). So are the rail's groups of buttons (and the top rail's, on local runs), as a score card's glass, tinted with its fill as solid as its frost but casting no shadow, the lines between their buttons faint and straight across, and the count on the Games button, a chip of the same glass ringed and numbered in `components.Rail.open`. So, on a desktop and on a short screen on its side, is the event panel's score block: the globe shows through it blurred, tinted with the score block's colors as solid as `components.EventPanel.frost` (0.55 in the dark theme), its outer edges lit by the panel's edge line; its scores sit on panes of the same glass, a faint light tint with a hairline rim, and its records are lifted off it. The rest of the panel, and the score block on a phone (where the venue's photo fills the panel), is solid. Everything else over the globe is solid, its theme surface color with nothing behind it blurred, so its contents stay readable (ADR-0023): the rest of the event panel, the rail's popovers (Map Type, Games, Leagues, Display Settings, More and the Feedback panel, and the top rail's Scenario popover on local runs), welcome tour panels, the no-pins message, the demo label, and tooltips. Pins are unchanged.

A score card's glass has a **frost**, from 0 to 1 (`components.ScoreCard.frost`, 0.6 in the dark theme):

- at **0**, clear glass: the globe behind is sharp, its color lifted; the edges catch the light, brightest at the top left, with a faint sheen across;
- at **1**, opaque: the card's fill, solid.

In between, the fill is as solid as the frost, while the edges and sheen dim, and the card casts a soft shadow onto the globe in the background's color. The frost clears more than the fill: its header's tint, its status glow inside it and its logo plates clear with it too, so at 0 a card is only its edge, text and logos, and its outline and glow outside keep its status look (Live's glow, Final's fade). Logos drawn for a light background are harder to see the clearer the glass. A score card's glass isn't blurred, whatever its frost: the globe behind it shows sharp under its tint (ADR-0018), so its frost is how solid that tint is.

Trails let the map show through by their own `opacity` (see [On the globe](#on-the-globe)), their glow keeping its own.

### Tooltips

Tooltips are drawn by the page, not the browser, whose own can't be styled: anything on the page with a `data-tooltip` shows it in a small panel (`web/src/tooltip/Tooltips.tsx`), centered above it, or below where there's no room (beside a rail button, level with it on its left, so it covers none of the others), after the pointer rests on it half a second, or at once on keyboard focus. It eases in from what it's for, or shows at once with reduce motion on, and goes on the pointer leaving, a press, Escape or a scroll. Text cut short with an ellipsis (the event panel's lines) has its tooltip only while it's cut short; on a touch screen, where nothing hovers, a tap on it shows the tooltip at once in place of what the tap would do, for 5 seconds or until the next press, and a second tap does what a tap does there (the venue's name and city go to Google Maps). Text that fits takes taps as usual. The app sets no `title`, so the browser never shows a tooltip of its own; only the local-run tools keep the browser's.

### Hover

While the pointer is on a score card, its game is picked out: the card's border is bolder, and so are its trail and the venue dot the trail ends at, the dot lit in a glow of the game's color, and the dot on the card where the trail meets it is bigger. Its settings are `components.Hover`: `card.borderWidth` and `card.solid` (whether a card frosts over fully, as if its frost were 1, written to CSS as `1` or `0`), `trail.width` and `.opacity` (the hovered trail's own, in place of the trail's opacity; the venue dot's ring takes the width too), `venue.radius` and `.glow.radius`, `.opacity`, and `cardDot.radius`. The bolder border is drawn as a ring around the card, so a hovered card keeps its size and never moves. The card eases into its hover look, or changes at once with reduce motion on; the trail and dot change at once. The selected game's card and trail keep this look for as long as it's selected, so it shows on touch screens too, where a tap selects; selection's outline is drawn around it as well. Deselecting it, or selecting another game, returns it to normal.

## Typography

The page's text is one font family, `typography.fontFamily`, in **type styles**, MUI's typography variants: each a `fontWeight` (1 to 1000), a `fontSize` in pixels and a `letterSpacing` in ems. The page's CSS chooses which type style each kind of text is, as a component's styles choose a variant in MUI; a theme changes how a type style looks, not which one a thing uses. Some text takes a style's weight but stays at the size of the text around it (a score card's team abbreviations and scores), or a style's size in another's weight (the event panel's close button).

| Type style | Which text | Dark theme |
| --- | --- | --- |
| `h6` | Scores on the event panel; a score card's scores take its weight; the event panel's and the rail's panels' close buttons and the loading screen's message take its size | 700, 20 |
| `subtitle1` | Team names on the event panel; the name heading Leagues, Display Settings and Games, over a line, with a close button at its right, pinned as they scroll (Map Type and More, menus beside their buttons, and Feedback, with its Cancel, have none); a score card's team abbreviations take its weight | 700, 16 |
| `subtitle2` | A score card's text and the loading screen's message take its weight | 600, 12 |
| `body1` | Body text | 400, 16 |
| `body2` | The event panel (its close button takes its weight), the rail's popovers, the scenario clock and the loading screen's error | 400, 14 |
| `button` | Buttons: sport names in Display Settings, league chips, the scenario pill and the scenario it has on | 600, 14 |
| `caption` | Secondary lines: the event panel's notes and stream links, the counts and hint in Leagues; tooltips | 400, 12 |
| `overline` | The event panel's headings: its league and labels, tracked out, and its progress line; a sport's name in Leagues, and Display Settings' "Card colors" heading, in capitals | 700, 12, 0.14em |
| `footnote` | The event panel's labels on a phone | 400, 11 |
| `small` | A score card's text: its team abbreviations and scores, in their own weights, and the rest in `subtitle2`'s | 600, 10 |
| `tiny` | The smallest on the page: a score card's header line, and a ranked college team's poll place before its abbreviation (in `text.secondary`) | 400, 9 |

`footnote`, `small` and `tiny` are ScoreMap's own, smaller than MUI's `caption`. Score cards are kept small so more of them fit on the globe, a phone's above all: this is variant B of the comparison preserved on the throwaway branch `prototype/smaller-cards`, chosen by the user on November 12, 2026, for every screen size. The dark theme writes everything in `'Open Sans Variable', 'Open Sans', sans-serif`, so the app looks the same on Windows, Mac and phones. The theme gives only the family: the font itself has to be loaded by the app. Open Sans is bundled with it (`@fontsource-variable/open-sans`, imported in `web/src/main.tsx`, weights 300 to 800), so a theme using another web font needs its loading added in code. Scores keep their digits lined up as they change: the CSS asks for tabular figures, and Open Sans's figures are already tabular.

Text on the globe is drawn in other fonts (see [Text on the globe](#text-on-the-globe)), but its sizes are type styles' sizes.

## Spacing and shape

- **`spacing`**: the spacing unit, in pixels: every padding, margin and gap on the page is a number of them, as MUI's `theme.spacing(n)` gives one. The CSS writes `calc(3 * var(--spacing))`. Cards stay tight on a unit or less and panels roomy on more, from the same unit. The dark theme's is 4, so its spaces are 1, 2, 3, 4, 6, 8, 12, 16, 24 and 32 pixels (a quarter of a unit to 8).
- **`shape.borderRadius`**: the corner radius, in pixels, every corner is a number of (below), as MUI's `sx` takes `borderRadius: 2`. The dark theme's is 4. Circles (clusters) stay circles whatever it is.
- **`shape.borderWidth.thin`, `.medium`, `.thick`**: the page's borders and dividers. The score card's border and header line, dividers, league chips, the rail's popovers' outline and the event panel's top edge are `thin`, a color swatch's ring and the outline of the welcome tour's choices on Welcome `medium`, a map type's picture's frame `thick`. The dark theme's are 1, 2 and 3.

### Corners and the cut corner

Each component's corners are a number of corner radii, or `"pill"`, round enough to make any control a pill:

| Setting | Which corners | Dark theme |
| --- | --- | --- |
| `components.ScoreCard.corner` | A score card's | 1.5 (6px) |
| `components.EventPanel.corner` | The event panel's | 2 (8px) |
| `components.Menu.corner` | A menu's: the rail's groups, buttons and popovers (More's rows too), the Feedback panel's text box, a tooltip | 2 (8px) |
| `components.MenuItem.corner` | An item's in a menu | 1.5 (6px) |
| `components.Controls.message.corner` | A message's, such as "No games right now." | 2 (8px) |
| `components.Controls.corner` | A control's: a speed key, league chips, "Reset colors", the Feedback panel's buttons | `pill` |

The **cut corner** cuts off the event panel's bottom left corner, like a broadcast graphic, for a more angular theme: `components.EventPanel.cutCorner.on` (`true` or `false`) and `.size`, how far along each side, in spacing units. It's beveled (CSS `corner-shape`) rather than clipped, which would stop the score block's glass seeing the globe, and only on a desktop. The dark theme has it off (size 4, unused). The panel's top right corner is square, where the close button's tab rises from it, and on a phone (640px wide or less) every corner is.

### Logo plates

Every team logo, on a score card and in the event panel, sits on a **plate**: a block of a color that contrasts with the card's fill and the panel, so that a logo near their color (a navy logo on a navy card) can still be seen. A team with no logo (ESPN gives none for most college basketball opponents from outside Division I), or whose logo won't load, shows its **mark** instead: its abbreviation's first letter, bold, on the plate, in the card's fill or the panel's score block color, its plate solid however frosted the glass is, as a logo is; the Games list shows the same mark on its own round plate. A missing flag leaves its space empty, with no plate. A score card's plate fades into its fill with the logo as the card fades. A plate is as solid as the glass it's on is frosted, so on clear glass there's none (see [Glass](#glass)).

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.ScoreCard.logo.plate.fill`, `components.EventPanel.logo.plate.fill` | The plate's color (a color job) | `offWhite.500`, `offWhite.500` |
| `components.ScoreCard.logo.plate.padding`, `components.EventPanel.logo.plate.padding` | How far the plate reaches past the logo on each side, in spacing units. The logo keeps its size (`size.logo`); the plate adds to it | 0.25 (1px), 1 (4px) |
| `components.ScoreCard.logo.plate.corner`, `components.EventPanel.logo.plate.corner` | The plate's corners, in corner radii or `"pill"` | 0.5 (2px), 1 (4px) |

The logos are ESPN's usual ones, drawn for a light background, which the plate gives them. ESPN also lists a logo for dark backgrounds for most teams, but for about half of them it's the same picture, and the feed's scoreboard doesn't carry it, so ScoreMap doesn't use it: the plate is the fix for every team alike.

## Other sizes

Sizes that aren't a type style's, a number of spacing units or of corner radii are free values: pixels, any number from 0 up (an offset may be negative), or ems where a size goes with its text and should grow with it (letter spacing, which may be negative, and boxes sized to their characters). The dark theme keeps the look before it for all of these. A size from the window's height is in `dvh` (the window as it is) or `svh`, never `vh`, which on iOS Safari is taller than the window while its toolbar shows; a unit test (`web/scripts/viewportUnits.test.ts`) fails on a `vh` in `web/src`.

### On the globe

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.Globe.<line>.width` | A line's width by zoom, for `coastlines`, `countryBorders`, `stateLines` and `disputedBorders`: a width at each of some zoom levels (`{ "2": 0.9, "8": 1.6 }`), growing evenly between them; one zoom level is a fixed width | coastlines 0.9 to 1.6 (zoom 2 to 8), country borders 0.9 to 1.8 (2 to 8), state lines 0.6 to 1.2 (3 to 8), disputed borders 0.8 |
| `components.Globe.disputedBorders.dash` | The disputed borders' dash pattern: the lengths of the dashes and the gaps between them, in line widths, at least two | `[2, 2]` |
| `components.Globe.halo.inner.blur`, `.spread`, and `outer`'s | How far each of the halo's glows blurs and spreads, growing with the globe on screen: `{ share, max }`, that share of the globe's radius on screen, but never more than `max` pixels | inner blur 0.12 up to 60, spread 0.04 up to 20; outer blur 0.35 up to 160, spread 0.08 up to 40 |
| `components.PlaceNames.<kind>.outline.width`, `.blur` | The outline around a place name's letters | 2 and 0.5; state names 1.5 and 0.5 |
| `components.PlaceNames.city.dot.radius`, `.ring` | The dot where a named city is, in the city name's color, and the ring around it in the name's outline color | 2.25 and 0.75 |
| `components.Cluster.radius` | How far a card cluster's disc reaches, outline and all | 13 |
| `components.Cluster.glowRadius` | Its glow's radius | 26 |
| `components.Cluster.outlineWidth` | A cluster's outline | 1.5 |
| `components.Cluster.glowOpacity` | A cluster's glow, as a share of its status's pin glow opacity (0 to 1) | 0.6 |
| `components.Trail.width`, `.opacity` | A moved score card's trail back to its venue: its width, and how opaque it is, below 1 letting the map show through | 1.25, 0.63 |
| `components.Trail.glow.width`, `.blur`, `.opacity` | The soft glow along a trail | 4, 3, 0.25 |
| `components.Trail.venue.radius` | The dot at the trail's venue | 2 |
| `components.Trail.venue.ring.radius`, `.width` | The ring around that dot. A venue cluster is the same dot and ring | 5, 1 |
| `components.Trail.cardDot.radius` | The dot in its game's color on a score card's edge where its trail meets it, so it's plain which card a trail is | 2 |
| `components.Selection.width` | The selected pin's ring and score card's outline. The ring reaches as far out whatever its width | 2 |
| `components.Hover.trail.width`, `.opacity` | A hovered card's trail, and its venue dot ring's width (see [Hover](#hover)) | 2.5, 1 |
| `components.Hover.venue.radius` | A hovered card's venue dot | 3.5 |
| `components.Hover.venue.glow.radius`, `.opacity` | The glow around that dot, in its game's color | 12, 0.6 |
| `components.Hover.cardDot.radius` | A hovered card's dot where its trail meets it | 2.75 |
| `components.Pulse.size.pin`, `.cluster` | How wide a pulse's ring starts, over a small pin and over a cluster | 16, 36 |
| `components.Pulse.ring` | How thick a pulse's ring is | 3 |

### On the page

The event panel opens with its score, venue and bottom tab bar. The league and progress chip share a row above the scores. Long names and clock lines use an ellipsis with the full text on hover or tap. The TV icon opens **Watch and game info**, with the broadcast network when available and logo links to StreamEast and ESPN. The close button sits in the panel’s upper-right corner.

On desktop the score block is glass (see [Glass](#glass)), with the venue photo cropped to the area beside its slanted edge. On narrow screens, the photo is behind the score and venue rows, with the same crop while another part of the panel changes height. The photo uses `components.EventPanel.photo.opacity`; a faint glow fills its place when there is no photo. A field’s whole leaderboard is in the score block, a line each, scrolling within its two-line height. A band below the header holds tennis sets or a fight card’s bouts. The panel edge uses `text.primary` at 18%, and when a team scores, its row lights up (see [Where the theme reaches](#where-the-theme-reaches)).

Selecting a tab slides its content up above the tab bar over 220 ms. The down chevron collapses it. The tab bar stays at the foot of the panel, and the details and sport-specific band can scroll when space is tight. With reduced motion, opening and collapsing are immediate.

| Setting | What it is | Dark theme |
| --- | --- | --- |
| `components.EventPanel.shadow`, `components.Rail.shadow`, `components.Controls.shadow` | A drop shadow: `{ x, y, blur, color }`, how far it falls across and down, how far it blurs, and its color | none (`transparent`, blur 0) |
| `components.EventPanel.glow.y`, `.blur`, `.opacity` | The glow in the game's color along the event panel's top | 0, 0, 0 (none) |
| `components.Hover.card.borderWidth`, `.solid` | A hovered score card's border width, and whether it frosts over fully (see [Hover](#hover)) | 2.5, on |
| `components.ScoreCard.header.tint` | How strongly a score card's header is tinted with its game's color, 0 to 1, at a frost of 1: the tint clears with the card's glass (see [Glass](#glass)). The header's text is the card's text or its fill, whichever reads better on the tint | 0.28 |
| `components.ScoreCard.header.letterSpacing` | How far apart the letters of a score card's header line are spaced, in ems | 0.06 |
| `components.Controls.off.opacity` | How opaque a speed key that's off, a rail button that can't be used (zoom at its limit) and "Reset colors" with no colors to reset are, 0 to 1 (a speed key that's on, or under the pointer, is opaque) | 0.6 |
| `components.LoadingScreen.dim.opacity` | How opaque the cut-off note's dim is over the globe, 0 to 1 (the loading screen is solid) | 0.6 |
| `components.LoadingScreen.glow.radius`, `.opacity` | How far the glow around the loading screen's message reaches, and how strong it is, 0 to 1 (its ellipsis's dots glow half as far, at full strength) | 14, 0.45 |
| `components.WelcomeTour.dim.opacity`, `.arrow.width` | How opaque the welcome tour's dim is over the globe (in the background's color, under a step's panel and around its spotlight), 0 to 1, and how wide the flowing arrow from a step's panel is | 0.6, 2.5 |
| `components.WelcomeTour.choice.topEvents`, `.myLeagues`, `.everything` | The outline of each of Welcome's choices, a color of its own so the three tell apart; it stays on hover, which lights the choice behind | `gold.500`, `navy.300`, `#6dbb8a` (a green outside the theme's colors) |
| `components.Sky.stars.size.small`, `.large` | The stars in the sky around the globe, small and large | 1, 1.5 |
| `components.EventPanel.photo.opacity` | How opaque the venue's photo is behind the venue (on a phone, behind the header), 0 to 1 | 0.4 |
| `components.EventPanel.size.width` | The event panel's width at most | 900 |
| `components.EventPanel.size.height` | The score and venue header’s minimum height on desktop | 128 |
| `components.EventPanel.size.scoreBlock`, `.slant` | The score block's maximum width (also capped at 42% of the desktop panel), and how far its right edge slants | 504, 16 |
| `components.EventPanel.size.logo` | A team's logo | 28 |
| `components.EventPanel.size.close.width`, `.height` | The close button, in the panel's top right corner | 30, 26 |
| `components.EventPanel.size.scoreWidth` | A team's score box at its narrowest, in ems of its digits: wide enough for three, so a score of 100 moves nothing. A longer score (cricket's "170/6") widens every row's box alike | 2.6 |
| `components.ScoreCard.size.minWidth` | A score card's narrowest. Its size is set when it's first drawn (see [Where the theme reaches](#where-the-theme-reaches)) | 64 |
| `components.ScoreCard.size.logo` | A team's logo on a score card | 12 |
| `components.ScoreCard.size.venueGap` | How far above its venue a score card sits, and how near it may come when moved aside, its trail between (the globe places cards by this) | 16 |
| `components.ScoreCard.size.nameClearance` | How far score cards keep clear of the letters of a city named for a game (its outline included; the globe lays cards out by this) | 4 |
| `components.Rail.size.button`, `.icon` | A button on the rail, and its icon | 36, 18 |
| `components.Rail.size.mapType` | Each map's picture in Map Type, square: a tile of the satellite map's imagery, and the plain map drawn small in the globe's land, sea, coastline and border colors | 64 |
| `components.Rail.size.width`, `.allLeagues` | A popover's width (on a phone, all the width left of the rail) and the Feedback panel's, the "All leagues" chip's height | 320, 32 |
| `components.Rail.size.countWidth` | The narrowest a count of leagues is, in ems | 3.2 |
| `components.Controls.size.key`, `.icon` | A speed key and its icon | 34, 14 |
| `components.LoadingScreen.rocket.size` | The loading screen's rocket, its box across | 64 |
| `components.LoadingScreen.dot` | Each dot of the loading screen's closing ellipsis, across | 5 |

## Text on the globe

The globe's text (place names and the count on a pin or card cluster) is drawn by MapLibre from the map's font server, fonts.openmaptiles.org, not from the page's fonts (ADR-0006). A globe font is given by the name the server knows it by, and must be one it has: for a font it lacks, the server answers with a web page rather than an error and the text falls back to a browser font, so checking rejects any other. The fonts it has (listed in `globeFonts`, `web/src/theme/globeFonts.ts`, checked in October 2026):

- **Open Sans**: Light, Light Italic, Regular, Italic, Semibold, Semibold Italic, Bold, Bold Italic, Extra Bold;
- **Klokantech Noto Sans**: Regular, Italic, Bold (it has no plain "Noto Sans");
- **Metropolis**: Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black, each also Italic.

Each is written in full, family and variant: `"Open Sans Semibold"`, `"Metropolis Black Italic"`.

| Setting | Which text | Dark theme |
| --- | --- | --- |
| `components.PlaceNames.<kind>.font` | A kind of place's name | city `Open Sans Semibold`, state `Open Sans Semibold`, country `Open Sans Bold` |
| `components.PlaceNames.<kind>.size` | Its size by zoom: a type style, whose size it takes, at each of some zoom levels (`{ "4": "caption", "11": "h6" }`), growing evenly between them | city `caption` at zoom 4, `body2` at 7, `h6` at 11; state `footnote` at 3 to `body2` at 8; country `footnote` at 1 to `body1` at 4 |
| `components.PlaceNames.<kind>.letterSpacing` | How far apart its letters are spaced, in ems. State and country names are always in capitals, which want more | city 0, state 0.18, country 0.12 |
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
6. **Look at it running.** How the app looks isn't tested automatically: check it in the `worldwide`, `crowded` and `edge-cases` scenarios (the `run-scoremap` skill), on the globe zoomed out and in, with the event panel and the rail's popovers open, and on a phone-sized window.

### Adding a setting

A new setting goes in the settings in `web/src/theme/theme.ts` and in every theme's JSON, since a theme without it is rejected; its custom property then appears on the page by itself. A part's own look goes in its component, under `components`; what's shared goes where MUI keeps it, in the palette, the typography, `spacing` or `shape`. The page's CSS reads it through that custom property. Likewise a setting taken out must leave every theme's JSON, since a theme with a setting it doesn't know is rejected. Either way, change its count in the "writes every setting" test (`web/src/theme/applyTheme.test.ts`), which counts every setting written to the page by hand.

### What stays in code

Some of the look is in code on purpose, as behavior or layout rather than a theme's choices:

- motion: durations, easings and the shapes of the animations, including the sizes and opacities inside their keyframes;
- how a score card's glass works out from its frost (see [Glass](#glass)): how bright the edges and sheen are, and the shadow it casts; and the event panel score block's: how far it blurs, its lit edges, and its score boxes' panes and lifted records;
- the event panel's fade behind each line on a phone, and how far a scoring row's light reaches;
- the starfield's pattern (where each star sits in its tile, how bright it is, the tile's size) and skew angles;
- layout: line heights, percentages, and slots sized in lines (`lh`, such as the event panel's room for two lines of a venue);
- score card and pin footprints, card layout distances (`cardLayout.ts`), how far the selected pin's ring reaches, and where a city's name sits from its dot (`cityNameOffset` in `placeNames.ts`, 1 em) and where it wraps (as the base map style has them);
- that a glow on the globe (a small pin's or a card cluster's) fades out all the way to its edge (`circle-blur: 1`): how far it reaches and how strongly it glows are the theme's;
- a flame's drawing, and a score card's tongues of flame: how many, their heights and pace (see [Hot games' flames](#hot-games-flames));
- icons' drawings: their shapes and line widths, in the units of their own `viewBox`, which the CSS sizes to the theme's sizes;
- which kinds of place are named in capitals (states and countries);
- that a text box is at least 16px on a touch screen, so Safari on an iPhone doesn't zoom the page in on focusing it;
- which type style, how many spacing units and which border width each thing on the page uses (the CSS), and which status is most prominent and draws on top (the status look, `web/src/globe/statusLook.ts`).

No test holds the code to this list; that's for review. While a look is being tried, a value may go straight into the CSS or the TypeScript. Once it's settled, it moves into the theme (see [Adding a setting](#adding-a-setting)), unless it belongs on this list.
