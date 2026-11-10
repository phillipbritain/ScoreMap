# Replaying the card layout

For score cards that jump about, land in the wrong place, or gather wrongly into card clusters, venue clusters or small pins, on a running globe. The card layout (`web/src/globe/cardLayout.ts`) works out each frame from the cards and scene it's given and the frame before, which it keeps itself, all in screen pixels. The trace records that whole input each frame, so a captured pan replays the same way every time, in seconds: a **tight** loop to measure a fix against, rather than eyeballing the globe. A trace saved before the card layout kept its own frame (#333) won't replay: capture a fresh one.

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

3. **Replay it**, feeding the frames in order into one new card layout:

   ```sh
   cd web
   CARD_TRACE=<trace.json> npx vitest run --project unit scripts/replayCardTrace.test.ts --silent=false
   ```

   It prints how often cards jumped, by kind (between above its venue, moved, in a card cluster and its small pin), each jump over 24 px beside a venue on screen (the jumps a viewer sees), and how many frames broke each gathering rule (`web/src/globe/gatheringRules.ts`): a game missing or shown twice, a card cluster of one game, or a trail not ending at its venue dot, its venue cluster or the card cluster that counts it. Every count of broken frames should be 0; a rule a frame breaks is a bug in the card layout.

4. **Compare with another version** of the card layout by copying it beside the current one and naming it in `CARD_LAYOUT_COMPARE`: the replay makes its card layout with the copy's `cardLayout()`, so the version must be from #333 on. Delete the copy afterwards:

   ```sh
   git show main:web/src/globe/cardLayout.ts > src/globe/cardLayoutAt.ts
   CARD_TRACE=<trace.json> CARD_LAYOUT_COMPARE=src/globe/cardLayoutAt.ts npx vitest run --project unit scripts/replayCardTrace.test.ts --silent=false
   ```

The trace holds place names as they were placed. In the app, names are placed around the cards' footprints, so a layout that moves cards differently would also move some names; the replay can't show that.

Once a jump or a broken rule is understood, lock it down in `cardLayout.test.ts`: a few cards over two frames through one `cardLayout()`, as in "frame after frame", or carrying `previous` into `layOutCards`, as in "laid out again, as the globe turns".
