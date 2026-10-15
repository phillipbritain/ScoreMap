# ScoreMap

A globe showing sports games happening around the world, with live scores, so fans can follow games visually and learn where things happen.

## Language

**Sport**:
A kind of game, such as football, basketball, soccer or cricket. Sports group leagues in Leagues and Colours on the rail. ScoreMap is for viewers in the US, so football means American football, and soccer is soccer.
_Avoid_: American football, football (for soccer)

**League**:
A competition whose games ScoreMap shows, such as the NFL, NCAA Football, the Premier League or the World Cup. A league belongs to exactly one sport, and it is the unit users show or hide in Leagues on the rail.
_Avoid_: Competition, tournament, conference, governing body (e.g. "NCAA" or "FIFA" alone)

**Game**:
A single contest between two teams in a league, played at one venue at a scheduled time.
_Avoid_: Match, fixture, event

**Pin**:
The marker for one game on the globe, placed at the game's venue.
_Avoid_: Marker, dot, icon

**Score card**:
While zoomed in, the panel a pin near the centre of the view shows as, a little above the game's venue with a trail down to it, with the teams, the score and a line on the game's progress. When cards would overlap, some are moved aside, their trails following them. Farther out, pins stay small, so cards don't crowd the globe's rim.
_Avoid_: Tile, label, badge, card (alone, outside the globe's code)

**Trail**:
The line from a score card to its game's venue, ending at a ringed venue dot.
_Avoid_: Pin (for the venue dot), pointer, leader line

**Cluster**:
Games shown as one marker with a count because there's no room to show them apart: a pin cluster, a card cluster or a venue cluster. It splits apart as you zoom in, or zooms in until it does when selected. A pin cluster far from the centre of a zoomed-in view turns the globe to it instead, and its games get score cards.
_Avoid_: Crowd, bubble, group, stack, pile

**Pin cluster**:
A cluster of small pins close enough that they, or the pin clusters they'd be in, would overlap: while zoomed out, or zoomed in, far from the centre of the view. Pin clusters that would overlap combine into a larger one. MapLibre clusters them (ADR-0016).
_Avoid_: Cluster (when it matters that it's pins)

**Card cluster**:
While zoomed in, a cluster of games whose score cards have no room on screen even after nearby cards are moved aside. It depends on room for cards, not on how close the pins are.
_Avoid_: Crowd, cluster (when it matters that it's cards)

**Venue cluster**:
While zoomed in, a cluster where score cards' trails meet, in place of their venue dots, which would overlap. Its games' cards are already on screen, so selecting it does nothing.
_Avoid_: Trail cluster, cluster (when it matters that it's venues)

**Game panel**:
The detailed view of one game, opened by selecting its pin, shown as a strip across the bottom of the globe, with a band under it for how the game is going: its last score (in soccer, its key events), its situation, its betting line and its attendance.
_Avoid_: Popup, detail page, modal

**Rail**:
The column of buttons down the right of the globe: zoom in and out, Home (back to the viewer's region, all the way out), the "Live only" and "Show Disrupted games" switches, Leagues (which leagues show) and Colours (the colours picked for sports and leagues).
_Avoid_: Settings menu, quick settings, toolbar
**Last score**:
The most recent score in a game: the team that scored, what happened ("Rashee Rice 2 Yd pass from Patrick Mahomes") and when. Cricket has none, as runs come off nearly every ball.
_Avoid_: Last play (that's any play, scoring or not), scoring summary

**Situation**:
Where play stands in a Live game right now: in football the down and distance and who has the ball, in baseball the count, outs and runners, and in every sport the feed covers the last play.
_Avoid_: Game state, status (a game's status is Upcoming, Live, Final or Disrupted)

**Key events**:
Soccer's goals and cards, in the order they came, each with its team, player and minute.
_Avoid_: Incidents, timeline

**Pulse**:
The short animation a pin, score card or cluster plays to draw the eye to a change in a game: when its score changes, when it starts and when it finishes. It changes nothing about what's shown. In basketball, a score change pulses only in clutch time. With the device's reduce motion setting on, a pulse fades in place without moving.
_Avoid_: Blip, alert, notification, highlight (the selected pin is highlighted), flash

**Clutch time**:
In basketball, the last 5 minutes of the last period of regulation, or any time in overtime, while the score is within 5 points. Borrowed from the NBA's clutch-time stat.
_Avoid_: Crunch time, close game

**Venue**:
The stadium or arena where a game is physically played, with its city and country. Not necessarily the home team's city.
_Avoid_: Stadium, arena, location, home city

**City label**:
A city's name on the globe, by where the city is (with no dot), from the city list included with the app. A game's city label is always drawn; a Big city's label with no game near is drawn where there's room. See `docs/city-labels.md`.
_Avoid_: Place name (which also covers states and countries), city name tag

**Big city**:
A city in the city list with a metro population of at least 4 million, or one on the Big list. It always gets a city label where there's room.
_Avoid_: Major city, large city

**Small city**:
Any other city in the city list. It gets a city label only when a game near it needs one.
_Avoid_: Minor city, town

### Loading

**Loading screen**:
What ScoreMap shows when it first opens, until it's ready: the globe dimmed as it loads, with a spinner, and a message if it's slow. The rail and scenario pills can still be used, but the globe can't be moved yet.
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
What a colour in a theme is for, such as the globe's surface, Live's colour or main text, rather than which colour it is. It names a step of the theme colours, such as `navy.700`, or one of the palette's colours, such as `primary.dark`, or gives a colour directly. A game's status shows by its glow and brightness; its colour stands for its league or sport (see Game colour).
_Avoid_: Token, semantic colour

**Game colour**:
The colour a game shows in on its pin, score card, trail and pulses and in the game panel: the colour the viewer picked for its league in Colours on the rail, else the one picked for its sport, else the theme's colour for its status. A league with no colour of its own, including one added to the server later, takes its sport's. A Disrupted game is always the theme's Disrupted grey.
_Avoid_: Status colour (for a game's colour), team colour

**Type style**:
One of a theme's kinds of text, named as MUI's typography variants are (`body2`, `button`, `caption`…): a weight, a size and a letter spacing, in the theme's one font family. Each kind of text on the page is one, and text on the globe takes one's size.
_Avoid_: Variant, text size, font role

**Glass**:
What every surface over the globe is made of (score cards, the game panel, the rail, the scenario controls, tooltips): a pane the globe shows through, tinted with the surface's colour, its edges catching the light (ADR-0018).
_Avoid_: Background, see-through fill

**Frost**:
How frosted a component's glass is, from 0, clear glass the globe shows sharply through, to 1, opaque frosted glass the globe can't be seen through. A theme setting of each component that's glass.
_Avoid_: Transparency, opacity (for glass), blur

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
The time a scenario's games are on. It reads noon Eastern on 4 August 2026 when the scenario starts (or is reset), then runs at the scenario's speed, so an event in a scenario comes at the same reading every time it plays. Real games are on the real time.
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
