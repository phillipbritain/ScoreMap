---
name: run-scoremap
description: Start, stop and drive ScoreMap locally (server, browser app, a browser on it). Use when the user asks to run, drive or screenshot the app, or to pick a scenario.
---

# Run ScoreMap

ScoreMap runs through .NET Aspire (ADR-0013): one **run** is the server and Vite together, from one clone or git worktree. Changes under `web/` show in a run straight away through Vite.

## Use the run that's there

Usually the user already has a run going. Run these with the PowerShell tool:

1. `aspire ps` lists every run on the machine, with its AppHost path (so its clone). When it lists this clone's AppHost, **use that run**. It may be the user's own `aspire run`, which restarts its AppHost itself when stopped, so a `start` over it only fights it for locked build files. When it lists none at all, start one (see [Starting a run](#starting-a-run)). When it lists only another clone's run, see "One run at a time" under [Starting a run](#starting-a-run).
2. Read its URLs. Give `--apphost` the full path, as `describe` and `wait` may not find the run from the directory alone:

   ```powershell
   $apphost = "$(git rev-parse --show-toplevel)/server/src/ScoreMap.AppHost/ScoreMap.AppHost.csproj"
   $run = (aspire describe --apphost $apphost --format json | ConvertFrom-Json).resources
   $web = ($run | ? displayName -eq web).urls[0].url
   $server = ($run | ? displayName -eq server).urls | ? name -eq http | % url
   ```

3. Drive it in a browser (below), starting with `npm run page -- reset $web`.

**Logs** are in the run's dashboard (`aspire ps` gives its URL, with its login token), or `aspire logs server` and `aspire logs web` (`-f` to follow).

**A white page** after renaming or deleting a file under `web/src`: Vite may hold a stale import, unseen by `console` and `errors`. Restart it with `aspire resource web restart --apphost $apphost`.

**Server `Finished` with "address already in use"** in `aspire logs server` (and `npm run page -- ready` timing out): a server left over from an earlier watch restart, often one that crashed on a half-made change, holds the port. Stop it (`Get-Process ScoreMap.Server | Stop-Process`), then `aspire resource server restart --apphost $apphost`.

## Drive it in a browser

With agent-browser, in a session of your own (`export AGENT_BROWSER_SESSION=scoremap-<task>`), and `npm run page` (in `web/`) for anything that reads or moves the page. Use it rather than `agent-browser eval`: Claude Code's auto mode refuses Bash commands containing `eval` in a worktree, and `npm run page` runs its script in the page for you. It uses the same session, from `AGENT_BROWSER_SESSION`, and runs from PowerShell or Git Bash.

```sh
npm run page -- reset $web                  # back to the start view; start the session with this
npm run page -- ready                       # waits for the page to be Ready
npm run page -- camera <lng>,<lat> <zoom>   # turns the camera there and waits for the globe to be still
npm run page -- settled                     # waits for the globe to settle after a camera move
npm run page -- read <selector> [prop]      # a property of the first match: textContent unless given (innerText for only what shows), rect for its box
npm run page -- screenshot <file>           # once Ready and settled
```

1. **Start with `reset`.** The app saves the camera and settings to localStorage, so a run on the same port opens where the last one left off; a dark, empty globe is usually a saved camera over ocean. `reset` also sends the browser daemon's output to files of its own. A session started with a bare agent-browser command instead must send that command's output to a file, from Git Bash (`agent-browser open $web > /tmp/ab.txt 2>&1`): the daemon inherits its stdout, so a pipe, or PowerShell's `>`, waits forever.
2. **Wait until it's drawn** before a measurement (`ready`): the page is Ready once the first games are on the globe and everything on it has stopped moving, and stays so. For screenshots to compare, start the scenario Paused too (see Scenarios).
3. **Go somewhere with `camera`**, as `camera -74,40.7 6` for New York, rather than scrolling. City labels show from zoom 3, so look where the scenario has games: `crowded` over New York, London or Los Angeles.
4. **Open a game panel.** Pins are drawn by WebGL, so they have no element refs. Take a screenshot, then click the centre of a single pin: `mouse move <x> <y>`, `mouse down left`, `mouse up left`. A circle with a number is a cluster, and clicking it zooms in instead. Confirm with `npm run page -- read .game-panel`.
5. **Pick from the scenario pill by ref.** The globe's canvas covers the pill's list for clicks by text, so open the pill, run `snapshot -i`, and `click @<ref>` on the entry's button.
6. **Phone width.** Open the panel at 1280×800, then `set viewport 390 844`: the panel stays open, as the bottom sheet.
7. **Measure with `npm run page -- read`** where a screenshot can only suggest: an element's size (`read <selector> rect`), whether an image loaded (`read <selector> naturalWidth`, more than 0), which URL it came from (`read <selector> currentSrc`).

On real games, few or no pins usually means few games right now: pins show from 3 hours before a game until 2 hours after it ends.

## Scenarios

Run locally, the app shows a **scenario** (made-up games at real venues, see `GLOSSARY.md` and ADR-0009) in place of real games, so checking a change never waits for real games to be on. Every run starts on `worldwide` (`Scenario` in `appsettings.Development.json`); switch to another, or to real ESPN games, once it's up (below).

A scenario's games run on the **scenario clock**, at a **speed**: Paused (the clock stands still), Normal (real time), Fast (4×) or Faster (32×). It starts at Normal (`ScenarioSpeed`); change it once the run is up (below).

Pick the scenario that brings out what you're checking, and you know what should be on screen:

| Scenario | What it shows | Use it for |
| --- | --- | --- |
| `worldwide` | ~150 games on every continent: Upcoming, Live, Final, Disrupted. They play like real games: scoring (at 1×, a score every ~15 s), breaks, starts and finishes; ~5% Disrupted at any moment (Upcoming games Postponed or Canceled, Live ones Suspended); a Final or Disrupted game drops out after a minute and a new one arrives. Raptors v Celtics (Toronto) is close late in the 4th, coming into clutch time; a game in each other sport becomes a hot game a few minutes in and stops being one later: Chiefs v Bills (Kansas City), Oilers v Flames (Edmonton), Arsenal v Chelsea (London), Yankees v Red Sox (the Bronx, hot through the top of the 9th), Mumbai v Chennai (an IPL chase) and Ireland v France (Dublin, Six Nations) | the globe as a whole, clusters, every status, the app under steady change; greyed-out Disrupted pins and cards; basketball's score pulses in clutch time; flames coming and going on hot games (on unless switched off in Display Settings, "Flames on hot games") |
| `crowded` | ~40 games packed into the world's biggest cities (New York, Los Angeles, Miami, London, Paris, Tokyo and more), playing like `worldwide`'s; new games arrive in those cities too | Pin clusters zoomed out; score cards, card clusters and city labels zoomed in over London, New York or Los Angeles |
| `empty` | no games | the bare globe and the "No games right now." message |
| `hot-finishes` | 29 games in every sport, all close near the end, so every one is a hot game: football's last minutes and overtime, basketball's clutch time, baseball's tying run on base in the 9th and 10th, hockey's last minutes, overtime and a shootout, soccer's stoppage time, extra time and penalties, IPL chases in their last overs, Six Nations matches from the 75th minute. Across North America, Europe, Brazil, Mexico, India and Melbourne; nothing changes, so they stay hot | flames on many score cards, small pins and clusters at once (on unless switched off in Display Settings, "Flames on hot games"), and the globe's smoothness with them all flickering |
| `edge-cases` | an unfindable venue pinned at its city (Reykjavík), a 2–2 tie (Munich), long team names (Chicago), missing logos (Edmonton), three-digit scores (San Francisco), a NASCAR race under way with 23 drivers (the Los Angeles Memorial Coliseum) and one whose field isn't listed yet (Soldier Field, Chicago), an F1 race on lap 42 with its 22 drivers (Hard Rock Stadium, Miami Gardens), a UFC fight card in its main event's 2nd round, every other bout won one of the three ways or drawn (Madison Square Garden, New York), a hot golf tournament in its final round with a tie for 2nd and scores to par (the Rose Bowl, Pasadena); nothing changes, so they stay that way | layout at the extremes; a field's score card, and its game panel's leaderboard with Show all; a fight card's score card, and every bout in its game panel |
| `slow-initial-load` | `worldwide`'s games, but each browser that connects waits 15 s (real time, at any speed) for its first games. Picking it in the pill reloads that tab so the slow load starts at once; press Reset, or reload, to watch it again. Other tabs carry on until reloaded | the loading screen on a slow first load: the rocket over an empty globe, "Can't reach ScoreMap" after 10 s, then pins and score cards coming in under the dim before it fades. To tune the loading screen's look, hold it up from the theme tuner's Loading screen tab instead |

Everything happens on the scenario clock, which reads noon Eastern on 4 August 2026 (12:00:00 PM EDT) whenever a scenario starts, is switched to or is reset (real games show the real time), so an event comes at the same reading every time: note it on the clock, press Reset, and watch for it again. At Faster (32×) a Final or Disrupted game drops out under 2 s (1.875 s) after it finishes or is disrupted. Switching to the running scenario starts it afresh; switching keeps the speed.

To switch while running (each run's scenario and speed are its own):

- **The controls**: the scenario pill lists the scenarios and "Real games"; Reset starts the running scenario afresh at the same speed, as picking it again does; and there is a key per speed, the lit one being the speed. Picking a scenario or pressing a key changes every open tab, and a speed change carries on from where the scenario is. Where the speed can't be controlled (real games, and scenarios whose games stand still: `edge-cases`, `empty` and `hot-finishes`), the keys and the clock are hidden, leaving just the pill. `Shift+S` hides and shows them, the Behaviour and Theme buttons with their panels, and the Feedback button and panel (on the live site too), for clean screenshots.
- **From a script**, against the run's server URL (or its web URL): `Invoke-RestMethod -Method Put -Uri $server/api/scenarios/running -ContentType 'application/json' -Body '{"name":"crowded"}'` (`"real"` for real games; add `"speed":"Paused"` to start it standing still at its start, so you know exactly what's on screen), or `$server/api/scenarios/speed` with `'{"speed":"Faster"}'`. The pill, keys and clock in every open tab follow straight away.

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

Each set needs nonnegative `home` and `away` games; tiebreak points are optional. `homeWon` is `true` for a set won by home, `false` for one won by away, and omitted for an unfinished set. The sets supply the sides' scores (sets won), current period and scoreline, whether the game stands still, follows a timeline or plays forward. A timeline change's `sets` replaces the list; leaving it out keeps the sets, and sets won cannot go down. Play keeps written sets, starting a new 0–0 set after a completed one when it takes on a Live game; Final and Disrupted games keep their sets, and Upcoming games gain none until they start.

`earlyEnding` is only for Final tennis games: `reason` is `retired` or `walkover`, and optional `winner` is the advancing side's abbreviation, whatever the score. A walkover can have no sets. A timeline can set `earlyEnding` alongside `status: "final"`. With no written sets, a standing or timeline game keeps its shorthand scores and has no set scoreline; under play, the existing deterministic rule makes completed sets from those scores (seeded by game id), then starts a 0–0 set.

## Demos

A **demo** (`GLOSSARY.md`, ADR-0019) is the web URL with `?demo` (any value): `npm run page -- reset "$web/?demo"`. It shows `worldwide` from its own game board, apart from the pill's scenario, which other tabs keep on: switching or pausing that changes nothing in a demo. Every demo tab shares one demo board at Normal, started afresh (clock at noon Eastern) when the first opens, and stopped a minute after the last closes. A demo has no pill, media keys, clock or Behaviour and Theme tools, uses the built-in theme and behaviour whatever drafts the tuners saved, opens on first-visit settings and the viewer's region, and saves nothing to localStorage. A label at the top says the games are made up; `Shift+S` hides it with the Feedback button. On the live site the same link opens one.

## Starting a run

When no run is going for this clone. Setup and the basic commands (`aspire start`, `aspire wait web`, `aspire describe`, `aspire stop`) are in the README's "Run locally"; run them from the repo root (or the worktree's root), and wait for `web` before using the run.

- **One run at a time, on the same ports.** A plain `aspire start` puts the app at http://localhost:5173 and the server at http://localhost:5147 every time; keep to one run on the machine so it stays there. To run another clone or worktree, stop the run going (`aspire stop` from its root) and start a plain one in the other. Ask the user before stopping a run you didn't start, and before ever starting a second run alongside one (`aspire start --isolated`, on random ports, read as above). One clone or worktree has one run: starting it again stops the one going and starts afresh.
- **First time on a machine:** set up as the README says. Trusting the development certificate is a Windows prompt the user must accept: ask them to run `! aspire certs trust`. Untrusted, the server shows Unhealthy and `web` waits for it forever.
- **Start it from a shell clear of `NODE_USE_SYSTEM_CA`** (`Remove-Item Env:NODE_USE_SYSTEM_CA -ErrorAction SilentlyContinue` first, in the same PowerShell call). An agent's shell can have it set where the user's doesn't (it isn't a Windows user or machine variable), the run hands it on to Vite, and with it Node ignores the certificate Aspire gives it (`NODE_EXTRA_CA_CERTS`). The run then looks healthy, but every `/api` and `/hubs` request through `web` is a 502, and `aspire logs web` says `self-signed certificate`.
- **A run watches the server** (`features.defaultWatchEnabled` in `aspire.config.json`): a saved change under `server/` restarts it within seconds, with no `aspire start`. The restart puts it back on `worldwide` at Normal, so switch the scenario and speed again after each change. `dotnet build` and `dotnet test` work alongside a run with `-c Release`: the run holds the Debug build's files, so a Debug build fails to copy over them after a server change.
- **Stop a run you started** with `aspire stop`; done means `aspire ps` no longer lists it. `aspire stop --all` stops every run on the machine, the user's included.

## Saved data

To look venues up afresh, `aspire stop`, delete the saved lookup (which file: `docs/configuration.md`, "Venues"), and `aspire start` again.
