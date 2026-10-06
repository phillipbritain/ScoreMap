# ScoreMap

A globe showing sports games happening around the world, with live scores, so fans can follow games visually and learn where things happen.

## Language

**Sport**:
A kind of game, such as American football, basketball or soccer. Sports group leagues in the filter.
_Avoid_: Football (ambiguous between American football and soccer)

**League**:
A competition whose games ScoreMap shows, such as the NFL, NCAA Football, the Premier League or the World Cup. A league belongs to exactly one sport, and it is the unit users filter on.
_Avoid_: Competition, tournament, conference, governing body (e.g. "NCAA" or "FIFA" alone)

**Game**:
A single contest between two teams in a league, played at one venue at a scheduled time.
_Avoid_: Match, fixture, event

**Pin**:
The marker for one game on the globe, placed at the game's venue.
_Avoid_: Marker, dot, icon

**Cluster**:
While zoomed out, a group of pins close enough to overlap, shown as one marker with a count. It splits apart as you zoom in, or zooms in until it does when selected.
_Avoid_: Bubble, group

**Crowd**:
While zoomed in, the games whose score cards have no room on screen even after nearby cards are moved aside, shown as one count. Selecting it zooms in until it splits. Unlike a cluster, it depends on room for cards, not on how close the pins are.
_Avoid_: Cluster (zoomed-out pins only), stack, pile

**Game panel**:
The detailed view of one game, opened by selecting its pin, shown beside the globe (or as a sheet on phones).
_Avoid_: Popup, detail page, modal

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
