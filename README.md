# ScoreMap

A globe showing live sports games as pins at their venues, with scores that update on their own. See issue #1 for the v1 spec, `GLOSSARY.md` for domain terms and `docs/adr/` for key decisions.

## Layout

- `server/` — C# ASP.NET Core server (`ScoreMap.slnx`)
  - `src/ScoreMap.Server/` — the server: game feed provider (`GameFeed/`), game board (`Games/`), poller (`Live/`), SignalR hub (`Hubs/`), venue locator and photos (`Venues/`), watch and stream links (`WatchLinks/`), scenarios for local runs (`Scenarios/`)
  - `src/ScoreMap.AppHost/` and `src/ScoreMap.ServiceDefaults/` — Aspire, for running locally (ADR-0013)
  - `tests/ScoreMap.Server.Tests/` — server seam tests: the real server with fake provider and clock
- `web/` — React + TypeScript browser app built with Vite, MapLibre globe, Vitest unit tests

## Prerequisites

- .NET SDK 10
- Node.js 24
- The Aspire CLI, to run locally

## Run locally

ScoreMap runs locally through .NET Aspire (ADR-0013). Once per machine, install the [Aspire CLI](https://aspire.dev/get-started/install-cli/) with its install script, then (in a new terminal, for the PATH) trust the development certificate:

```powershell
irm https://aspire.dev/install.ps1 | iex   # Windows PowerShell; elsewhere: curl -sSL https://aspire.dev/install.sh | bash
aspire certs trust
```

The install script puts `aspire.exe` on the PATH, which every shell finds. `dotnet tool install -g Aspire.Cli` works too, but installs it as `aspire.cmd`, which Git Bash can't run as `aspire`.

Then, from the repo root:

```sh
aspire start      # the server and the browser app (Vite), in the background
aspire wait web   # until the browser app answers
aspire describe   # the URLs of each; open the web one
aspire stop       # when you're done
```

`aspire start` also prints the Aspire dashboard's URL, which shows both with their logs. The Vite dev server proxies `/hubs` (SignalR) and `/api` to the server, at the URL Aspire passes it.

Each clone or git worktree runs once, and several can run side by side: start the first with `aspire start` and any other with `aspire start --isolated`, which gives it random ports. `aspire ps` lists every run on the machine and `aspire stop --all` stops them all. Starting a clone again stops its run first.

Run locally, the app shows a **scenario** (made-up games at real venues, ADR-0009) rather than real games: `worldwide` at the start, set by `Scenario` in `appsettings.Development.json`. A scenario's games run on a scenario clock at a speed: Paused, Normal (real time), Fast (2×) or Faster (8×), starting at `ScenarioSpeed`. At the bottom left of the globe, a pill switches the scenario (or to real ESPN games) and media keys (Pause, Play, Fast-forward) set the speed while it runs, for every open tab, with the scenario clock beside them (both hidden where the speed changes nothing: real games, and scenarios whose games stand still); Shift+S hides them. `PUT /api/scenarios/running` (`{"name": "crowded"}`) and `PUT /api/scenarios/speed` (`{"speed": "Faster"}`) do the same from a script. Scenario files are in `server/src/ScoreMap.Server/Scenarios/Files/`.

The server reads each league's games from ESPN's scoreboards for yesterday and today (and, within 3 hours of midnight, tomorrow), in US Eastern days as ESPN keeps them, and looks each venue up once through OpenStreetMap Nominatim, saving the results to `server/src/ScoreMap.Server/data/venue-locations.json` (git-ignored; delete it to look venues up again). It also finds each venue's photo once, for the game panel: ESPN's own, or else the venue's Wikidata image from Wikimedia Commons with its author and licence. These are saved to `server/src/ScoreMap.Server/data/venue-photos.json` (also git-ignored; delete it to search again).

Venue lookups can be wrong (e.g. a stadium placed in a same-named town). To fix a pin, add the venue's name and the right position to `server/src/ScoreMap.Server/venue-corrections.json`, for example `"Lincoln Financial Field": { "latitude": 39.9008, "longitude": -75.1675 }`. Corrections override any lookup and take effect from the next poll, without a restart. When a venue can't be found, its pin goes to the centre of its city; when a game has no venue, to the home team's city.

Scenarios (ADR-0009) put their games at the real venues listed in `server/src/ScoreMap.Server/scenario-venues.json`, each with the groups it belongs to (`worldwide`, `big-cities`, `london`, `london-and-nearby`, `new-york`, `los-angeles`). Every venue is in `worldwide` except some only there for `big-cities` or `london-and-nearby`, which would otherwise crowd the worldwide scenarios. A filled game's teams come from `scenario-teams.json` beside it, which lists each configured league's real teams (so NFL teams only play NFL teams), and no team is in two games at once; run `dotnet run scripts/update-scenario-teams.cs` to rebuild it from ESPN after adding a league to the configuration or when a league's teams change, and check it in. A game written out in a scenario file must be at a venue in this list (by name and city), or else be marked `"notInVenueList": true` as made up on purpose; anything else stops startup. Their positions are checked in as `scenario-venue-locations.json` beside it, which the server uses before its saved lookups, so scenario venues never wait on Nominatim. After changing the venue list, run `dotnet run scripts/lookup-scenario-venues.cs` to look up the new venues (it lists any it can't find), and check both files in.

