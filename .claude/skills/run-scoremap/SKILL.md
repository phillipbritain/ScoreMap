---
name: run-scoremap
description: Start, stop and drive ScoreMap locally (server, browser app, a browser on it). Use when running the app, checking a change in the real app, checking a change looks the same, picking a scenario, or taking screenshots of it.
---

# Run ScoreMap

## Start and stop

ScoreMap runs through .NET Aspire (ADR-0013): one **run** is the server and Vite together, from one clone or git worktree. Runs from different clones and worktrees go side by side, each with its own server, so its own scenario and speed. Run these with the PowerShell tool, from the repo root (or the worktree's root):

```powershell
aspire start              # the first run on the machine: in the background, returns once Aspire is up
aspire start --isolated   # any further run, from another worktree: random ports
aspire wait web           # waits until the browser app answers; do this before using it
aspire describe           # this clone's run: each resource's state, health and URLs
aspire ps                 # every run on the machine: its AppHost path (so its clone), PIDs, dashboard URL
aspire stop               # stops this clone's run
aspire stop --all         # stops every run on the machine
```

`start` is plain when `aspire ps` lists no run, and `--isolated` when it lists any, since a plain run wants fixed ports another may hold. One clone or worktree has one run: starting it again (even `--isolated`) stops the one going and starts afresh, which is also how to pick up a changed server. For a second run of your own, make a git worktree and start it there.

**Its URLs.** The browser app is the `web` resource's URL and the server the `server`'s; in an isolated run both are random. Read them from `aspire describe --format json` (`.resources[]`, by `displayName`, `.urls[].url`):

```powershell
$run = (aspire describe --format json | ConvertFrom-Json).resources
$web = ($run | ? displayName -eq web).urls[0].url
$server = ($run | ? displayName -eq server).urls | ? name -eq http | % url
```

**Logs** are in the run's dashboard (`aspire ps` gives its URL, with its login token), or `aspire logs server` and `aspire logs web` (`-f` to follow).

**First time on a machine:** install the Aspire CLI with its install script (`irm https://aspire.dev/install.ps1 | iex` in PowerShell; a new shell then finds `aspire`). If `aspire` isn't found in Git Bash but `aspire.cmd` is, it was installed as a dotnet tool: use `aspire.cmd` there, or the PowerShell tool and trust the development certificate once with `aspire certs trust` (a Windows prompt the user must accept: ask them to run `! aspire certs trust`). Untrusted, the server shows Unhealthy and `web` waits for it forever.

**Stop the run before `dotnet test` or `dotnet build`** in the same clone once you've changed the server: the run holds `ScoreMap.Server.exe` in the clone's `bin\Debug`, so the build fails with MSB3027 ("The file is locked by: ScoreMap.Server"). Unchanged, it builds and tests fine alongside. `aspire start` afterwards picks up the change.

Finish every run with `aspire stop`. Done means `aspire ps` no longer lists this clone.

## Scenarios

Run locally, the app shows a **scenario** (made-up games at real venues, see `GLOSSARY.md` and ADR-0009) in place of real games, so checking a change never waits for real games to be on. Every run starts on `worldwide` (`Scenario` in `appsettings.Development.json`); switch to another, or to real ESPN games, once it's up (below).

A scenario's games run on the **scenario clock**, at a **speed**: Paused (the clock stands still), Normal (real time), Fast (2×) or Faster (8×). It starts at Normal (`ScenarioSpeed`); change it once the run is up (below).

Pick the scenario that brings out what you're checking, and you know what should be on screen:

| Scenario | What it shows | Use it for |
| --- | --- | --- |
| `worldwide` | ~150 games on every continent: Upcoming, Live, Final, Disrupted. They play like real games: scoring (at 1×, a score every ~15 s), breaks, starts and finishes; ~5% Disrupted at any moment (Upcoming games Postponed or Canceled, Live ones Suspended); a Final or Disrupted game drops out after a minute and a new one arrives. Raptors v Celtics (Toronto) is close late in the 4th, coming into clutch time | the globe as a whole, clusters, every status, the app under steady change; greyed-out Disrupted pins and cards; basketball's score pulses in clutch time |
| `crowded` | ~40 games packed into the world's biggest cities (New York, Los Angeles, Miami, London, Paris, Tokyo and more), playing like `worldwide`'s; new games arrive in those cities too | Pin clusters zoomed out; score cards and card clusters zoomed in over London, New York or Los Angeles |
| `empty` | no games | the bare globe and the "No games right now." message |
| `edge-cases` | an unfindable venue pinned at its city (Reykjavík), a 2–2 tie (Munich), long team names (Chicago), missing logos (Edmonton), three-digit scores (San Francisco); nothing changes, so they stay that way | layout at the extremes |

Everything happens on the scenario clock, from when the scenario starts or is switched to, so at Faster (8×) a Final or Disrupted game drops out 7.5 s after it finishes or is disrupted. Switching to the running scenario starts it afresh; switching keeps the speed.

To switch while running (each run's scenario and speed are its own):

- **The controls** at the bottom left: the scenario pill ("Scenario: <name> ▾") lists the scenarios and "Real games", and the **media keys** set the speed: Play is Normal, Pause pauses, and Fast-forward goes to Fast and, pressed again, flips between Fast and Faster. The lit key is the speed (Fast-forward grows a third triangle at Faster), and there's no label. Picking a scenario or pressing a key changes every open tab. A speed change carries on from where the scenario is. The scenario clock shows beside them, or above them where the row is too narrow. Where the speed can't be controlled (real games, and scenarios whose games stand still: `edge-cases` and `empty`), the keys and the clock are hidden, leaving just the pill. `Shift+S` hides and shows the pill, the keys and the clock, for clean screenshots.
- **From a script**, against the run's server URL (or its web URL, which passes `/api` on): `Invoke-RestMethod -Method Put -Uri $server/api/scenarios/running -ContentType 'application/json' -Body '{"name":"crowded"}'` (`"real"` for real games; add `"speed":"Paused"` to start it standing still at its start, so you know exactly what's on screen), or `$server/api/scenarios/speed` with `'{"speed":"Faster"}'`. The pill, keys and clock in every open tab follow straight away.

Scenario files are `server/src/ScoreMap.Server/Scenarios/Files/*.json`, and a new file shows up in the pill without a restart.

## Drive it in a browser

With agent-browser, in a session of your own (`export AGENT_BROWSER_SESSION=scoremap-<task>`), and `npm run page` (in `web/`) for anything that reads the page. Use it rather than `agent-browser eval`: Claude Code's auto mode refuses Bash commands containing `eval` in a worktree, and `npm run page` runs its script in the page for you. It uses the same session, from `AGENT_BROWSER_SESSION`.

```sh
npm run page -- reset $web               # back to the start view (step 2)
npm run page -- ready                    # waits for the page to be Ready (step 3)
npm run page -- settled                  # waits for the globe to settle after a camera move
npm run page -- read <selector> [prop]   # a property of the first match: textContent unless given, rect for its box
npm run page -- screenshot <file>        # once Ready and settled
```

1. **Launch with output to a file.** The session's first command starts the browser daemon, which inherits that command's stdout, so piping it (`| tail`) waits forever for the pipe to close. Send the first command's output to a file, from Git Bash (PowerShell's `>` still reads it through a pipe, and waits the same): `agent-browser open $web > /tmp/ab.txt 2>&1`, where `$web` is the run's web URL. Later commands can be piped. (`npm run page -- reset $web` can be the first command too: it sends agent-browser's output to files of its own.)
2. **Reset to the start view** (`reset`). The app saves the camera and settings to localStorage, so a run on the same port opens where the last one left off; a run on a new port starts without a saved camera.
   A dark, empty globe is usually a saved camera zoomed in over ocean; reset.
