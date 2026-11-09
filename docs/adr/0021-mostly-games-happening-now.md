# Mostly games happening now

ScoreMap is for seeing games as they happen, and pins for games not on (hours before a start, hours after a finish, or postponed, suspended or canceled) cluttered the globe around the Live ones. Viewers could hide them with the rail's "Live games only" and "Show Disrupted games" switches, but the owner wants the app itself to be about games happening now. So the server shows a game from 30 minutes before its start (the Upcoming window, which was 3 hours) until 5 minutes after it finishes (the Final window, which was 2 hours), and never shows a Disrupted game: not on the globe, nor in the Games list. The two switches, and the viewer settings behind them, are gone.

## Consequences

- The windows and the Disrupted rule are the server's, where the pin windows always were, so every viewer and the Games list see the same games, and the browser has no filter by status left. A Disrupted game is left off the board like a game outside its window: a Live game that is suspended is removed at once, and comes back as an added game if it resumes.
- A game seen to finish is still sent Final, so its final score shows and its finish pulse plays, before it goes 5 minutes later (on the next poll after that, up to 3 minutes more while its league has no Live games). A game already Final when the server first sees it is still estimated to have ended at its planned end (ADR-0005), so after the server sleeps, games that ended over 5 minutes ago don't come back.
- With no Disrupted game ever shown, its grey look (the palette's `disrupted` colour, its pin, cluster and score card looks) and the score card's "Postponed" or "Suspended" line went too. Bouts keep their Disrupted status, as a bout called off on a fight card that's on.
- Scenarios no longer disrupt games: `"disrupted"` (the share of games Disrupted under play) and the fill's Disrupted games were dropped, as they would only take games off the globe. A scenario file can still write a game postponed, suspended or canceled, which the board then leaves off, as it would ESPN's.
- Settings saved by an older visit with either switch in them load without it, and lose it when next saved.
