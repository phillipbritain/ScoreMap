# ScoreMap

A hobby web app showing live sports events as pins on a globe, with scores that update on their own. Setup, the code's layout and the test commands are in `README.md`; domain terms are in `GLOSSARY.md`, and key decisions in `docs/adr/`.

## Working

The app is still being shaped, so keep the process light:

- **A small change** (a tweak, a fix, or a feature touching a few files) is built directly on one branch with one PR: no ticket split or integration branch. It needs no issue: where one would help, suggest it, and the user decides whether to work in place or file it for later. The implement-spec skill is for features with several parts.
- **Tests cover behavior** in the core logic: card layout, scenarios, polling, the ESPN feed and the game board. No test asserts a choice of look (#141): how it looks is checked by eye against `docs/style-guide.md`. A change to how something looks goes straight back to the user, who sees it at once in their own run; take screenshots only when asked, or when a change's working can't be told any other way.
- **After each edit**, run the type check, lint and unit tests (README's "Test"), and the server tests for a change in `server/`, with `-c Release` while a run is going (`docs/running-locally.md`).
- **Before a PR**, run the browser tests (`npm run test:browser` in `web/`) once if `web/src/globe/` or `web/scripts/page/` changed, saving the output to a file. If a long-pan test times out on a busy machine, rerun just that one (`npx vitest run --project browser <file> -t "<name>"`). Any other failure is the change's until the suite passes with the change reverted.
- **Use the glossary's terms** in code, comments, docs and on screen, and **American spelling** (color, behavior, center); names and outside data (ESPN, venues, places) keep theirs.
- **Each fact lives in one place**; the docs below say where.

## Pull requests

- **Branch from `origin/main`**, named for its issue when it has one (a worktree's own `worktree-<issue>-…` branch counts).
- **`main` changes only through a pull request**, squash-merged once the required checks (`web`, `server` and `attribution`) pass on a branch that's up to date. The user merges every pull request.
- **No AI credit**: no commit authored or committed as an AI tool, and no `Co-Authored-By` trailer naming one, in commits or the PR's title and description. The `attribution` check fails the PR otherwise.
- **Working an issue**, move its card on the project board: to **In progress** when starting, and to **In review** when opening its pull request (`docs/agents/issue-tracker.md`).

## Docs

- **Running the app**, driving or screenshotting it, or picking a scenario: `docs/running-locally.md` (use the run that's there, or start an isolated one of your own), `docs/browser-automation.md` (drive it with `npm run page`) and `docs/scenarios.md` (pick the one that shows what you're checking).
- **Configuration**: `docs/configuration.md`. ESPN's feed: `docs/espn-data.md`. City labels: `docs/city-labels.md`. Deploying: `docs/deploy.md` and `docs/terraform.md`.
- **The theme**, or any color, font, size or status look: read the contents at the top of `docs/style-guide.md`, then only the sections you need.
- **Score cards jumping about** or landing in the wrong place on a running globe: capture and replay the layout (`docs/agents/card-layout-replay.md`).
- **Prototyping UI** (variants, a switcher): ScoreMap's notes to the prototype skill are in `docs/agents/prototyping.md`.
- **Issues, labels and domain docs** as the shared skills use them: `docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md` and `docs/agents/domain.md`.
- **Reviewing code**: `CODING_STANDARDS.md`.
