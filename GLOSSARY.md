# ScoreMap

A globe showing sports games happening around the world, with live scores, so fans can follow games visually and learn where things happen.

## Language

**Sport**:
A kind of game, such as football, basketball or soccer. Sports group leagues in the settings menu. ScoreMap is for viewers in the US, so football means American football, and soccer is soccer.
_Avoid_: American football, football (for soccer)

**League**:
A competition whose games ScoreMap shows, such as the NFL, NCAA Football, the Premier League or the World Cup. A league belongs to exactly one sport, and it is the unit users show or hide in the settings menu.
_Avoid_: Competition, tournament, conference, governing body (e.g. "NCAA" or "FIFA" alone)

**Game**:
A single contest between two teams in a league, played at one venue at a scheduled time.
_Avoid_: Match, fixture, event

**Pin**:
The marker for one game on the globe, placed at the game's venue.
_Avoid_: Marker, dot, icon

**Score card**:
While zoomed in, the panel a pin near the centre of the view shows as, above the game's venue, with the teams, the score and a line on the game's progress. When cards would overlap, some are moved aside with a trail back to their venue. Farther out, pins stay small, so cards don't crowd the globe's rim.
_Avoid_: Tile, label, badge, card (alone, outside the globe's code)

**Cluster**:
Games shown as one marker with a count because there's no room to show them apart: a pin cluster or a card cluster. It splits apart as you zoom in, or zooms in until it does when selected. A pin cluster far from the centre of a zoomed-in view turns the globe to it instead, and its games get score cards.
_Avoid_: Crowd, bubble, group, stack, pile

**Pin cluster**:
A cluster of small pins close enough to overlap: while zoomed out, or zoomed in, far from the centre of the view.
_Avoid_: Cluster (when it matters that it's pins)

**Card cluster**:
While zoomed in, a cluster of games whose score cards have no room on screen even after nearby cards are moved aside. It depends on room for cards, not on how close the pins are.
_Avoid_: Crowd, cluster (when it matters that it's cards)

**Game panel**:
The detailed view of one game, opened by selecting its pin, shown as a strip across the bottom of the globe.
_Avoid_: Popup, detail page, modal

**Pulse**:
The short animation a pin, score card or cluster plays to draw the eye to a change in a game: when its score changes, when it starts and when it finishes. It changes nothing about what's shown. In basketball, a score change pulses only in clutch time. With the device's reduce motion setting on, a pulse fades in place without moving.
_Avoid_: Blip, alert, notification, highlight (the selected pin is highlighted), flash

**Clutch time**:
In basketball, the last 5 minutes of the last period of regulation, or any time in overtime, while the score is within 5 points. Borrowed from the NBA's clutch-time stat.
_Avoid_: Crunch time, close game

**Venue**:
The stadium or arena where a game is physically played, with its city and country. Not necessarily the home team's city.
_Avoid_: Stadium, arena, location, home city

### Loading

**Loading screen**:
What ScoreMap shows when it first opens, until it's ready: the globe dimmed as it loads, with a spinner, and a message if it's slow. The settings menu and scenario pills can still be used, but the globe can't be moved yet.
_Avoid_: Spinner (it's one part), splash, overlay, veil

**Ready**:
The moment, once each time ScoreMap is opened, that the first games are on the globe and everything has stopped moving: pins, score cards, trails and place names. The loading screen goes then, and doesn't come back.
_Avoid_: Loaded, settled, done

### Look

**Theme**:
The whole of how ScoreMap looks, the globe included, as one JSON file checked when it's loaded, shaped as a Material UI theme is: its colours, a palette, typography, spacing and shape, each status's look, and each part's own look under its components. ScoreMap has one, built in.
_Avoid_: Skin, style (the globe's map style is MapLibre's), card style

**Theme colours**:
A theme's named base colours (`colors`), each worked out into steps from light (100) to dark (900), its base colour at 500, such as `navy.700`.
_Avoid_: Colour scheme, swatches, tokens

**Palette**:
What a theme's main colours are for, as MUI's palette has them: primary, secondary, error and warning, and a colour for each game status (each a main shade, a lighter and a darker one, and the text on it), the background, text, the divider and hover. Each names a step of the theme colours. The rest of how a status looks is each component's own: a pin's, a cluster's, a score card's.
_Avoid_: Colour scheme, tokens

**Colour job**:
What a colour in a theme is for, such as the globe's surface, Live's colour or main text, rather than which colour it is. It names a step of the theme colours, such as `navy.700`, or one of the palette's colours, such as `primary.dark`, or gives a colour directly. A game's status shows by its glow and brightness; its colour is kept to stand for its league.
_Avoid_: Token, semantic colour

**Type style**:
One of a theme's kinds of text, named as MUI's typography variants are (`body2`, `button`, `caption`…): a weight, a size and a letter spacing, in the theme's one font family. Each kind of text on the page is one, and text on the globe takes one's size.
_Avoid_: Variant, text size, font role

### Game status

**Upcoming**:
A game that hasn't started yet but starts soon enough to get a pin.
_Avoid_: Scheduled, pre-game

**Live**:
A game that has started and not yet finished, including breaks such as halftime or intermissions, and delays such as a rain delay.
_Avoid_: In progress, active, ongoing

**Disrupted**:
A game that was postponed, suspended or canceled, so it won't be played or finished as scheduled. Its pin appears greyed out.
_Avoid_: Called off, halted, inactive

**Final**:
A game that has finished and recently enough to still get a pin.
_Avoid_: Finished, completed, over, ended

### Local runs

**Scenario**:
A named set of made-up games between real teams of their league at real venues, and how they change over time, shown in place of real games when ScoreMap runs locally.
_Avoid_: Dummy data, fake data, demo, simulation

**Scenario clock**:
The time a scenario's games are on. It reads 12:00 EST on 1 January of the current year when the scenario starts (or is reset), then runs at the scenario's speed, so an event in a scenario comes at the same reading every time it plays. Real games are on the real time.
_Avoid_: Game clock (the clock within a game, such as 67'), fake time, virtual time

**Play**:
A scenario's games playing like real games, at random: Live games score and finish, Upcoming games start, some games are disrupted, and new games take the place of old ones. A scenario has play or a timeline, not both; with neither, its games stand still.
_Avoid_: Simulation, random play, live play

**Timeline**:
A scenario's written changes to its games at set times on the scenario clock, starting again from the beginning when it ends.
_Avoid_: Schedule, events

**Speed**:
How fast the scenario clock runs, by name: Paused (it stands still), Normal (real time), Fast (2×) or Faster (8×). One speed applies to whichever scenario is running.
_Avoid_: Pace, play speed, playback rate
