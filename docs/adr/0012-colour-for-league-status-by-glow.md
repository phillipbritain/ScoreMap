# Colour will stand for league; status shows by brightness and glow

Until the dark theme, a game's status was its colour: orange for Live, amber for Upcoming, greys for Final and Disrupted. Colour is the strongest signal on a map, and only about six to eight colours can be told apart on one, so it's wanted later for something more useful when several leagues are shown at once: telling the leagues (likely by sport) apart. So colour is kept for league, and status shows by brightness and glow instead: Live glows widest and its score card's status light pulses, Upcoming glows less, Final has no glow and fades, and Disrupted has no glow and greys out. Until league colours come, the dark theme gives every Live, Upcoming and Final game the one gold accent and Disrupted games a grey, so a game's colour already says nothing about its status but whether it's being played as scheduled.

## Consequences

- Each status keeps its own colour in the theme's palette (`palette.live` and so on, ADR-0014), even though the dark theme gives three of them the same gold, so league colours, or a theme that shows status its own way (a light theme, where glows barely show), can change them without a new setting.
- Each status's glow and how much it fades are theme settings, each with the component it shows on: a small pin's core and glow are the Pin's, a cluster's opacity the Cluster's (which glows as its status's pins do), a score card's fade and glow the ScoreCard's.
- Glow means a game: panels and controls have no glow and no drop shadow, so nothing else on screen looks lit.
- A pulse plays in the game's own colour, and a score, a start and a finish are told apart by the pulse's shape, never by its colour.
- The small pins' clustering footprint comes from the widest glow, so a theme that widens Live's glow makes pins gather into pin clusters sooner.
