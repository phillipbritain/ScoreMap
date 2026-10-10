---
name: run-scoremap
description: Start, stop and drive ScoreMap locally (server, browser app, a browser on it). Use when running the app, checking a change in the real app, picking a scenario, or taking screenshots of it.
---

# Run ScoreMap

## Start and stop

Run these with the PowerShell tool, from the repo root:

```powershell
./scripts/dev.ps1 start    # builds, starts server (5147) and Vite (5173) in the background, waits until both answer
./scripts/dev.ps1 status   # what's running, since when, from which commit (STALE if not the one checked out), and whether each port answers
./scripts/dev.ps1 stop     # stops both, however they were started
```

The server runs from its own `bin\DevRun\` build, so `dotnet test` works while it's up.

A run already up is often one left by another session, built from another commit. `start` refuses while it runs and prints its `status`: if it's STALE or not started by the script, `stop` and `start` again.

Use the script, not `dotnet run` or `npm run dev` in a background task: stopping those stops only their wrapper, and the real server or Vite keeps running and holding its port.

Logs are in `%TEMP%\scoremap\` (`/tmp/scoremap/` from Git Bash): `server.log` for the server, including errors from the hub and the poller, and `web.log` for Vite.

Finish every run with `stop`. Done means it printed `stopped: no ScoreMap processes left, and neither port answers`.

## Scenarios

Run locally, the app shows a **scenario** (made-up games at real venues, see `GLOSSARY.md` and ADR-0009) in place of real games, so checking a change never waits for real games to be on. It starts on `worldwide`; `./scripts/dev.ps1 start -Scenario <name>` starts on another, and `-Scenario real` on real ESPN games.

A scenario's games run on the **scenario clock**, at a **speed**: Paused (the clock stands still), Normal (real time), Fast (2×) or Faster (8×). It starts at Normal; `./scripts/dev.ps1 start -Speed <name>` starts at another (any case, e.g. `-Speed Faster`).

Pick the scenario that brings out what you're checking, and you know what should be on screen:

| Scenario | What it shows | Use it for |
| --- | --- | --- |
| `worldwide` | ~150 games on every continent: Upcoming, Live, Final, Disrupted. They play like real games: scoring (at 1×, a score every ~15 s), breaks, starts and finishes; ~5% Disrupted at any moment (Upcoming games Postponed or Canceled, Live ones Suspended); a Final or Disrupted game drops out after a minute and a new one arrives. Raptors v Celtics (Toronto) is close late in the 4th, coming into clutch time | the globe as a whole, clusters, every status, the app under steady change; greyed-out Disrupted pins and cards; basketball's score pulses in clutch time |
| `crowded` | ~40 games in and around London, playing like `worldwide`'s; new games arrive around London too | a Cluster zoomed out; score cards and a Crowd zoomed in over London |
| `empty` | no games | the bare globe and the "No games right now." message |
| `edge-cases` | an unfindable venue pinned at its city (Reykjavík), a 2–2 tie (Munich), long team names (Chicago), missing logos (Edmonton), three-digit scores (San Francisco); nothing changes, so they stay that way | layout at the extremes |

Everything happens on the scenario clock, from when the scenario starts or is switched to, so at Faster (8×) a Final or Disrupted game drops out 7.5 s after it finishes or is disrupted. Switching to the running scenario starts it afresh; switching keeps the speed.

To switch while running:

- **The controls** at the bottom left: the scenario pill ("Scenario: <name> ▾") lists the scenarios and "Real games", and the **media keys** set the speed: Play is Normal, Pause pauses, and Fast-forward goes to Fast and, pressed again, flips between Fast and Faster. The lit key is the speed (Fast-forward grows a third triangle at Faster), and there's no label. Picking a scenario or pressing a key changes every open tab. A speed change carries on from where the scenario is. The scenario clock shows beside them, or above them where the row is too narrow. Where the speed can't be controlled (real games, and scenarios whose games stand still: `edge-cases` and `empty`), the keys and the clock are hidden, leaving just the pill. `Shift+S` hides and shows the pill, the keys and the clock, for clean screenshots.
- **From a script**: `Invoke-RestMethod -Method Put -Uri http://localhost:5147/api/scenarios/running -ContentType 'application/json' -Body '{"name":"crowded"}'`, or `.../api/scenarios/speed` with `'{"speed":"Faster"}'`. The pill, keys and clock in every open tab follow straight away.

Scenario files are `server/src/ScoreMap.Server/Scenarios/Files/*.json`, and a new file shows up in the pill without a restart.

## Drive it in a browser

With agent-browser, in a session of your own (`export AGENT_BROWSER_SESSION=scoremap-<task>`):

1. **Launch with output to a file.** The session's first command starts the browser daemon, which inherits that command's stdout, so piping it (`| tail`) waits forever for the pipe to close. Send the first command's output to a file: `agent-browser open http://localhost:5173 > /tmp/ab.txt 2>&1`. Later commands can be piped.
2. **Reset to the start view.** The app saves the camera and settings to localStorage, including on `pagehide`, so clearing storage and then reloading the app writes them straight back. Clear it from a page that doesn't run the app:
   `open http://localhost:5173/favicon.svg`, `eval "localStorage.clear()"`, then `open http://localhost:5173`.
   A dark, empty globe is usually a saved camera zoomed in over ocean; reset.
3. **Open a game panel.** Pins are drawn by WebGL, so they have no element refs. Take a screenshot, then click the centre of a single pin: `mouse move <x> <y>`, `mouse down left`, `mouse up left`. A circle with a number is a cluster, and clicking it zooms in instead. Confirm with `eval "document.querySelector('.game-panel')?.textContent"`.
4. **Phone width.** Open the panel at 1280×800, then `set viewport 390 844`: the panel stays open, as the bottom sheet.
5. **Measure with eval** where a screenshot can only suggest: element sizes (`getBoundingClientRect()`), whether an image loaded (`naturalWidth > 0`), which URL it came from.

On real games, few or no pins usually means few games right now: pins show from 3 hours before a game until 2 hours after it ends.

## Saved data

The server saves its lookups in `server/src/ScoreMap.Server/data/` (git-ignored): `venue-locations.json` and `venue-photos.json`. To look venues up afresh, `stop`, delete the file, and `start` again.
