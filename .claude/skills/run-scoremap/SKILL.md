---
name: run-scoremap
description: Start, stop and drive ScoreMap locally (server, browser app, a browser on it). Use when running the app, checking a change in the real app, or taking screenshots of it.
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

## Drive it in a browser

With agent-browser, in a session of your own (`export AGENT_BROWSER_SESSION=scoremap-<task>`):

1. **Launch with output to a file.** The session's first command starts the browser daemon, which inherits that command's stdout, so piping it (`| tail`) waits forever for the pipe to close. Send the first command's output to a file: `agent-browser open http://localhost:5173 > /tmp/ab.txt 2>&1`. Later commands can be piped.
2. **Reset to the start view.** The app saves the camera and filters to localStorage, including on `pagehide`, so clearing storage and then reloading the app writes them straight back. Clear it from a page that doesn't run the app:
   `open http://localhost:5173/favicon.svg`, `eval "localStorage.clear()"`, then `open http://localhost:5173`.
   A dark, empty globe is usually a saved camera zoomed in over ocean; reset.
3. **Open a game panel.** Pins are drawn by WebGL, so they have no element refs. Take a screenshot, then click the centre of a single pin: `mouse move <x> <y>`, `mouse down left`, `mouse up left`. A circle with a number is a cluster, and clicking it zooms in instead. Confirm with `eval "document.querySelector('.game-panel')?.textContent"`.
4. **Phone width.** Open the panel at 1280×800, then `set viewport 390 844`: the panel stays open, as the bottom sheet.
5. **Measure with eval** where a screenshot can only suggest: element sizes (`getBoundingClientRect()`), whether an image loaded (`naturalWidth > 0`), which URL it came from.

Few or no pins usually means few games right now: pins show from 3 hours before a game until 2 hours after it ends.

## Saved data

The server saves its lookups in `server/src/ScoreMap.Server/data/` (git-ignored): `venue-locations.json` and `venue-photos.json`. To look venues up afresh, `stop`, delete the file, and `start` again.
