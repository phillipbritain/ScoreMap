# Replaying the card layout

For score cards that jump about, or land in the wrong place, on a running globe. The layout (`web/src/globe/cardLayout.ts`) is a pure function of each frame's cards, scene and the frame before, so a pan captured from a dev run replays the same way every time, in seconds: a **tight** loop to measure a fix against, rather than eyeballing the globe.

1. **Start a dev run** (`aspire start`, see the run-scoremap skill), and take its web URL from `aspire describe`. In dev runs only, `window.scoremap` holds the map and the last 300 frames the cards were laid out from (`web/src/globe/layoutTrace.ts`).
2. **Capture a pan.** Set the camera and pan at the top of `web/scripts/panGlobe.js` to the place showing the problem, then run it in the page:

   ```sh
   agent-browser set viewport 1280 800
   agent-browser open "$web"   # the run's web URL
   agent-browser eval "$(cat web/scripts/panGlobe.js)" > "$CLAUDE_JOB_DIR/tmp/trace.json"
   ```

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
