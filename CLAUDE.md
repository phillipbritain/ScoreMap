# ScoreMap

A hobby web app showing live sports games as pins on a globe, with scores that update on their own. The v1 design lives in GitHub issue #1 (the spec) and is broken into tickets #2–#16; domain terms are in `GLOSSARY.md` and key decisions in `docs/adr/`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for phillipbritain/ScoreMap, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`. See `docs/agents/domain.md`.
