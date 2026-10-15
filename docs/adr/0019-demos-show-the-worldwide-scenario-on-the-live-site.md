# Demos show the worldwide scenario on the live site

ADR-0009 kept scenarios to local runs, so the deployed site could never show made-up scores. Real games come and go, and with nothing on, the live site is a bare globe, so to show ScoreMap off at any time we let a link with `?demo` (any value) open a **demo**: the worldwide scenario in place of real games, for that viewer only. Everyone else stays on real games. This is the same on local runs, where a demo is kept apart from the scenario the pill runs.

## Considered options

- **Switching the server's one scenario**, as the pill does on a local run, would have put every viewer of the live site onto made-up games whenever anyone opened the link.
- **A game board for each demo viewer** would have let each one pause, speed up and reset their own demo, at a cost that grows with every open tab and needs a cap and clean-up. **Making the games up in the browser** would have left the real code from the feed onwards untested by demos, which is what ADR-0009 put scenarios in the server for.
- **Letting viewers pick a scenario** was dropped: the others (edge-cases, empty, slow-initial-load, crowded) are for testing and look broken, or would hold up everyone's games.

So the server runs one demo board, alongside the real one, that every demo viewer shares.

## Consequences

- A demo has no scenario controls: no pill, no media keys and no scenario clock. The speed stays Normal and nobody can reset it, since one viewer's Pause or Reset would change every other viewer's demo. The scenario endpoints stay Development only.
- The demo board starts when the first demo viewer connects and stops a short while after the last leaves. The next one starts it afresh from the scenario's start (its seed and its clock), so nothing plays while nobody is watching, and each first viewer gets the same full opening.
- A label over the globe says the games are made up, so a shared screenshot can't pass them off as real. Shift+S hides it, as it hides the scenario controls and the Feedback button, for clean recordings.
- A demo opens on first-visit settings and saves none (neither the viewer's settings nor where they left the globe), so every demo looks the same and the viewer's real settings stay as they were.
- Feedback sent from a demo says so, so its open game isn't taken for a real one.
- The scenario files, venue list, team list and venue locations the worldwide scenario uses now ship to production.