3. **Wait until it's drawn** before a measurement (`ready`): the page is Ready once the first games are on the globe and everything on it has stopped moving, and stays so. After moving the camera, wait for it to settle (`settled`). For screenshots to compare, start the scenario Paused too (see Scenarios).
4. **Open a game panel.** Pins are drawn by WebGL, so they have no element refs. Take a screenshot, then click the centre of a single pin: `mouse move <x> <y>`, `mouse down left`, `mouse up left`. A circle with a number is a cluster, and clicking it zooms in instead. Confirm with `npm run page -- read .game-panel`.
5. **Pick from the scenario pill by ref.** The globe's canvas covers the pill's list for clicks by text, so open the pill, run `snapshot -i`, and `click @<ref>` on the entry's button.
6. **Phone width.** Open the panel at 1280×800, then `set viewport 390 844`: the panel stays open, as the bottom sheet.
7. **Measure with `npm run page -- read`** where a screenshot can only suggest: an element's size (`read <selector> rect`), whether an image loaded (`read <selector> naturalWidth`, more than 0), which URL it came from (`read <selector> currentSrc`).

On real games, few or no pins usually means few games right now: pins show from 3 hours before a game until 2 hours after it ends.

## Check that a change looks the same

To check that a change leaves the look as it was (or changes only what it should), compare the working tree with a base in one command, rather than screenshotting and diffing by hand. In `web/`, from PowerShell or Git Bash:

```sh
npm run looks-same -- main          # <base ref> [--out <folder>]
```

It takes about a minute. It starts this clone's run (stopping it again at the end, even on failure; a run already going is replaced, and it says so), starts `crowded` Paused, and serves the base from a checkout of its own beside it, so the working tree and its uncommitted changes are never touched. A check killed outright (its terminal closed, its task stopped) can't tidy up; the next one removes what it left, its base checkout and browser session, and says so. Then it reports:

- **A screenshot** of London's crowd of score cards, the same or differing, with a diff image (differing pixels red). It's taken once the globe is ready (`window.scoremap.stage()`) and has settled after turning to the view (`settled()`), with logos and photos hidden and animations stopped. Where the base and the working tree differ, each is screenshotted again: if either's two differ, the globe drew differently from one page to the next, and it says it can't make the screenshot repeatable rather than report a difference.
- **Computed CSS**: every declaration whose computed value differs, hover and pressed states, keyframes and media queries included, so a 1 px change a screenshot can't show still shows.

It exits 0 when nothing differs, 1 when something does, 2 when the check itself fails, as it does on a base without #112, whose page can't say when it's ready. The screenshot has Live and Upcoming cards, but no Final or Disrupted ones, card cluster, game panel or phone width; check those by eye where a change touches them.

## Saved data

The server saves its lookups in `server/src/ScoreMap.Server/data/` (git-ignored): `venue-locations.json` and `venue-photos.json`. Each clone or worktree has its own. To look venues up afresh, `aspire stop`, delete the file, and `aspire start` again.
