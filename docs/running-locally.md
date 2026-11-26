# Running ScoreMap locally

Setup and the basic commands are in the README's "Run locally". This covers a run once it's set up: finding the one that's going, fixing a broken one, running several clones, and stopping. The scenarios a run shows are in [scenarios.md](scenarios.md), and driving a browser on it in [browser-automation.md](browser-automation.md).

A **run** is the server and Vite together, from one clone or git worktree (ADR-0013). Changes under `web/` show in a run straight away through Vite.

## Use the run that's there

Often a run is already going. Commands run from PowerShell or bash; where the two differ, both are given:

1. `aspire ps` lists every run on the machine, with its AppHost path (so its clone). When it lists this clone's AppHost, **use that run**. It may be someone's own `aspire run`, which restarts its AppHost itself when stopped, so a `start` over it only fights it for locked build files. When it lists none at all, start one (see [Starting a run](#starting-a-run)). When it lists only another clone's run, see "One run at a time" under [Starting a run](#starting-a-run).
2. Read its URLs. Give `--apphost` the full path, as `describe` and `wait` may not find the run from the directory alone:

   ```powershell
   $apphost = "$(git rev-parse --show-toplevel)/server/src/ScoreMap.AppHost/ScoreMap.AppHost.csproj"
   $run = (aspire describe --apphost $apphost --format json | ConvertFrom-Json).resources
   $web = ($run | ? displayName -eq web).urls[0].url
   $server = ($run | ? displayName -eq server).urls | ? name -eq http | % url
   ```

   ```bash
   apphost="$(git rev-parse --show-toplevel)/server/src/ScoreMap.AppHost/ScoreMap.AppHost.csproj"
   run=$(aspire describe --apphost "$apphost" --format json)
   web=$(jq -r '.resources[] | select(.displayName=="web") | .urls[0].url' <<<"$run")
   server=$(jq -r '.resources[] | select(.displayName=="server") | .urls[] | select(.name=="http") | .url' <<<"$run")
   ```

   `jq` comes with macOS 15 and later; `command -v jq` checks for it.

3. Drive it in a browser ([browser automation](browser-automation.md)), starting with `npm run page -- reset $web`.

**Logs** are in the run's dashboard (`aspire ps` gives its URL, with its login token), or `aspire logs server` and `aspire logs web` (`-f` to follow).

**A white page** after renaming or deleting a file under `web/src`: Vite may hold a stale import, unseen by `console` and `errors`. Restart it with `aspire resource web restart --apphost $apphost`.

**Vite failing to resolve a dependency** that is on disk (seen: `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url` from `src/globe/globeMap.ts`): `npm ci` or `npm install` ran in a worktree while its run was going, emptying `node_modules` under Vite, which keeps failing once the files are back. Restart it with `aspire resource web restart --apphost $apphost`.

**Server `Finished` with "address already in use"** in `aspire logs server` (and `npm run page -- ready` timing out): a server left over from an earlier watch restart, often one that crashed on a half-made change, holds the port. Stop it (`Get-Process ScoreMap.Server | Stop-Process`; bash: `pkill -f "$(git rev-parse --show-toplevel)/server/src/ScoreMap.Server/bin/"`, which stops only this clone's), then `aspire resource server restart --apphost $apphost`.

## Starting a run

When no run is going for this clone. Setup and the basic commands (`aspire start`, `aspire wait web`, `aspire describe`, `aspire stop`) are in the README's "Run locally"; run them from the repo root (or the worktree's root), and wait for `web` before using the run.

- **An agent checking its own change in its own workspace** starts `aspire start --isolated` there (random ports), reads its URLs as in [Use the run that's there](#use-the-run-thats-there), and stops it with `aspire stop` before handing back. The default ports stay free for a person's own run.
- **One run at a time, on the same ports**, for everything else. A plain `aspire start` puts the app at http://localhost:5173 and the server at http://localhost:5147 every time; keep to one run on the machine so it stays there. To run another clone or worktree, stop the run going (`aspire stop` from its root) and start a plain one in the other. Ask before stopping a run you didn't start, and before ever starting a second run alongside one (`aspire start --isolated`, on random ports, read as above). One clone or worktree has one run: starting it again stops the one going and starts afresh. `scripts/review-run.sh` says which clone holds 5173/5147, at what commit, and flags an orphan run whose folder was removed (it serves 404s and can't be stopped by path).
- **First time on a machine:** set up as the README says. Trusting the development certificate is a Windows prompt a person must accept, so an agent asks you to run `aspire certs trust` yourself. Untrusted, the server shows Unhealthy and `web` waits for it forever.
- **Start it from a shell clear of `NODE_USE_SYSTEM_CA`** (`Remove-Item Env:NODE_USE_SYSTEM_CA -ErrorAction SilentlyContinue` first, in the same PowerShell call; bash: `unset NODE_USE_SYSTEM_CA`, in the same call). An agent's shell can have it set where yours doesn't (it isn't a Windows user or machine variable), the run hands it on to Vite, and with it Node ignores the certificate Aspire gives it (`NODE_EXTRA_CA_CERTS`). The run then looks healthy, but every `/api` and `/hubs` request through `web` is a 502, and `aspire logs web` says `self-signed certificate`.
- **A run watches the server** (`features.defaultWatchEnabled` in `aspire.config.json`): a saved change under `server/` restarts it within seconds, with no `aspire start`. The restart puts it back on `worldwide` at Normal, so switch the scenario and speed again after each change. Not every change restarts it: when `running` (`curl "$server/api/scenarios"`) hasn't gone back to `worldwide`, restart it with `aspire resource server restart --apphost $apphost`. `dotnet build` and `dotnet test` work alongside a run with `-c Release`: the run holds the Debug build's files, so a Debug build fails to copy over them after a server change.

## Stopping a run

Stop a run you started with `aspire stop` from its root; done means `aspire ps` no longer lists it. **Stop it before its worktree is removed**: with the folder gone, neither `aspire stop` nor `--apphost` can find the run.

An **orphaned run** (still in `aspire ps`, its folder gone) takes `aspire stop --all`, which stops every run on the machine, yours included: use it only once `aspire ps` shows the orphan is the only run, and ask first otherwise. Its watched server (`dotnet run` and `ScoreMap.Server`) can outlive it and keep its ports (5147 and 5173 for a plain run). Find what still listens on each with `lsof -nP -iTCP:<port> -sTCP:LISTEN` (PowerShell: `Get-NetTCPConnection -LocalPort <port> -State Listen`, its `OwningProcess`) and stop it; done means nothing listens there.

## Saved data

To look venues up afresh, `aspire stop`, delete the saved lookup (which file: `docs/configuration.md`, "Venues"), and `aspire start` again.
