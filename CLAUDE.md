# ScoreMap

A hobby web app showing live sports games as pins on a globe, with scores that update on their own. The v1 design lives in GitHub issue #1 (the spec) and is broken into tickets #2–#16; domain terms are in `GLOSSARY.md` and key decisions in `docs/adr/`.

## Working mode

The app is still being shaped, so keep the process light:

- **A small change** (a tweak, a fix, or a feature touching a few files) is one ticket, built in this session directly on one branch with one PR. `/implement-spec` is for features with several parts.
- **Tests cover behaviour** in the core logic: card layout, scenarios, polling, the ESPN feed and the game board. How the app looks is checked by eye (`docs/style-guide.md`).
- **While working**, run the tests for what changed. Before a PR, run lint, types and unit tests, plus the browser tests when `web/src/globe/` or `web/scripts/page/` changed and the server tests when `server/` changed. CI runs everything on every PR.
- **A retro or review** proposes a new check, script or tool only when the same mistake has cost real time more than once; otherwise it notes the mistake.
- **Docs change** when behaviour or a decision changes. Each fact lives in one place: the README for setup and pointers, `docs/configuration.md` for configuration, the `run-scoremap` skill for scenarios and driving the app.

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
