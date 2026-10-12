# Replaying the card layout

For score cards that jump about, or land in the wrong place, on a running globe. The layout (`web/src/globe/cardLayout.ts`) is a pure function of each frame's cards, scene and the frame before, so a captured pan replays the same way every time, in seconds: a **tight** loop to measure a fix against, rather than eyeballing the globe.

Capture a pan one of two ways, then replay it.

1. **Capture a scene** you set up yourself, like the browser tests' crowds: a few seconds, with no dev run. Edit the scene and pan at the top of `web/scripts/captureCardTrace.browser.test.ts` (they start as the crowd from #122), then run it, naming where to save the trace:

   ```sh
   cd web
   CARD_TRACE="$CLAUDE_JOB_DIR/tmp/trace.json" npx vitest run --project browser scripts/captureCardTrace.browser.test.ts
   ```

2. **Or capture a real drag** from a dev run, for games as the app shows them. Start a dev run (`aspire start`, see the run-scoremap skill), and take its web URL from `aspire describe`. `npm run page -- pan` (dev runs only) waits for the globe to be ready, turns to the camera, waits for it to settle, pans a few pixels a frame as a slow drag would, and saves the pan's frames. Each `--by` is a step of the pan, `<x>,<y>,<frames>`, in order, up to 300 frames in all (as many as the page keeps); anything left out pans over Los Angeles, east then north:

   ```sh
   cd web
   agent-browser set viewport 1280 800 > /tmp/ab.txt 2>&1   # the session's first command: output to a file (run-scoremap)
   agent-browser open "$web"   # the run's web URL
   npm run page -- pan "$CLAUDE_JOB_DIR/tmp/trace.json" --center 8,51.5 --zoom 5 --by -4,0,250
   ```

   Keep traces and scratch scripts in `$CLAUDE_JOB_DIR/tmp`: a scratch `*.test.ts` under `web/` joins `npm test`.

3. **Replay it** through the layout:

   ```sh
   cd web
   CARD_TRACE=<trace.json> npx vitest run --project unit scripts/replayCardTrace.test.ts --silent=false
   ```

   It prints how often cards jumped, by kind, and each jump over 24 px beside a venue on screen: the jumps a viewer sees.

4. **Compare with another version** of the layout by copying it beside the current one and naming it in `CARD_LAYOUT_COMPARE`; delete the copy afterwards:

   ```sh
   git show main:web/src/globe/cardLayout.ts > src/globe/cardLayoutAt.ts
   CARD_TRACE=<trace.json> CARD_LAYOUT_COMPARE=src/globe/cardLayoutAt.ts npx vitest run --project unit scripts/replayCardTrace.test.ts --silent=false
   ```

The trace holds place names as they were placed. In the app, names are placed around the cards' footprints, so a layout that moves cards differently would also move some names; the replay can't show that.

Once a jump is understood, lock it down in `cardLayout.test.ts`: a few cards over two frames, carrying `previous`, as in "laid out again, as the globe turns".
