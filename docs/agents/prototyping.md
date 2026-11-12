# Prototyping UI in ScoreMap

ScoreMap's notes for the `prototype` skill's UI branch. Where they differ from the skill, these win.

- **Rework what exists.** When the thing being prototyped is already on screen, the first round varies today's component: its layout, sizes and placement. Radically different directions come in a first round only when the user asks for them. (The game panel's first round of radical layouts missed what the user wanted.)
- **Cycle with `[` and `]`.** MapLibre pans the globe on the arrow keys, so the switcher's keys are the brackets.
- **Keep the switcher bar clear of bottom sheets.** The game panel and the other phone sheets sit at the bottom of the screen, so place the bar where they don't reach, and compact it to one line at phone width.
- **Show the user the current default.** A variant choice saved in `localStorage` outlives a changed default, so key saved choices by version, or keep the choice in the URL alone.
- **Name the URL param for the prototype**, such as `?pickerProto=`, so prototypes built side by side keep apart.
- **See every variant yourself before reporting**, at 1280x800 and at 390x844, on a run of your own: the run-scoremap skill covers starting one and driving a browser on it.
