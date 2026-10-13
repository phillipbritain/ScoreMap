# Configuration

How the server finds games and venues, and the files and settings that shape them. Files named here are under `server/src/ScoreMap.Server/`, and commands run from the repo root.

## Leagues

The leagues shown are listed under `Leagues` in `appsettings.json`. Each has a `Key` (ESPN's `{sport}/{league}`, optionally with scoreboard options after a `?`), a display `Name`, its `Sport` (`"Football"`, `"Basketball"`, `"Baseball"`, `"Hockey"` or `"Soccer"`; anything else stops the server at startup), and optionally `RegulationPeriods` when it plays a different number of periods from its sport's usual (2 halves in men's college basketball), and `PeriodMinutes` when its periods run a different length on the game clock (20-minute halves in men's college basketball, 10-minute quarters in women's basketball; only scenarios use it). `PlannedLength` (a time span such as `"03:15:00"`, default 3 hours) is how long the league's games usually take from start to finish. ESPN gives no end times, so the server uses it to estimate when a game ended when it first sees the game already Final (for instance after sleeping), and to keep a postponed or canceled game's pin until 2 hours after its planned end (ADR-0005).

## Polling

The server reads each league's games from ESPN's scoreboards for yesterday and today (and, within 3 hours of midnight, tomorrow), in US Eastern days as ESPN keeps them.

While at least one browser is connected, the server polls each league about every 15 seconds while it has Live games and every 3 minutes otherwise, and pushes change events to browsers over SignalR. With no browser connected it doesn't poll at all; the next browser to connect gets a freshly fetched snapshot, as does a browser reconnecting after a dropped connection.

## Venues

The server looks each venue up once through OpenStreetMap Nominatim, saving the results to `data/venue-locations.json` (git-ignored; delete it to look venues up again). It also finds each venue's photo once, for the game panel: ESPN's own, or else the venue's Wikidata image from Wikimedia Commons with its author and licence. These are saved to `data/venue-photos.json` (also git-ignored; delete it to search again). Each clone or worktree has its own `data/`.

Venue lookups can be wrong (e.g. a stadium placed in a same-named town). To fix a pin, add the venue's name and the right position to `venue-corrections.json`, for example `"Lincoln Financial Field": { "latitude": 39.9008, "longitude": -75.1675 }`. Corrections override any lookup and take effect from the next poll, without a restart. When a venue can't be found, its pin goes to the centre of its city; when a game has no venue, to the home team's city.

## Scenario venues and teams

Scenarios (ADR-0009) put their games at the real venues listed in `scenario-venues.json`, each with the groups it belongs to (`worldwide`, `big-cities`, `london`, `london-and-nearby`, `new-york`, `los-angeles`). Every venue is in `worldwide` except some only there for `big-cities` or `london-and-nearby`, which would otherwise crowd the worldwide scenarios. A filled game's teams come from `scenario-teams.json` beside it, which lists each configured league's real teams (so NFL teams only play NFL teams), and no team is in two games at once; run `dotnet run scripts/update-scenario-teams.cs` to rebuild it from ESPN after adding a league to the configuration or when a league's teams change, and check it in.

A game written out in a scenario file must be at a venue in this list (by name and city), or else be marked `"notInVenueList": true` as made up on purpose; anything else stops startup. Their positions are checked in as `scenario-venue-locations.json` beside it, which the server uses before its saved lookups, so scenario venues never wait on Nominatim. After changing the venue list, run `dotnet run scripts/lookup-scenario-venues.cs` to look up the new venues (it lists any it can't find), and check both files in.

## Watch links

The game panel links each channel or streaming service to its official watch page when it is listed in `watch-links.json`, for example `{ "names": ["Peacock"], "url": "https://www.peacocktv.com/" }` (names match ESPN's spelling, ignoring case). Unlisted services show as plain names. Edits take effect without a restart. When the feed lists broadcasts for the viewer's country (taken from the browser's language settings), broadcasts it marks for other countries are hidden; otherwise every channel is listed.

## Stream links

The game panel can also show unofficial stream links (hobby v1 only, ADR-0002). The stream finder searches the sites listed under `StreamFinder:Sites` in `appsettings.json` (or user secrets/environment settings); the list ships empty, which switches the finder off. Each site is `{ "Name": "...", "SearchUrl": "https://.../search?q={query}", "LinkPattern": "<regex with a named group href, and optionally text>" }`: `{query}` becomes both teams' names (`{away}` and `{home}` one each), and a found link is kept only when its text or address mentions both teams' nicknames. Each Upcoming or Live game is searched in the background with a short timeout per site (`TimeoutSeconds`, default 3) and the result is cached (`CacheMinutes`, default 10), so links appear a poll or so after a game gets its pin and a broken site never holds up scores.

The finder sits behind `IStreamLinkSource`; before any public launch remove it by deleting `WatchLinks/StreamFinder*.cs` and the `AddStreamFinder` line in `Program.cs`, after which a no-op source gives every game no stream links (optionally also drop `Game.StreamLinks`, `web/src/panel/streamLinks.ts` and its line in `GamePanel.tsx`).
