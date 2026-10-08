---
name: run-scoremap
description: Start, stop and drive ScoreMap locally (server, browser app, a browser on it). Use when running the app, checking a change in the real app, picking a scenario, or taking screenshots of it.
---

# Run ScoreMap

## Start and stop

Run these with the PowerShell tool, from the repo root:

```powershell
./scripts/dev.ps1 start    # builds, starts server (5147) and Vite (5173) in the background, waits until both answer
./scripts/dev.ps1 status   # what's running, and whether each port answers
./scripts/dev.ps1 stop     # stops both, however they were started
```

Use the script, not `dotnet run` or `npm run dev` in a background task: stopping those stops only their wrapper, and the real server or Vite keeps running and holding its port.

Logs are in `%TEMP%\scoremap\` (`/tmp/scoremap/` from Git Bash): `server.log` for the server, including errors from the hub and the poller, and `web.log` for Vite.

Finish every run with `stop`. Done means it printed `stopped: no ScoreMap processes left, and neither port answers`.

## Scenarios

Run locally, the app shows a **scenario** (made-up games at real venues, see `GLOSSARY.md` and ADR-0009) in place of real games, so checking a change never waits for real games to be on. It starts on `worldwide`; `./scripts/dev.ps1 start -Scenario <name>` starts on another, and `-Scenario real` on real ESPN games.

Pick the scenario that brings out what you're checking, and you know what should be on screen:

| Scenario | What it shows | Use it for |
| --- | --- | --- |
| `worldwide` | ~150 games on every continent: Upcoming, Live, Final, Disrupted | the globe as a whole, clusters, every status |
| `crowded` | ~40 games in and around London | a Cluster zoomed out; score cards and a Crowd zoomed in over London |
| `live-scoring` | 5 Live games (NFL, NBA, NHL, soccer, MLB, around New York and London); a score every ~3 s, the first at 3 s; soccer to HT at 30 s and back at 1m33s; MLB Final at 45 s; loops every 2 min | score cards and their animations |
| `busy` | ~60 Live games on random play: scoring, breaks, finishes, new games arriving | the app under steady change |
| `lifecycle` | one game at the Bernabéu: Upcoming, Live at 15 s, HT at 45 s, Live at 1m5s, Final at 1m35s; loops every 2 min | status changes on one pin, card and panel |
| `disrupted` | postponed, suspended and canceled games beside Upcoming, Live and Final ones, in New York and London | greyed-out Disrupted pins and cards |
| `empty` | no games | the bare globe and the "No games right now." message |
| `edge-cases` | an unfindable venue pinned at its city (Reykjavík), a 2–2 tie (Munich), long team names (Chicago), missing logos (Edmonton), three-digit scores (San Francisco) | layout at the extremes |

Scripted times count from when the scenario starts or is switched to, on the real clock; switching to the running scenario starts it afresh.

To switch while running:

- **The pill** at the top right ("Scenario: <name> ▾") lists the scenarios and "Real games"; picking one switches every open tab. `Shift+S` hides and shows it, for clean screenshots.
- **From a script**: `Invoke-RestMethod -Method Put -Uri http://localhost:5147/api/scenarios/running -ContentType 'application/json' -Body '{"name":"crowded"}'`. The pill in every open tab shows the new name straight away.

Scenario files are `server/src/ScoreMap.Server/Scenarios/Files/*.json`, and a new file shows up in the pill without a restart.

## Drive it in a browser

With agent-browser, in a session of your own (`export AGENT_BROWSER_SESSION=scoremap-<task>`):

1. **Launch with output to a file.** The session's first command starts the browser daemon, which inherits that command's stdout, so piping it (`| tail`) waits forever for the pipe to close. Send the first command's output to a file: `agent-browser open http://localhost:5173 > /tmp/ab.txt 2>&1`. Later commands can be piped.
2. **Reset to the start view.** The app saves the camera and filters to localStorage, including on `pagehide`, so clearing storage and then reloading the app writes them straight back. Clear it from a page that doesn't run the app:
   `open http://localhost:5173/favicon.svg`, `eval "localStorage.clear()"`, then `open http://localhost:5173`.
   A dark, empty globe is usually a saved camera zoomed in over ocean; reset.
3. **Open a game panel.** Pins are drawn by WebGL, so they have no element refs. Take a screenshot, then click the centre of a single pin: `mouse move <x> <y>`, `mouse down left`, `mouse up left`. A circle with a number is a cluster, and clicking it zooms in instead. Confirm with `eval "document.querySelector('.game-panel')?.textContent"`.
4. **Phone width.** Open the panel at 1280×800, then `set viewport 390 844`: the panel stays open, as the bottom sheet.
5. **Measure with eval** where a screenshot can only suggest: element sizes (`getBoundingClientRect()`), whether an image loaded (`naturalWidth > 0`), which URL it came from.

On real games, few or no pins usually means few games right now: pins show from 3 hours before a game until 2 hours after it ends.

## Saved data

The server saves its lookups in `server/src/ScoreMap.Server/data/` (git-ignored): `venue-locations.json` and `venue-photos.json`. To look venues up afresh, `stop`, delete the file, and `start` again.
