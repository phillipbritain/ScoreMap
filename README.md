# ScoreMap

A globe showing live sports games as pins at their venues, with scores that update on their own. See issue #1 for the v1 spec, `GLOSSARY.md` for domain terms and `docs/adr/` for key decisions.

## Layout

- `server/` — C# ASP.NET Core server (`ScoreMap.slnx`)
  - `src/ScoreMap.Server/` — the server: game feed provider (`GameFeed/`), game board (`Games/`), venue locator (`Venues/`), SignalR hub (`Hubs/`)
  - `tests/ScoreMap.Server.Tests/` — server seam tests: the real server with fake provider and clock
- `web/` — React + TypeScript browser app built with Vite, MapLibre globe, Vitest unit tests

## Prerequisites

- .NET SDK 10
- Node.js 24

## Run locally

In two terminals, from the repo root:

```sh
dotnet run --project server/src/ScoreMap.Server --launch-profile http   # server on http://localhost:5147
```

```sh
npm --prefix web install   # first time only
npm --prefix web run dev   # browser app on http://localhost:5173
```

Open http://localhost:5173. The Vite dev server proxies `/hubs` (SignalR) to the server.

The server reads each league's games from ESPN's scoreboards for yesterday and today (and, within 3 hours of midnight, tomorrow), in US Eastern days as ESPN keeps them, and looks each venue up once through OpenStreetMap Nominatim, saving the results to `server/src/ScoreMap.Server/data/venue-locations.json` (git-ignored; delete it to look venues up again).

Venue lookups can be wrong (e.g. a stadium placed in a same-named town). To fix a pin, add the venue's name and the right position to `server/src/ScoreMap.Server/venue-corrections.json`, for example `"Lincoln Financial Field": { "latitude": 39.9008, "longitude": -75.1675 }`. Corrections override any lookup and take effect from the next poll, without a restart. When a venue can't be found, its pin goes to the centre of its city; when a game has no venue, to the home team's city.

The leagues shown are listed under `Leagues` in `appsettings.json`. Each has a `Key` (ESPN's `{sport}/{league}`, optionally with scoreboard options after a `?`), a display `Name`, its `Sport`, and optionally `RegulationPeriods` when it plays a different number of periods from its sport's usual (2 halves in college basketball). `PlannedLength` (a time span such as `"03:15:00"`, default 3 hours) is how long the league's games usually take from start to finish. ESPN gives no end times, so the server uses it to estimate when a game ended when it first sees the game already Final (for instance after sleeping), and to keep a postponed or canceled game's pin until 2 hours after its planned end (ADR-0005).

While at least one browser is connected, the server polls each league about every 15 seconds while it has Live games and every 3 minutes otherwise, and pushes change events to browsers over SignalR. With no browser connected it doesn't poll at all; the next browser to connect gets a freshly fetched snapshot, as does a browser reconnecting after a dropped connection.

The game panel links each channel or streaming service to its official watch page when it is listed in `server/src/ScoreMap.Server/watch-links.json`, for example `{ "names": ["Peacock"], "url": "https://www.peacocktv.com/" }` (names match ESPN's spelling, ignoring case). Unlisted services show as plain names. Edits take effect without a restart. When the feed lists broadcasts for the viewer's country (taken from the browser's language settings), broadcasts it marks for other countries are hidden; otherwise every channel is listed.

The game panel can also show unofficial stream links (hobby v1 only, ADR-0002). The stream finder searches the sites listed under `StreamFinder:Sites` in `appsettings.json` (or user secrets/environment settings); the list ships empty, which switches the finder off. Each site is `{ "Name": "...", "SearchUrl": "https://.../search?q={query}", "LinkPattern": "<regex with a named group href, and optionally text>" }`: `{query}` becomes both teams' names (`{away}` and `{home}` one each), and a found link is kept only when its text or address mentions both teams' nicknames. Each Upcoming or Live game is searched in the background with a short timeout per site (`TimeoutSeconds`, default 3) and the result is cached (`CacheMinutes`, default 10), so links appear a poll or so after a game gets its pin and a broken site never holds up scores. Remove the finder (`server/.../WatchLinks/StreamFinder*.cs`, `Game.StreamLinks`, `web/src/panel/streamLinks.ts` and `UnofficialStreams.tsx`) before any public launch.

## Test

```sh
dotnet test server/ScoreMap.slnx
npm --prefix web test
```

## Deploy

ScoreMap runs on Azure App Service. `dotnet publish` also builds the browser app into the published `wwwroot`, so the server serves the whole app; after a one-time setup, `./scripts/deploy.ps1 -ResourceGroup <group> -AppName <app>` publishes and deploys. See [docs/deploy.md](docs/deploy.md).
