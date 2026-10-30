# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Flaky test issue**: give the commit SHA it failed on, the exact command, and the failure count (e.g. 2 of 12).
- **Fixing a flaky test issue**: start the loop on the commit it was reported against (a `git worktree` at that SHA, its `web/node_modules` junctioned to this clone's), not HEAD: a later change can hide the flake without fixing it, as #104 hid #109. Red there but green on HEAD: find the hiding change in `git log <sha>..HEAD -- <files on the failing path>` and take it out on HEAD to get red again. Add stress only when the reported commit won't go red either.
- **Read an issue**: `gh issue view <number> --json title,body,state,labels,comments --jq '.title, .state, .body, [.labels[].name], (.comments[].body)'`. (Plain `gh issue view <number> --comments` can print nothing from the agent's shell.)
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v`; `gh` does this automatically when run inside a clone.

## Project board

Issues sit on the ScoreMap project board (GitHub Project 1 for `phillipbritain`), with a Status of Backlog, Ready, In progress, In review or Done. GitHub's own project workflows set Ready and Done; an agent working an issue moves its card at two points:

- **Starting work** on an issue: set it to **In progress**.
- **Opening the PR** that closes it: set it to **In review**.

Set the status like this, with `<n>` the issue number and `<option-id>` from the table:

```sh
ITEM=$(gh project item-add 1 --owner phillipbritain --url "https://github.com/phillipbritain/ScoreMap/issues/<n>" --format json --jq .id)
gh project item-edit --project-id PVT_kwHOAiInZM4Bn2N0 --id "$ITEM" --field-id PVTSSF_lAHOAiInZM4Bn2N0zhmY9UE --single-select-option-id <option-id>
```

| Status | Option id |
| --- | --- |
| In progress | `47fc9ee4` |
| In review | `df73e18b` |

`item-add` returns the existing card when the issue is already on the board, so it is safe to run every time. It needs the `project` scope on `gh`; on a scope error, ask the user to run `gh auth refresh -h github.com -s project`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either: resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Read it as "Read an issue" above says.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only, the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: `gh issue comment <n> --body "<answer>"`, then `gh issue close <n>`, then append a context pointer (gist + link) to the map's Decisions-so-far.