The leagues shown are listed under `Leagues` in `appsettings.json`. Each has a `Key` (ESPN's `{sport}/{league}`, optionally with scoreboard options after a `?`), a display `Name`, its `Sport` (`"Football"`, `"Basketball"`, `"Baseball"`, `"Hockey"` or `"Soccer"`; anything else stops the server at startup), and optionally `RegulationPeriods` when it plays a different number of periods from its sport's usual (2 halves in men's college basketball), and `PeriodMinutes` when its periods run a different length on the game clock (20-minute halves in men's college basketball, 10-minute quarters in women's basketball; only scenarios use it). `PlannedLength` (a time span such as `"03:15:00"`, default 3 hours) is how long the league's games usually take from start to finish. ESPN gives no end times, so the server uses it to estimate when a game ended when it first sees the game already Final (for instance after sleeping), and to keep a postponed or canceled game's pin until 2 hours after its planned end (ADR-0005).

While at least one browser is connected, the server polls each league about every 15 seconds while it has Live games and every 3 minutes otherwise, and pushes change events to browsers over SignalR. With no browser connected it doesn't poll at all; the next browser to connect gets a freshly fetched snapshot, as does a browser reconnecting after a dropped connection.

The game panel links each channel or streaming service to its official watch page when it is listed in `server/src/ScoreMap.Server/watch-links.json`, for example `{ "names": ["Peacock"], "url": "https://www.peacocktv.com/" }` (names match ESPN's spelling, ignoring case). Unlisted services show as plain names. Edits take effect without a restart. When the feed lists broadcasts for the viewer's country (taken from the browser's language settings), broadcasts it marks for other countries are hidden; otherwise every channel is listed.

The game panel can also show unofficial stream links (hobby v1 only, ADR-0002). The stream finder searches the sites listed under `StreamFinder:Sites` in `appsettings.json` (or user secrets/environment settings); the list ships empty, which switches the finder off. Each site is `{ "Name": "...", "SearchUrl": "https://.../search?q={query}", "LinkPattern": "<regex with a named group href, and optionally text>" }`: `{query}` becomes both teams' names (`{away}` and `{home}` one each), and a found link is kept only when its text or address mentions both teams' nicknames. Each Upcoming or Live game is searched in the background with a short timeout per site (`TimeoutSeconds`, default 3) and the result is cached (`CacheMinutes`, default 10), so links appear a poll or so after a game gets its pin and a broken site never holds up scores. The finder sits behind `IStreamLinkSource`; before any public launch remove it by deleting `server/src/ScoreMap.Server/WatchLinks/StreamFinder*.cs` and the `AddStreamFinder` line in `Program.cs`, after which a no-op source gives every game no stream links (optionally also drop `Game.StreamLinks`, `web/src/panel/streamLinks.ts` and its line in `GamePanel.tsx`).

## Test

```sh
dotnet test server/ScoreMap.slnx
npm --prefix web run lint
npx --prefix web tsc -b web
npm --prefix web test               # unit tests, in Node
npm --prefix web run test:browser   # the globe map's tests, in headless Chromium (ADR-0008)
```

CI (`.github/workflows/ci.yml`) runs all of these on every pull request.

## Deploy

ScoreMap runs on Azure App Service. `dotnet publish` also builds the browser app into the published `wwwroot`, so the server serves the whole app. After a one-time setup, `.github/workflows/deploy.yml` tests, publishes and deploys on every push to `main`; `./scripts/deploy.ps1 -ResourceGroup <group> -AppName <app>` deploys by hand. See [docs/deploy.md](docs/deploy.md).
