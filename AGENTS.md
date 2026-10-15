# ScoreMap

A hobby web app showing live sports games as pins on a globe, with scores that update on their own. The v1 design lives in GitHub issue #1 (the spec) and is broken into tickets #2–#16; domain terms are in `GLOSSARY.md` and key decisions in `docs/adr/`.

## Working mode

The app is still being shaped, so keep the process light:

- **A small change** (a tweak, a fix, or a feature touching a few files) is built directly on one branch with one PR: no ticket split, integration branch or subagent worktrees. `/implement-spec` is for features with several parts.
- **Tests cover behaviour** in the core logic: card layout, scenarios, polling, the ESPN feed and the game board. No test asserts a choice of look (#141); how it looks is checked by eye (`docs/style-guide.md`).
- **While working**, keep the loop **tight**: after each edit, run types, lint and the unit tests (seconds) from `web/` as `npx tsc -b`, `npm run lint` and `npm test` (the unit project only), and the server tests (`dotnet test server/ScoreMap.slnx -c Release`) for a change in `server/`. A change to how something looks goes straight back to the user, who sees it at once in their run through Vite; take screenshots only when asked, or when a change's working can't be told any other way.
- **Before a PR**, run the browser tests (`npm run test:browser`) once (minutes) if `web/src/globe/` or `web/scripts/page/` changed, with nothing else driving a browser and the output saved to a file: on a busy machine a long-pan test times out, so rerun just the timed-out tests by name (`npx vitest run --project browser <file> -t "<name>"`) before suspecting the change. CI runs lint, types and every test on each PR, and must pass before a merge; fix any failure before asking for one.
- **A retro or review** proposes a new check, script or tool only when the same mistake has cost real time more than once; otherwise it notes the mistake.
- **Docs change** when behaviour or a decision changes, not for every tweak. Each fact lives in one place: the README for setup and pointers, `docs/configuration.md` for configuration, the `run-scoremap` skill for scenarios and driving the app.

## Agent skills

### Pull requests

Commit work on a branch named for the issue (a worktree's own `worktree-<issue>-…` branch counts), created from `main`: pushes to `main` are blocked, and the user merges every pull request. GitHub deletes a pull request's branch when it's merged (the repo's "delete branch on merge" setting), so after a merge delete only the local branch; don't offer to delete the remote one.

### Issue tracker

Issues are tracked in GitHub Issues for phillipbritain/ScoreMap, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Style guide

Making or changing the theme, or any colour, font, size or status look: see `docs/style-guide.md`.

### Card layout

Score cards jumping about or landing in the wrong place on a running globe: capture and replay the layout, see `docs/agents/card-layout-replay.md`.
