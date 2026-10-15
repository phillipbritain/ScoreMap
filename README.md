# ScoreMap

A globe showing live sports games as pins at their venues, with scores that update on their own. See issue #1 for the v1 spec, `GLOSSARY.md` for domain terms and `docs/adr/` for key decisions.

## Layout

- `server/` — C# ASP.NET Core server (`ScoreMap.slnx`)
  - `src/ScoreMap.Server/` — the server: game feed provider (`GameFeed/`), game board (`Games/`), poller (`Live/`), SignalR hub (`Hubs/`), venue locator and photos (`Venues/`), watch and stream links (`WatchLinks/`), scenarios for local runs and demos (`Scenarios/`)
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

The install script puts `aspire.exe` on the PATH, which every shell finds. `dotnet tool install -g Aspire.Cli` works too, but installs it as `aspire.cmd`, which Git Bash can't run as `aspire`: there, run it as `aspire.cmd`.

Then, from the repo root:

```sh
aspire start      # the server and the browser app (Vite), in the background
aspire wait web   # until the browser app answers
aspire describe   # the URLs of each; open the web one
aspire stop       # when you're done
```

`aspire start` also prints the Aspire dashboard's URL, which shows both with their logs. The Vite dev server proxies `/hubs` (SignalR) and `/api` to the server, at the URL Aspire passes it.

Run locally, the app shows a scenario rather than real games. The `run-scoremap` skill (`.claude/skills/run-scoremap/SKILL.md`) covers the scenarios and their controls, several runs side by side, and driving a browser on the app.

## Configuration

Leagues, polling, venue lookups and corrections, scenario venues and teams, and watch and stream links: see [docs/configuration.md](docs/configuration.md).

Which cities the globe names, and the settings for it: see [docs/city-labels.md](docs/city-labels.md).

What ESPN gives for a game, what ScoreMap reads and what's there to add later: see [docs/espn-data.md](docs/espn-data.md).

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
