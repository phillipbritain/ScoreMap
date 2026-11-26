# Browser automation

How to drive a browser on a local run, for checking a change or taking screenshots: the way agents do it, and anyone else can. Find the run's `$web` URL first ([running-locally.md](running-locally.md#use-the-run-thats-there)). Install agent-browser and its Chrome once per machine, as the README says.

With agent-browser, in a session of your own (`export AGENT_BROWSER_SESSION=scoremap-<task>`), and `npm run page` (in `web/`) for anything that reads or moves the page. Use it rather than `agent-browser eval`: `npm run page` runs its script in the page for you, and some agents' shells refuse commands containing `eval`. It uses the same session, from `AGENT_BROWSER_SESSION`, and runs from PowerShell or Git Bash.

```sh
npm run page -- reset $web                  # back to the start view; start the session with this
npm run page -- reset $web --toured         # the same, with the welcome tour already finished
npm run page -- ready                       # waits for the page to be Ready
npm run page -- camera <lng>,<lat> <zoom>   # turns the camera there and waits for the globe to be still
npm run page -- settled                     # waits for the globe to settle after a camera move
npm run page -- read <selector> [prop]      # a property of the first match: textContent unless given (innerText for only what shows), rect for its box
npm run page -- screenshot <file>           # once Ready and settled
npm run page -- score                       # a Live game on screen (the open panel's first) scores (`finish`: finishes), in this tab only, until the server's next change to it
npm run page -- tap <selector|x y>          # a real touch tap on the middle of the first match (or at the point)
npm run page -- swipe <selector|x y> <dx> <dy> [ms]   # a real touch swipe from there by (dx, dy) px, at a steady speed over ms (500)
```

**For anything touch** (a tap's tooltip, swiping the event panel), use `tap` and `swipe`: they send real touch input through the DevTools Protocol, which agent-browser can't, and `swipe` moves once a frame for the time asked, where agent-browser's `mouse` moves arrive too far apart and read as a flick. At 390×844 with a panel open, `swipe .event-panel 0 50` springs back, while `swipe .event-panel 0 160`, or the short one as a flick (`swipe .event-panel 0 50 50`), closes it (why: `web/src/panel/swipeClose.ts`). A tap on cut-off text (`tap .event-panel__team-name` on `edge-cases`' Chicago long-names game) shows its tooltip: `read .tooltip`.

1. **Start with `reset`.** The app saves the camera and settings to localStorage, so a run on the same port opens where the last one left off; a dark, empty globe is usually a saved camera over ocean. `reset` also sends the browser daemon's output to files of its own. A session started with a bare agent-browser command instead must send that command's output to a file, from Git Bash (`agent-browser open $web > /tmp/ab.txt 2>&1`): the daemon inherits its stdout, so a pipe, or PowerShell's `>`, waits forever.
   Add `--toured` unless you're checking the welcome tour itself: a first visit shows the tour, and the rail and the Events popover can't be used under it. While the tour shows, the globe shows its own Tour games (see `GLOSSARY.md`) over eastern North America, not the scenario's, which come back once it's finished.
   Set the viewport after `reset` (`agent-browser set viewport 1280 800`): the browser opens at its own size, and a size set before it opens can be lost.
   `score` and `finish` pick the open event panel's game when it's Live. A `finish` plays the game's celebration (`GLOSSARY.md`): confetti on its score card, and with its panel open, fireworks there and then the panel closing itself 4.2 s later, its card with it. The server's next change to the game undoes a made-up finish, and with it a close still to come: if the panel stays, `finish` again.
   A query on the web URL (`$web/?variant=A`) stays on the app's page. If `localhost` is refused, use `127.0.0.1`: a run open to the network listens on IPv4 only.
2. **Wait until it's drawn** before a measurement (`ready`): the page is Ready once the first games are on the globe and everything on it has stopped moving, and stays so. For screenshots to compare, start the scenario Paused too (see [Scenarios](scenarios.md)).
3. **Go somewhere with `camera`**, as `camera -74,40.7 6` for New York, rather than scrolling. Score cards and city labels show at every zoom for the games on screen, so look where the scenario has games: `crowded` over New York, London or Los Angeles.
4. **Open an event panel from the Events popover** (the rail's Events button), the reliable way in automation: a score card or pin off screen takes no click. Open it, then `click '#rail-popover [data-game-id="<id>"]'` (a score card on screen carries the same attribute), with the id from [the game list](scenarios.md#which-games-are-on). Confirm with `npm run page -- read .event-panel`. To click a pin itself (drawn by WebGL, so no refs): screenshot, then `mouse move <x> <y>`, `mouse down left`, `mouse up left` on a single pin's center; a circle with a number is a cluster, which zooms in.
5. **Pick from the scenario pill by ref.** The scenario controls are in the Scenario popover, from the top rail at the top left (local runs only): open it, open the pill, run `snapshot -i`, and `click @<ref>` on the entry's button. Refs go stale once the page changes, so take a fresh `snapshot -i` before each click by ref.
6. **Phone width.** Open the panel at 1280×800, then `set viewport 390 844`: the panel stays open, as the bottom sheet.
7. **Measure with `npm run page -- read`** where a screenshot can only suggest: an element's size (`read <selector> rect`), whether an image loaded (`read <selector> naturalWidth`, more than 0), which URL it came from (`read <selector> currentSrc`). It reads properties, not attributes: an aria-label is `read <selector> ariaLabel`.
