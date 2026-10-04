# ESPN's unofficial feed for the hobby v1, behind a swappable provider

ScoreMap starts as a hobby app that may launch publicly later. For v1 we take live game data from ESPN's undocumented scoreboard endpoints (`site.api.espn.com`). They are free, cover every league we want, and include team logos, game clock, venue and broadcast data that the cheaper licensed feeds lack. ESPN's terms don't allow automated use and the endpoints can change without notice, so all provider access goes through one adapter. Before any public launch, that adapter must be replaced with a licensed feed (e.g. API-Sports, football-data.org, or Sportradar/SportsDataIO).

## Consequences

- No venue coordinates come from ESPN, so we geocode venues ourselves and keep our own venue table.
- No source gives official stream links, so we keep our own broadcaster-to-watch-URL mapping.
- Scores lag real play by roughly 10–30 seconds; "live" in ScoreMap means near-live.
