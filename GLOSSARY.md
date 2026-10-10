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
While zoomed in, the panel a pin shows as, above the game's venue, with the teams, the score and a line on the game's progress. When cards would overlap, some are moved aside with a trail back to their venue.
_Avoid_: Tile, label, badge, card (alone, outside the globe's code)

**Card style**:
The look a viewer picks for every score card in the settings menu: HUD (the default), LED scoreboard, Broadcast bug, Tactical or Neon sign. It changes only how cards look, not what they show or where they go.
_Avoid_: Theme, skin, card look

**Cluster**:
Games shown as one marker with a count because there's no room to show them apart: while zoomed out, pins close enough to overlap; while zoomed in, games whose score cards have no room on screen even after nearby cards are moved aside. It splits apart as you zoom in, or zooms in until it does when selected.
_Avoid_: Crowd, bubble, group, stack, pile

**Game panel**:
The detailed view of one game, opened by selecting its pin, shown as a strip across the bottom of the globe.
_Avoid_: Popup, detail page, modal

**Pulse**:
The short animation a pin, score card or cluster plays to draw the eye to a change in a game: when its score changes, when it starts and when it finishes. It changes nothing about what's shown. In basketball, a score change pulses only in clutch time.
_Avoid_: Blip, alert, notification, highlight (the selected pin is highlighted), flash

**Clutch time**:
In basketball, the last 5 minutes of the last period of regulation, or any time in overtime, while the score is within 5 points. Borrowed from the NBA's clutch-time stat.
_Avoid_: Crunch time, close game

**Venue**:
The stadium or arena where a game is physically played, with its city and country. Not necessarily the home team's city.
_Avoid_: Stadium, arena, location, home city

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
The time a scenario's games are on. It reads the real time when the scenario starts, then runs at the scenario's speed, so it moves ahead of the real time at any speed above 1×.
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
