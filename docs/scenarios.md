# Scenarios

Run locally, the app shows a **scenario** (made-up games at real venues, see `GLOSSARY.md` and ADR-0009) in place of real games, so checking a change never waits for real games to be on. Every run starts on `worldwide` (`Scenario` in `appsettings.Development.json`); switch to another, or to real ESPN games, once it's up (below).

A scenario's games run on the **scenario clock**, at a **speed**: Paused (the clock stands still), Normal (real time), Fast (4×) or Faster (32×). It starts at Normal (`ScenarioSpeed`); change it once the run is up (below).

Pick the scenario that brings out what you're checking, and you know what should be on screen:

| Scenario | What it shows | Use it for |
| --- | --- | --- |
| `worldwide` | ~60 games across North America, Europe and India, each at a real venue of its league with its home team there (a demo shows it too): Upcoming, Live, Final. They play like real games: scoring (at 1×, a score within half a minute), breaks, starts and finishes; a Final game drops out after a minute and a new one arrives. Raptors v Celtics (Toronto) is close late in the 4th, about to become a hot game; a game in each other sport becomes a hot game a few minutes in and stops being one later: Chiefs v Bills (Kansas City), Oilers v Flames (Edmonton), Arsenal v Chelsea (London), Yankees v Red Sox (the Bronx, hot through the top of the 9th), Mumbai v Chennai (an IPL chase) and Ireland v France (Dublin, Six Nations). Its tennis match is Sinner v Alcaraz (ATP, the Rolex Paris Masters, Court Central: `camera 2.3522,48.8566 12`), a set up in the 2nd, for set scores | the globe as a whole, clusters, every status, the app under steady change; basketball's score pulses only while hot; the hot games indicator coming and going on hot games (on unless switched off in Display Settings, "Hot event indicator") |
| `worldwide-busy` | the busy case production sees most: a college Saturday as real games stood on 14 November 2026, ~65 games. 61 college games (football, men's and women's basketball) at that day's venues across the eastern and central US, nearly all Live with a couple Upcoming and one Final, plus that day's PGA Tour (Austin) and LPGA Tour (Belleair, between rounds) leaderboards and an NHL game in Helsinki; playing as `worldwide`'s do, with new college games taking finished ones' places | score cards and card clusters over the US as they usually are when busy: `camera -84,37 3.6`; the app's smoothness under heavy, steady change |
| `crowded` | ~40 games packed into the world's biggest cities (New York, Los Angeles, Chicago, London, Miami, Toronto and more), playing like `worldwide`'s; new games arrive in those cities too | Score cards, card clusters and city labels over London, New York or Los Angeles |
| `empty` | no games | the bare globe and the "No events right now." message |
| `hot-finishes` | 29 games in every sport, all close near the end, so every one is a hot game: football's last minutes and overtime, basketball's last 5 minutes and overtime, baseball's tying run on base in the 9th and 10th, hockey's last minutes, overtime and a shootout, soccer's stoppage time, extra time and penalties, IPL chases in their last overs, Six Nations matches from the 75th minute. Across North America, Europe and India; nothing changes, so they stay hot | the hot games indicator on many score cards, small pins and clusters at once (on unless switched off in Display Settings, "Hot event indicator"), and the globe's smoothness with them all flickering |
| `edge-cases` | an unfindable venue pinned at its city (Reykjavík), a 2–2 tie (Munich), long team names (Corpus Christi), missing logos (Edmonton: one team with none, one whose logo won't load), three-digit scores (San Francisco), a NASCAR race under way with 23 drivers (the Los Angeles Memorial Coliseum) and one whose field isn't listed yet (the Chicago Street Course), an F1 race on lap 42 with its 22 drivers (the Miami International Autodrome), a UFC fight card in its main event's 2nd round, every other bout won one of the three ways or drawn (Madison Square Garden, New York), a hot golf tournament in its final round with a tie for 2nd and scores to par (Riviera Country Club, Pacific Palisades); nothing changes, so they stay that way | layout at the extremes; a field's score card, and its event panel's leaderboard, a line each in its score block; a fight card's score card, and every bout in its event panel |
| `sunday-morning` | a quiet globe before the NFL's games start: 3 Live games (Liverpool v Man City at Anfield, Man United v Spurs at Old Trafford, Ireland v France in Dublin), ten NFL games at 1:00 PM Eastern (1 h in) and four at 4:25 PM, three NBA games 8 h in and two NHL games tomorrow. A timeline, looping every 6 h: the Live games score, Liverpool v Man City finishes 40 min in (dropping off 5 min later), and the NFL's kick off on time | fill-in games (ADR-0029): the 3 Live games topped up to 12 with nine 1:00 PM games showing their start time, none of the NBA's or NHL's; one more fills in once Liverpool v Man City goes; at 1:00 PM the fill-ins give way to the kickoffs. "Only show live events" in Display Settings leaves the Live ones |
| `slow-initial-load` | about as many games as `worldwide`, at its venues, but each browser that connects waits 15 s (real time, at any speed) for its first games. Picking it in the pill reloads that tab so the slow load starts at once; press Reset, or reload, to watch it again. Other tabs carry on until reloaded | the loading screen on a slow first load: the rocket and a loading phrase over an empty globe, a can't-reach phrase (from `web/src/loading/loadingPhrases.ts`) after 10 s, then the globe, its score cards and the rail coming in together as the loading screen fades |

Every scenario's games carry made-up links for the event panel's logos, picked by game id so a game keeps them: about a quarter have both an ESPN page and a StreamEast stream, a quarter only ESPN, a quarter only StreamEast and a quarter neither. Each goes to its site's home page. Demos and real games don't get them.

Every event in a scenario, a demo or the welcome tour also has made-up event details, for each tab its sport has (none but a preview video and its networks before it starts): picked by its id, so it shows the same ones each time, growing as it goes on. Its videos open ESPN's home page.

Everything happens on the scenario clock, which reads noon Eastern on 4 August 2026 (12:00:00 PM EDT) whenever a scenario starts, is switched to or is reset (real games show the real time), so an event comes at the same reading every time: note it on the clock, press Reset, and watch for it again. At Faster (32×) a Final game drops out under 2 s (1.875 s) after it finishes. Switching to the running scenario starts it afresh; switching keeps the speed.

To switch while running (each run's scenario and speed are its own):

- **The controls**, in the Scenario popover (the top rail's first button, at the top left): the scenario pill lists the scenarios and "Real events"; Reset starts the running scenario afresh at the same speed, as picking it again does; and there is a key per speed, the lit one being the speed. Picking a scenario or pressing a key changes every open tab, and a speed change carries on from where the scenario is. Where the speed can't be controlled (real games, and scenarios whose games stand still: `edge-cases`, `empty` and `hot-finishes`), the keys and the clock are hidden, leaving just the pill.
- **From a script**, against the run's server URL (or its web URL): `Invoke-RestMethod -Method Put -Uri $server/api/scenarios/running -ContentType 'application/json' -Body '{"name":"crowded"}'` (bash: `curl -X PUT "$server/api/scenarios/running" -H 'Content-Type: application/json' -d '{"name":"crowded"}'`; `"real"` for real games; add `"speed":"Paused"` to start it standing still at its start, so you know exactly what's on screen), or `$server/api/scenarios/speed` with `'{"speed":"Faster"}'`. The pill, keys and clock in every open tab follow straight away. Read the answer's `running`: a scenario the server can't read gets a 422 saying why, and the run keeps the one it had.

Scenario files are `server/src/ScoreMap.Server/Scenarios/Files/*.json`, and a new file shows up in the pill without a restart.

To see field games and fight cards move, pick `worldwide`: its NASCAR race counts laps and changes leaders, its PGA Tour tournament plays holes and rounds with overnight breaks, and its UFC fight card finishes bouts. For a timeline, `field` or `bouts` replaces that contest using the same format as an initial game (list entrants in position order, bouts main event first); `period`, `clock` and `status` can change alongside it.

Written tennis games can give `sets` in order, the current set last, and a Final game can give `earlyEnding`:

```json
"sets": [
  { "home": 7, "away": 6, "homeTiebreak": 7, "awayTiebreak": 4, "homeWon": true },
  { "home": 2, "away": 3 }
],
"earlyEnding": { "reason": "retired", "winner": "J. Sinner" }
```

Each set needs nonnegative `home` and `away` games; tiebreak points are optional. `homeWon` is `true` for a set won by home, `false` for one won by away, and omitted for an unfinished set. The sets supply the sides' scores (sets won), current period and scoreline, whether the game stands still, follows a timeline or plays forward. A timeline change's `sets` replaces the list; leaving it out keeps the sets, and sets won cannot go down. Play keeps written sets, starting a new 0–0 set after a completed one when it takes on a Live game; Final games keep their sets, and Upcoming games gain none until they start.

`earlyEnding` is only for Final tennis games: `reason` is `retired` or `walkover`, and optional `winner` is the advancing side's abbreviation, whatever the score. A walkover can have no sets. A timeline can set `earlyEnding` alongside `status: "final"`. With no written sets, a standing or timeline game keeps its shorthand scores and has no set scoreline; under play, the existing deterministic rule makes completed sets from those scores (seeded by game id), then starts a 0–0 set.

## Real events

On real games, few or no pins usually means few games right now: pins show from 30 minutes before a game until 5 minutes after it ends, and postponed, suspended or canceled games not at all (ADR-0021); with fewer than 12 of those, fill-in games starting within 6 hours that day make it up to 12 (ADR-0029), none with "Only show live events" on in Display Settings.

## Which games are on

`curl "$server/api/games"` lists the games the run is showing (on real games, only once a tab has the app open), one line each: id, league, status, the sides (away @ home, with poll rank, conference and score), venue and city. `?league=ncaa` keeps the leagues whose name contains it. Read it rather than naming games from memory: a scenario's games change as it plays, and between versions; on real games, with the day.

## Demos

A **demo** (`GLOSSARY.md`, ADR-0019) is the web URL with `?demo` (any value): `npm run page -- reset "$web/?demo"`. It shows `worldwide` from its own game board, apart from the pill's scenario, which other tabs keep on: switching or pausing that changes nothing in a demo. Every demo tab shares one demo board at Normal, started afresh (clock at noon Eastern) when the first opens, and stopped a minute after the last closes. A demo has no pill, media keys or clock, uses the built-in theme, opens on first-visit settings and the viewer's region, and saves nothing to localStorage. A label at the top says the games are made up. On the live site the same link opens one.
