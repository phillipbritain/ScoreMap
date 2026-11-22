# ScoreMap

A globe showing sports events happening around the world, with live scores, so fans can follow events visually and learn where things happen.

## Language

**Sport**:
A discipline such as football, basketball, soccer or cricket. Sports group leagues in Leagues and Display Settings on the rail. ScoreMap is for viewers in the US, so football means American football, and soccer is soccer. Rugby means rugby union.
_Avoid_: American football, football (for soccer), rugby union (say rugby)

**League**:
A competition whose events ScoreMap shows, such as the NFL, NCAA Football, the Premier League or the World Cup. A league belongs to exactly one sport, and it is the unit users show or hide in Leagues on the rail.
_Avoid_: Competition, tournament, conference (a part of a league), governing body (e.g. "NCAA" or "FIFA" alone)

**Conference**:
A group of teams within a college league, such as the SEC or the ACC in NCAA Football, as ESPN groups them. In Leagues on the rail, and in the welcome tour's My leagues, a viewer can narrow a league with conferences to some of them: it then shows only its events with a team, either side, in a chosen one.
_Avoid_: Division, group (ESPN's word for it in its feed)

**Event**:
A scheduled contest in a league at one venue, between two sides, among a field, or made up of bouts. ScoreMap tracks a tennis match, an F1 race, a golf tournament, and a UFC fight card as one event each (ADR-0020, ADR-0032).
_Avoid_: Game, match, fixture, race (as generic terms for all events)

**Tournament**:
In tennis, the week or two of matches a league plays at one place, such as the Rolex Shanghai Masters in the ATP: each match is an event, and the tournament groups those matches within the league. In golf, the four rounds a field plays at one course, such as the Mexico Open, which is itself one event.
_Avoid_: Competition

**Side**:
One of the two competing in an event or a bout: a team, a fighter, or in tennis a player or a doubles pair.
_Avoid_: Competitor, participant, opponent

**Field**:
Everyone competing in an event that has no two sides, such as a NASCAR race, an F1 race or a golf tournament, ranked by position.
_Avoid_: Grid, leaderboard (that's the field as the event panel lists it), competitors

**Entrant**:
One of a field: a driver, or a golfer.
_Avoid_: Competitor, player, driver (for any entrant), runner

**Fight card**:
A UFC event made up of bouts at one venue on one night, with the main event last.
_Avoid_: Card (alone, which is a score card), event, show, fight night

**Bout**:
One fight on a fight card, between two sides.
_Avoid_: Fight, match

**Top event**:
An event ESPN lists in its Top Events, the events it picks as the most important right now across every sport, as its front page shows them. "Top Events" in Leagues on the rail shows only these, whichever leagues are switched off.
_Avoid_: Featured event, highlight, hot event (ScoreMap's own, by the score and time left)

**Running game board**:
One shared set of events being kept current for its viewers, including their first snapshot and the changes that follow. Real events (or the local scenario) have one running game board; a demo has its own, shared by every demo viewer (ADR-0019).
_Avoid_: Per-viewer board, poller (for the whole running game board)

**Pin**:
The marker for one event on the globe, placed at the event's venue. An event whose venue isn't placed yet (its lookup still running, or finding nothing) has no pin, though it is in the Events list.
_Avoid_: Marker, dot, icon

**Score card**:
At any zoom, the panel a pin shows as, a little above the event's venue with a trail down to it, with the teams and the score (for a field, its top three; for a fight card, the bout on now) and a line on the event's progress, or its start time before it starts. Every event whose venue is on screen, on the side of the globe facing the viewer, has one, up to the card count; past it, or with no room, its event is in a card cluster or shows as its small pin. When cards would overlap, some are moved aside, their trails following them. An event whose venue is off screen or behind the globe has no card, but the selected event.
_Avoid_: Tile, label, badge, card (alone, outside the globe's code)

**Pinned score card**:
A score card the viewer asks to keep in place for this visit. It holds its position relative to its venue, gets first claim on the card count, and can be pinned or unpinned from its card or the Pinned section and event rows in Events.
_Avoid_: Pinned event, saved event

**Trail**:
The line from a score card to its event's venue, starting at a small dot in its event's color on the card's edge and ending at a ringed venue dot. Drawn as a transit map's line: across, up or down and at 45°, its one bend rounded off. It leaves its card straight out or at 45°, never along the card's edge, where it crosses the fewest other cards and trails.
_Avoid_: Pin (for the venue dot), pointer, leader line

**Cluster**:
Events shown as one marker because there's no room to show them apart: a card cluster, with a count, or a venue cluster. It splits apart as you zoom in. Clicking a card cluster brings its score cards into the current view where they fit.
_Avoid_: Crowd, bubble, group, stack, pile

**Card cluster**:
A cluster of events whose score cards have no room on screen even after nearby cards are moved aside, or that are past the card count: where it's busy, a screen shows at most as many cards as the viewer's card count allows, for the events most worth watching (those near the middle of the screen first, then hot events, other Live events, Upcoming and Final, ranked teams first), with priority for pinned cards and events the viewer asks to reveal. It depends on room for cards and that count, not on how close the pins are. A card cluster that a venue cluster, venue dot or other card cluster would overlap takes them in: it counts all their events, their trails meet at it, and clicking it gives those events priority in the current view. It always holds two or more events: an event with no room for its card that nothing else would overlap shows as its small pin instead. Clicking the small pin brings its score card back where it fits.
_Avoid_: Crowd, cluster (when it matters that it's cards)

**Card count**:
How many score cards a screen shows at once where it's busy, picked in Display Settings on the rail: Fewer (10 on a phone, 20 on a wider screen), Default (20, 30) or More (30, 40). The rest are in card clusters. Fewer cards means fewer trails.
_Avoid_: Card density, max cards (to the viewer)

**Venue cluster**:
A cluster where score cards' trails meet, in place of their venue dots, which would overlap. Its events' cards are already on screen, so it shows no count, and selecting it does nothing.
_Avoid_: Trail cluster, cluster (when it matters that it's venues)

**Card layout**:
Where each event's score card goes on screen, and which events gather into card clusters or venue clusters or show as their small pins, worked out from the last frame while the camera moves or an action changes which cards should show: a card moves only to keep clear of others, to come back over its venue, or to come within 80 px of it. With the camera still, cards and trails hold their places until the viewer pins or reveals a card or changes the card count. A card keeps the size it was first drawn at. When cards are first laid out, those moved aside around a city are handed round their spots so they go round it in the same order as their venues, and their trails don't cross.
_Avoid_: Card placement (for the whole of it: placing is only where the cards go), arrangement

**Event panel**:
The view of one event, opened by selecting its pin. It shows the score, clock and venue across the bottom of the globe, with a TV button for Where to watch. Tabs open the event details above the tab bar; a panel opens them as the last one's were left, open or collapsed, after a reload too, collapsed until the viewer first opens them, and a welcome tour's panel always opens them collapsed, keeping nothing done to them there. A field’s leaderboard scrolls in the score block; a band lists tennis sets or a fight card’s bouts when available.
_Avoid_: Game panel, popup, detail page, modal

**Rail**:
The column of buttons down the right of the globe: zoom in and out, Home (back to the viewer's region, where a first visit opens; these three left out on a touchscreen, which pinches to zoom), Leagues (which leagues show), Events (every event shown, by league, with a search, to find one and go to it), Display Settings (whether the event panel shows venue photos, whether hot events show their indicator, the globe as its Plain map or as satellite imagery (ADR-0022), the card count, and the colors picked for sports and leagues) and More.
_Avoid_: Settings menu, quick settings, toolbar

**Welcome tour**:
What a first visit shows once ScoreMap is ready, in seven steps, each a panel in the middle of the screen: Welcome (what ScoreMap is, and what to see first: Top Events, My leagues or Everything; My leagues opens the same leagues to pick, conferences included, as Leagues on the rail, applied only with "Show these"), Your controls (how to move and zoom the globe, worded for a touchscreen or a mouse, then each button on the rail, with the rail lit and the step right beside it), Click a score card (with an arrow to the Ravens v Steelers card, and no Done: pressing the card moves on), then, once that card is pressed and its event's panel opens, the event panel's three, each lighting a part of the panel (dimming the rest of it with the globe), with no arrow, the panel usable throughout, but for its tabs until Event details: The event panel (its score block: ScoreMap is live, scores changing there and on the event's card as it happens, with no need to refresh), Event details (its tabs, the step right above them, over the panel; pressing a tab moves on, as Next does) and Where to watch (its TV button, with an arrow to it); and All set (the end of the tour, with Done). The rest of these last four sit in the middle of the screen on a desktop, or right above that panel on a phone or where the middle would run into it. The rail can't be used under it, but for More (its Send feedback, Install app and Welcome tour, which starts the tour again from Welcome), shown throughout: on Welcome, before the rest of the rail comes in, at the rail's top. A step's buttons (Back, Show these, Next, Done) sit in its action button panel, a slim band across the foot of the step's panel, with Skip tour at its start on Welcome. The Demo Mode label doesn't show while it does, in a demo too: the tour itself says its events are there to show ScoreMap off. The globe starts empty and shows Tour events once the viewer makes a choice. Every step's panel keeps left of the rail, but for Welcome's, in the middle of the screen while the rail is out of sight. Closing it, by its panel's ×, Skip tour or Escape, finishes it as Done does; until it's finished or closed, it carries on where it was left, but for the event panel's three, which a reload takes back to Click a score card (the panel they light isn't open then), and All set, which a reload finishes, straight into the live events. Once finished it comes back only when the viewer asks for it, from More on the rail ("Welcome tour"); a demo doesn't show it unless asked, even on a first visit.
_Avoid_: Onboarding, tutorial, walkthrough, intro, first-visit tour

**Tour events**:
Simulated Live events between real teams at real venues, the same six every time (Ravens v Steelers among them, the one Click a score card points at, with ESPN and StreamEast links to their home pages), shown once the viewer makes a choice on Welcome, whatever it is. Their scores or event progress change until the tour ends: one event has a play every 2 seconds, the event whose panel is open every other one, so its panel and card are seen to change, and its event details are made up again with each.
_Avoid_: Sample events, dummy events, onboarding events, example events

**Event details**:
The content opened by the tabs at the foot of the event panel. It includes period scores in the Score tab, scoring plays in order, football drives, player stats and ESPN highlights where the feed supplies them. A scenario’s, a demo’s and the tour’s events have theirs made up.

**Situation**:
Where play stands in a Live event right now: in football the down and distance and who has the ball, in baseball the count, outs and runners, and in every sport the feed covers the last play.
_Avoid_: Event state, status (an event's status is Upcoming, Live or Final)

**Key events**:
Soccer's goals and cards, or rugby's tries, conversions, penalty and drop goals and cards, in the order they came, each with its team, player and minute.
_Avoid_: Incidents, timeline

**Pulse**:
The short animation a pin, score card or cluster plays to draw the eye to a change in an event: when its score changes (for a field, when the lead changes hands; for a fight card, when a bout finishes), and when it starts, the same pulse for both; an event finishing plays none, but celebrates (see Celebration). It changes nothing about what's shown. Changes that came while ScoreMap was asleep or cut off don't pulse when it catches up. In basketball, a score change pulses only while the event is hot. With the device's reduce motion setting on, a pulse fades in place without moving.
_Avoid_: Blip, alert, notification, highlight (the selected pin is highlighted), flash

**Celebration**:
What an event finishing plays while ScoreMap is watching it: confetti in its teams' colors over its score card, where it has one on screen, and, when its event panel is open, a fireworks show inside the panel, after which the panel closes itself and the event leaves the globe with it, there and then rather than when its pin's time is up (see Final). Like a pulse, it doesn't play for an event that finished while ScoreMap was asleep or cut off. With the device's reduce motion setting on, nothing plays, but the panel still closes itself. How it looks is in `docs/style-guide.md`.
_Avoid_: Party, confetti (for the whole), animation

**Hot event**:
A Live event coming down to the wire: the trailing side is one score from tying or taking the lead, and little is left to play. In football, the last 4 minutes of the 4th quarter or any time in overtime, within 8 points. In hockey, the last 5 minutes of the 3rd period within 1 goal, or any time in overtime or a shootout. In soccer, from the 85th minute within 1 goal, from the 115th minute of extra time within 1 goal, or any time in a penalty shootout. In rugby, from the 75th minute, or any time in extra time, within a converted try (7 points). In baseball, from the last inning of regulation on (the 9th, or the 7th in college softball), while the tying run is on base or at the plate. In cricket, the last 2 overs of a limited-overs chase, while the chasing side needs no more than 2 runs a ball and has wickets left. In golf, the final round once the leader has played 9 holes, leading by no more than 1 shot. In UFC, a fight card's main event in its last scheduled round. A race is never hot. In basketball, the last 5 minutes of the last period of regulation or any time in overtime, within 5 points (borrowed from the NBA's clutch-time stat). A hot event shows its indicator, a glowing orange outline, on its score card, small pin and clusters, unless the viewer switched it off in Display Settings ("Hot event indicator").
_Avoid_: Close event, thriller, clutch time (basketball's hot rule, not a status of its own), top event (ESPN's pick, not ScoreMap's)

**Venue**:
The stadium, arena, track or course where an event is physically played, with its city and country. Not necessarily the home team's city.
_Avoid_: Stadium, arena, location, home city

**Feedback**:
A note a viewer writes and sends from ScoreMap, from Send feedback in More on the rail, posted publicly to the project's issues for the owner to sort through, with what the viewer was looking at (such as the open event).
_Avoid_: Bug report (it may be anything), comment, support request

**City label**:
A city's name on the globe, right of a small dot where the city is, from the city list included with the app. It never moves from that spot. A Big city's or an event's city's label is always drawn, unless a more populous city's label is in its spot. See `docs/city-labels.md`.
_Avoid_: Place name (which also covers states and countries), city name tag

**Big city**:
A city in the city list with a metro population of at least 4 million, or one on the Big list. It always gets a city label, unless a more populous city's label is in its spot.
_Avoid_: Major city, large city

**Small city**:
Any other city in the city list. It gets a city label only when an event near it needs one.
_Avoid_: Minor city, town

### Loading

**Loading screen**:
What ScoreMap shows when it first opens: a little flying rocket on the theme's background, hiding the globe as it draws, and a message saying it's loading, or what's holding it up if it's slow, or an error with a Try again action if the globe cannot start or the map fails to load. Nothing else shows until it's ready: then the globe, with its score cards and place names, the rail and the welcome tour come in together as it fades away.
_Avoid_: Spinner, splash, overlay, veil

**Ready**:
The moment, once each time ScoreMap is opened, that the first events are on the globe and everything has stopped moving: pins, score cards, trails and place names. The loading screen goes then, and doesn't come back.
_Avoid_: Loaded, settled, done

**Asleep**:
ScoreMap once its page has been hidden (its window minimized, another tab in front, or the screen locked) for longer than the idle timeout. It stops getting events, so with nobody else watching nothing is fetched, and a demo starts over. It wakes when the page is shown again: the globe is dimmed with a note until the current events arrive.
_Avoid_: Paused (that's a speed), idle, standby, timed out

**Idle timeout**:
How long ScoreMap's page can be hidden before ScoreMap falls asleep.
_Avoid_: Pause time, session timeout

### Look

**Theme**:
The whole of how ScoreMap looks, the globe included, as one JSON file checked when it's loaded, shaped as a Material UI theme is: its colors, a palette, typography, spacing and shape, each status's look, and each part's own look under its components. ScoreMap has one, built in.
_Avoid_: Skin, style (the globe's map style is MapLibre's), card style

**Theme colors**:
A theme's named base colors (`colors`), each worked out into steps from light (100) to dark (900), its base color at 500, such as `navy.700`.
_Avoid_: Color scheme, swatches, tokens

**Palette**:
What a theme's main colors are for, as MUI's palette has them: primary, secondary, error and warning, and a color for each event status (each a main shade, a lighter and a darker one, and the text on it), the background, text, the divider and hover. Each names a step of the theme colors. The rest of how a status looks is each component's own: a pin's, a cluster's, a score card's.
_Avoid_: Color scheme, tokens

**Color job**:
What a color in a theme is for, such as the globe's surface, Live's color or main text, rather than which color it is. It names a step of the theme colors, such as `navy.700`, or one of the palette's colors, such as `primary.dark`, or gives a color directly. An event's status shows by its glow and brightness; its color stands for its league or sport (see Event color).
_Avoid_: Token, semantic color

**Event color**:
The color an event shows in on its pin, score card, trail and pulses and in the event panel: the color the viewer picked for its league in Display Settings on the rail, else the one picked for its sport, else the theme's color for its status. A league with no color of its own, including one added to the server later, takes its sport's.
_Avoid_: Status color (for an event's color), team color

**Type style**:
One of a theme's kinds of text, named as MUI's typography variants are (`body2`, `button`, `caption`…): a weight, a size and a letter spacing, in the theme's one font family. Each kind of text on the page is one, and text on the globe takes one's size.
_Avoid_: Variant, text size, font role

**Glass**:
What a score card is made of: a pane the globe shows through, tinted with the card's fill, its edges catching the light (ADR-0018); on a desktop, the event panel's score block too, blurring the globe. Every other surface over the globe (the rest of the event panel, the rail, the scenario controls, tooltips) is solid (ADR-0023).
_Avoid_: Background, see-through fill

**Frost**:
How frosted a component's glass is, from 0, clear glass the globe shows sharply through, to 1, opaque frosted glass the globe can't be seen through. A theme setting of each component that's glass.
_Avoid_: Transparency, opacity (for glass), blur

### Event status

ScoreMap is mostly about events happening now (ADR-0021): an event gets a pin from shortly before it starts until shortly after it finishes, and not at all while Disrupted, but for fill-in events on a quiet globe (ADR-0029).

**Upcoming**:
An event that hasn't started yet. One starting within 30 minutes is on now, so it gets a pin; one further off gets a pin only as a fill-in event.
_Avoid_: Scheduled, pre-event

**Fill-in event**:
An Upcoming event more than 30 minutes from its start, shown because fewer than 12 events the viewer's settings show are on now across the globe: the soonest-starting fill in, to make 12, each starting within 6 hours and on the viewer's own day. None shows with "Only show live events" on, which hides every Upcoming event.
_Avoid_: Upcoming card, filler, placeholder

**Live**:
An event that has started and not yet finished, including breaks such as halftime, intermissions or a golf tournament's nights between rounds, and delays such as a rain delay.
_Avoid_: In progress, active, ongoing

**Disrupted**:
An event that was postponed, suspended or canceled, so it won't be played or finished as scheduled. It isn't shown: no pin, and not in the Events list. A bout on a fight card that won't be fought is Disrupted too, its line reading "Called off", and its fight card still shows.
_Avoid_: Called off, halted, inactive

**Final**:
An event that finished within the last 5 minutes, so it still gets a pin, showing its final score; an event whose event panel closed itself after its celebration leaves the globe at once, in that browser.
_Avoid_: Finished, completed, over, ended

### Local runs

**Scenario**:
A named set of made-up events between real teams of their league at real venues, and how they change over time, shown in place of real events when ScoreMap runs locally, or in a demo.
_Avoid_: Dummy data, fake data, simulation, demo (a demo shows one scenario; it isn't one)

**Demo**:
ScoreMap showing the worldwide scenario in place of real events, for anyone who opens it with `?demo` in its link, on the live site or locally. Everyone in a demo watches the same events, playing at Normal speed, from the scenario's start for whoever opens the first one. There are no scenario controls, a label says the events are made up, the viewer's saved settings are left alone, and feedback sent from it says it came from a demo.
_Avoid_: Demo mode, showcase, preview

**Scenario clock**:
The time a scenario's events are on. It reads noon Eastern on 4 August 2026 when the scenario starts (or is reset), then runs at the scenario's speed, so a scheduled change comes at the same reading every time. Real events are on the real time.
_Avoid_: Event clock (the clock within an event, such as 67'), fake time, virtual time

**Play**:
A scenario's events playing like real events, at random: Live events score and finish, Upcoming events start, and new events take the place of old ones. A scenario has play or a timeline, not both; with neither, its events stand still.
_Avoid_: Simulation, random play, live play

**Timeline**:
A scenario's written changes to its events at set times on the scenario clock, starting again from the beginning when it ends.
_Avoid_: Schedule, events

**Speed**:
How fast the scenario clock runs, by name: Paused (it stands still), Normal (real time), Fast (2×) or Faster (8×). One speed applies to whichever scenario is running.
_Avoid_: Pace, play speed, playback rate
