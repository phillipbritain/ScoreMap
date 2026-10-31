# ESPN data

What ESPN's unofficial API (ADR-0001) gives for a game, what ScoreMap reads from it, and what's there to add later. All of ESPN's response shape is read in `server/src/ScoreMap.Server/GameFeed/EspnGameFeedProvider.cs`; how often the server asks is in [configuration.md](configuration.md#polling).

The field names below are ESPN's, under `https://site.api.espn.com/apis/site/v2/sports/{sport}/{league}/`. Some fields only show up in some sports or states. This list was checked against live responses in October 2026, and ESPN changes them without notice.

## Requests the server makes

| Request | When | Size |
| --- | --- | --- |
| `scoreboard?dates=YYYYMMDD&limit=500` | Every poll of a league, for yesterday and today (and near midnight, tomorrow) | Tens of KB per day |
| `summary?event={id}` | A US sport's game whose score has changed since the server last asked (for its last score) | About 5–500 KB; basketball and hockey list every play |
| `teams/{id}` | Once per home team, only for a game with no venue (for its city) | Small |

## What ScoreMap reads

From the **scoreboard**, for each game: its id, start, status (`status.type`), clock, period, the period's phase, its venue's name, city, state and country, the broadcasters (`geoBroadcasts`, else `broadcasts`), and its notes' headlines (`competitions[].notes`). For each team: abbreviation, name, logo, score (cricket's score text as its innings), its overall record (`records`, type `total`) and its poll ranking (`curatedRank.current`, 1–25; ESPN puts unranked teams at 99). Also the attendance, the first betting line (`odds[0]`: `details`, `overUnder`, `provider.name`), a Live game's `situation` (`lastPlay.text`, `downDistanceText`, `possession`, `balls`, `strikes`, `outs`, `onFirst`, `onSecond`, `onThird`), and soccer's goals and cards (`competitions[].details`, the scorer from `athletesInvolved`).

In **tennis** (`tennis/atp`, `tennis/wta`) each event is a tournament, its matches the competitions under its `groupings`. Only main-draw singles matches are read: groupings `mens-singles` and `womens-singles`, leaving out rounds whose `round.displayName` starts "Qualifying" and matches with a side still "TBD". Each is a game with the competition's id (Top Events list it as `competitionId`). For each player: `athlete.shortName`, `displayName` and `flag.href`; each set's games from `linescores` (`value`, `tiebreak`, and `winner` for a set won); and `winner` for who advanced after a retirement (`STATUS_RETIRED`) or walkover (`STATUS_WALKOVER`). The venue is the event's `name` (the tournament) in the competition's `venue.fullName` (its city, "Shanghai, China PR"), with `venue.court`, and the note is the tournament and `round.displayName` in shorthand ("QF", "R1"). `format.regulation.periods` isn't read: it says 5 even at best-of-3 tournaments. Each day's tennis scoreboard lists the whole of each tournament under way.

From the **summary**, for football, the last of its `scoringPlays`; for basketball, hockey and baseball, the last play marked `scoringPlay` among its `plays`. From each, the text, team, period (and baseball's `Top` or `Bottom`), clock, and the scores after it, to tell whether the summary has caught up with the scoreboard.

## Available but not read

### On the scoreboard (no extra request)

Per team (`competitions[].competitors[]`):

- `linescores`: points in each period (quarters, halves, innings, periods).
- `statistics`: team totals for the game. Basketball has rebounds, assists, field goals, free throws and threes; soccer has shots, shots on goal, possession, fouls, corners and so on; football has none on the scoreboard.
- `leaders`: the team's top performers (MLB, per team).
- `records` beyond the total: home and road records, and in college a conference record (`vsconf`).
- `form`: soccer's last five results, newest last ("LDWLD").
- `winner`: true for the winner of a finished game.
- MLB: `hits`, `errors`, and `probables`, the probable starting pitchers before a game.

Per game (`competitions[]`):

- `leaders`: the game's top performers by stat, e.g. points "38, S. Gilgeous-Alexander", or passing "28/35, 273 YDS, 1 TD, J. Allen".
- `headlines`: after a game, a recap headline and description ("Recap": "Josh Allen carries Bills to 27-24 win…").
- `highlights`: video clips, where ESPN has them.
- `series`: a playoff series' standing ("SEA wins series 3-2", with each side's wins), or a two-legged soccer tie's aggregate score.
- `neutralSite`, `conferenceCompetition`, and the venue's `indoor`.
- The rest of `odds[0]`: `moneyline`, `spread`, `homeTeamOdds` and `awayTeamOdds` (favourite or underdog, and whether at the open). ESPN drops the odds once a game is over.
- `situation` beyond what ScoreMap reads, only while a game is under way: in baseball the `batter` and `pitcher`, each with a summary of their game so far ("0.0 IP, 0 ER, 0 H, 0 BB"); with every sport's `lastPlay`, its type, the players in it and (basketball) each team's chance of winning. Football's is said to have red-zone and timeout fields; no live football response has been checked yet.
- `altGameNote`, `wasSuspended`, `format` (the regulation periods).

### In the summary (already asked for, but only when a US sport's score changes)

Anything taken from here only refreshes when the score changes. Fresher would mean asking more often: up to about 500 KB per basketball or hockey game each time.

- `boxscore`: per-player and per-team stats.
- `leaders`: the game's leaders, per team.
- `winprobability`: each team's chance of winning after every play (basketball: about 470 entries a game).
- `drives` (football): each drive, its plays and its result.
- `plays`: every play, with shot coordinates in basketball.
- `gameInfo`: the attendance, the officials, the venue (with its photos, and whether it's grass), and the weather at outdoor football games.
- `standings`: the league's or division's standings.
- `injuries`: each team's injury report.
- `seasonseries`: how the two teams' games this season have gone.
- `news`, `article`, `videos`: ESPN's coverage of the game.
- `pickcenter`, `againstTheSpread`, `odds`: more betting data, from several bookmakers.

Soccer, cricket and tennis games never get a summary request. Soccer's summary has its key events (`keyEvents`), lineups and match stats; cricket's has scorecards.

### Not offered

ESPN gives no venue coordinates or end times (see ADR-0005). The cricket scoreboard is the only one that has a venue's `capacity`, and ScoreMap shows attendance instead.
