# Orchestrating workers on ScoreMap

How a coordinator runs several Orca workers (Claude or Codex) on this repo. The `orchestration` skill covers the Orca commands; this covers what ScoreMap adds to them.

## Roles

- **The coordinator relays.** It starts workers, hands each one its work, passes on the user's requests to the worker that owns the PR, and reports status back. A request the user makes in the coordinator's chat goes to the owning worker; the coordinator keeps its hands off a worker's checkout.
- **One coordinator per run.** Taking over a run: bind it with `orca orchestration run-use --id <run>`, then send every open worker a one-line note naming the new coordinator. Workers report to `run:<id>`, which survives a change of coordinator; a terminal handle does not.
- **One worker per PR.** A worker that hands off a PR ends its turn and leaves the workspace to the new owner. Before giving a PR to a new worker, tell the old one it no longer owns it, so it doesn't wake on a later message and act.
- **One new worker per issue.** Each issue the user names gets its own new worker and workspace. When two issues touch the same files, tell the user about the overlap when starting the second. (city-dots and label-churn both rewrote `placeNames.ts`, which took a run of relays until the user merged the work, and #449 gave way to #450 mid-review.)
- **The user answers in the worker's workspace.** When a worker asks the user something, the coordinator says only that it has a question, naming the worker, and leaves the question and the user's answer out of its own chat. It tracks which questions are still unanswered from the workers' status notes.
- **PRs go by number and workspace name:** "#449 (`city-labels`)".

## Worker spec

Every worker's brief includes:

- Branch from `origin/main` (`--base-branch origin/main`); the primary clone's `main` can be stale.
- No `Co-Authored-By` trailer or Claude author anywhere: CI's commit attribution check fails the PR, and force pushes are blocked, so one bad commit means a new branch and PR.
- Questions for the user go to the user directly in the worker's own terminal, one per message with a recommendation. The worker sends the coordinator a one-line status when it asks and when it's answered, without stating the question, and asks the coordinator only about coordinator matters: the browser-suite turn, the review run, merges, overlap with other workers.
- When the PR is ready for the user's review, send the coordinator a status saying so; the coordinator gives out the review run.
- Read mail with `orca orchestration check --terminal dispatch:<id>`: `check` takes `--terminal`, unlike `send` and `ask`, which take `--from`.
- A **Decisions** section in the PR body listing every answer the worker was given.
- When the user tells the worker something directly that changes a decision, the scope, the review run or a PR, send the coordinator a one-line note at once.
- While still fixing a PR after a failed CI or a problem, mark it draft (`gh pr ready --undo`), and `gh pr ready` once done.
- Mid-task follow-ups (merging main, a review run) are answered with `send --type status`; `worker_done` settles the task and comes only once the PR is merged, after the worker has stopped its review run and listed every problem it ran into during the task (for the retro).

## The review run

The user reviews in one Aspire run on the default ports, started in the workspace of the PR under review: only one finished worker has a run at a time. Whenever the coordinator lists a run, it gives both its local URL (http://localhost:5173) and its network URL (`http://<this machine's address>:5173`, the address from `ipconfig getifaddr en0` on a Mac). `scripts/review-run.sh` says which clone holds 5173/5147, at what commit and whether it's clean, and flags an orphan run whose folder was removed; run it before giving out the review run and before each "ready for review" message.

- **The coordinator gives out the ports.** A worker the user asks to free or take 5173/5147 tells the coordinator first, so the PR under review goes back in the queue rather than losing its run unannounced.
- **What's reviewed is what merges.** Any commit made during a review is pushed at once, and the PR goes to draft until its CI is green. Each "ready for review" message gives the pushed SHA and confirms the review run serves it. (#435 merged at a green remote head while the reviewed commit sat local; the work came back as #439.)
- Bring main into a workspace with a live run by merging in a scratch git worktree, with `npm ci` and the tests there, then fast-forward the live workspace. `npm ci` or `npm install` in the live workspace breaks Vite's dependency resolution until `aspire resource web restart`.
- One worktree has one run: `aspire start --isolated` in the review workspace replaces the user's run.

## Browser suites

Across workers, run one full browser suite at a time: the coordinator gives out the turn. Several suites at once push the load high enough to trip the timing-sensitive tests (#440, #441, #442). A failure in a test that the PR can't reach is checked against the open flaky-test issues before anyone investigates it; one worker owns a shared failure, and the rest wait for its result.

## Waiting for CI

Watch the run for the pushed commit: `gh run list --commit $(git rev-parse HEAD)`, then `gh run watch <id> --exit-status`. `--branch <b> --limit 1` straight after a push can return the previous run, green for the old commit. When no run appears, check `gh pr view --json mergeable`: GitHub starts no CI on a conflicting PR.

## After each merge

The user merges every PR. When the user says one is merged, or a check of its state shows it:

1. Confirm it with `gh pr view <n> --json state` on its own, and read the result before anything else.
2. Have its worker report back: it stops its review run (`aspire stop` in its workspace; a run whose folder is gone can't be stopped by path) and lists the problems it ran into, which go in the session log. Then it sends `worker_done`.
3. Release the worker (`worker-release`; when it refuses because the dispatch is still active, `worker-stop` first), then delete its workspace and local branch. A worker can't remove the workspace it runs in, so the coordinator does it. A scratch git worktree is invisible to Orca and needs its own `git worktree remove`.
4. Start the review run in the workspace of the next PR ready for review, and tell the user what's ready to view, with its local and network URLs.
5. Tell every other open PR's worker to merge `origin/main`, rerun the checks and push: every merge leaves the others behind main.

## Session log

Keep worker-reported problems in `.orchestrator/worker-issues.md` in the coordinator's workspace (add `.orchestrator/` to `.git/info/exclude`), so `/retro` can read them. Before removing the coordinator's workspace, copy `.orchestrator/` to `~/orca/orchestrator-logs/ScoreMap-<date>-<topic>/`.
