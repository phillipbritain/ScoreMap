# ScoreMap

A hobby web app showing live sports games as pins on a globe, with scores that update on their own. The v1 design lives in GitHub issue #1 (the spec) and is broken into tickets #2–#16; domain terms are in `GLOSSARY.md` and key decisions in `docs/adr/`.

## Working mode

The app is still being shaped, so keep the process light:

- **A small change** (a tweak, a fix, or a feature touching a few files) is built directly on one branch with one PR: no ticket split, integration branch or subagent worktrees. It needs no issue: where one would help, suggest it, and the user decides whether to work in place or file it for later. `/implement-spec` is for features with several parts.
- **Tests cover behavior** in the core logic: card layout, scenarios, polling, the ESPN feed and the game board. No test asserts a choice of look (#141); how it looks is checked by eye (`docs/style-guide.md`).
- **While working**, keep the loop **tight**: after each edit, run types, lint and the unit tests (seconds) from `web/` as `npx tsc -b`, `npm run lint` and `npm test` (the unit project only), and the server tests (`dotnet test server/ScoreMap.slnx -c Release`) for a change in `server/`. A change to how something looks goes straight back to the user, who sees it at once in their run through Vite; take screenshots only when asked, or when a change's working can't be told any other way.
- **Before a PR**, run the browser tests (`npm run test:browser`) once (minutes) if `web/src/globe/` or `web/scripts/page/` changed, with the output saved to a file. Two full runs at once are fine for one agent (both pass at normal speed on an M1 Pro); if a long-pan test times out on a busier machine, rerun just that test by name (`npx vitest run --project browser <file> -t "<name>"`). Any other failure in the full run is the change's until the full suite passes with the change reverted. CI runs lint, types and every test on each PR, and must pass before a merge; fix any failure before asking for one.
- **Each fact lives in one place**: the README for setup and pointers, `docs/configuration.md` for configuration, `docs/scenarios.md` for scenarios, `docs/running-locally.md` for a run once it's set up, and `docs/browser-automation.md` for driving a browser on it.

## Agent skills

### Pull requests

The user's global agent instructions cover branches, merging, AI credit and waiting for CI. Here, a worktree's own `worktree-<issue>-…` branch counts as named for its issue, and the required checks are `web`, `server` and `attribution`.

Working an issue, move its card on the project board: to **In progress** when starting work, and to **In review** when opening its pull request (the commands are in `docs/agents/issue-tracker.md`).

### Running the app

Running, driving or screenshotting the app, or picking a scenario: use the run that's there, or start an isolated one of your own (`docs/running-locally.md`), drive it with `npm run page` (`docs/browser-automation.md`), and pick the scenario that shows what you're checking (`docs/scenarios.md`).

### Issue tracker

Issues are tracked in GitHub Issues for phillipbritain/ScoreMap, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Style guide

Making or changing the theme, or any color, font, size or status look: read the contents at the top of `docs/style-guide.md`, then only the sections you need.

### Card layout

Score cards jumping about or landing in the wrong place on a running globe: capture and replay the layout, see `docs/agents/card-layout-replay.md`.

### Prototyping

Prototyping UI here (variants, a switcher): ScoreMap's notes to the `prototype` skill are in `docs/agents/prototyping.md`.
