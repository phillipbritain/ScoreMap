# Deploying ScoreMap to Azure App Service

ScoreMap runs as one ASP.NET Core app on Azure App Service (Linux). The app serves the browser app and the SignalR hub (`/hubs/games`) from the same address, so the browser connects to the hub through a relative URL and needs no extra setup.

`dotnet publish` builds the browser app with Vite and puts it in the published `wwwroot`, so the publish folder holds the whole app. `scripts/deploy.ps1` publishes, zips and deploys in one step.

## Choosing a plan

|                       | Free F1                                      | Basic B1                     |
| --------------------- | -------------------------------------------- | ---------------------------- |
| Cost                  | free                                         | paid, billed hourly          |
| Sleeps when idle      | yes, after about 20 minutes with no requests | no (Always On)               |
| CPU                   | **60 minutes a day**                         | unlimited                    |
| WebSocket connections | **5**                                        | plenty                       |
| Address               | `https://<app-name>.azurewebsites.net`       | can also use a custom domain |

F1 suits ScoreMap. The server only polls ESPN while a browser is connected, so a host that sleeps when idle costs nothing in missed updates. Watch the daily CPU limit: polling every 15 seconds during a busy evening of live games uses some of it. If the app hits the limit it stops until the next day, and moving up to B1 fixes that. A browser beyond the fifth WebSocket falls back to Server-Sent Events or long polling and still works.

## One-time setup

You need the Azure CLI (`winget install Microsoft.AzureCLI`) and an Azure subscription. Pick an app name, which must be unique across Azure because it becomes `<app-name>.azurewebsites.net`. Run these in PowerShell:

```powershell
$rg = 'scoremap-rg'
$app = 'scoremap'          # must be unique across Azure
$location = 'centralus'    # any region near you; `az account list-locations -o table`

az login

az group create --name $rg --location $location
az appservice plan create --resource-group $rg --name scoremap-plan --is-linux --sku F1

# Check the runtime string first with: az webapp list-runtimes --os linux
az webapp create --resource-group $rg --plan scoremap-plan --name $app --runtime 'DOTNETCORE:10.0'

# SignalR: turn WebSockets on, and keep ARR affinity (sticky sessions) on so a browser's
# requests always reach the instance that holds its connection if the app ever runs on more than one.
az webapp config set --resource-group $rg --name $app --web-sockets-enabled true --startup-file 'dotnet ScoreMap.Server.dll'
az webapp update --resource-group $rg --name $app --client-affinity-enabled true --https-only true

# App settings. The deploy uploads an already-built app, so App Service must not build it again.
az webapp config appsettings set --resource-group $rg --name $app --settings SCM_DO_BUILD_DURING_DEPLOYMENT=false
```

### App settings

App settings reach the server as environment variables, and `__` separates configuration sections. None are required. These are the ones you are most likely to want:

| Setting                      | Default                                                                                               | Purpose                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Venues__SavedLocationsPath` | `data/venue-locations.json`, resolved under `HOME` on App Service (`/home/data/venue-locations.json`) | Where venue lookups are saved. `/home` is the only storage that is writable and survives restarts and redeploys. |
| `Nominatim__BaseUrl`         | `https://nominatim.openstreetmap.org/`                                                                | Place search used to locate venues.                                                                              |
| `Espn__BaseUrl`              | ESPN's scoreboard API                                                                                 | Game feed.                                                                                                       |

The venue corrections file (`venue-corrections.json`) ships with the app. To change a correction, edit the file in the repo and redeploy.

## Deploy

From the repo root, after `az login`:

```powershell
./scripts/deploy.ps1 -ResourceGroup scoremap-rg -AppName scoremap
```

The script runs `dotnet publish` (building the browser app into `wwwroot`), zips the result with forward-slash paths (`Compress-Archive` in Windows PowerShell writes backslashes, which break on Linux), and runs `az webapp deploy --type zip`. Then open `https://scoremap.azurewebsites.net` on your phone.

To deploy by hand instead:

```powershell
dotnet publish server/src/ScoreMap.Server -c Release -o publish
# zip the *contents* of publish/ (not the folder itself), with forward-slash paths
tar.exe -a -c -f publish.zip -C publish (Get-ChildItem publish | ForEach-Object Name)
az webapp deploy --resource-group scoremap-rg --name scoremap --src-path publish.zip --type zip
```

## Checking it works

- Open the site and wait for pins to appear. During live games, scores should change on their own.
- Stream the server log with `az webapp log tail --resource-group scoremap-rg --name scoremap`. For more detail, first run `az webapp log config --resource-group scoremap-rg --name scoremap --docker-container-logging filesystem`.
- To check that the app recovers from sleep, leave it idle for more than 20 minutes and open it again. The first request starts the app, which takes a few seconds. The browser connects, gets a freshly fetched snapshot, and polling resumes. A browser that stayed open while the app slept reconnects on its own, retrying with backoff up to every 30 seconds, and catches up the same way.

## Deploy from GitHub Actions

`.github/workflows/deploy.yml` runs the tests, publishes and deploys on every push to `main`. To deploy by hand, use Actions → deploy → Run workflow, or `gh workflow run deploy`. It skips itself until it is set up. Only runs on `main` can sign in to Azure.

GitHub signs in to Azure as a user-assigned managed identity, with no password stored anywhere. A federated credential tells Azure to trust GitHub's sign-in tokens for this repo's `main` branch, and the identity may only deploy to this one app (Website Contributor on the app). One-time setup, after `az login` and `gh auth login`:

```powershell
$rg = 'scoremap-rg'
$app = 'scoremap'
$repo = 'phillipbritain/ScoreMap'

az identity create --resource-group $rg --name scoremap-github

# GitHub's token subject names the owner and repo with their IDs, which can't be reused if the repo
# is renamed. Get it from: gh api repos/$repo --jq '"repo:\(.owner.login)@\(.owner.id)/\(.name)@\(.id)"'
$subject = 'repo:phillipbritain@35792740/ScoreMap@1403601772:ref:refs/heads/main'
az identity federated-credential create --resource-group $rg --identity-name scoremap-github --name github-main `
  --issuer https://token.actions.githubusercontent.com --subject $subject --audiences api://AzureADTokenExchange

$principalId = az identity show --resource-group $rg --name scoremap-github --query principalId -o tsv
$appId = az webapp show --resource-group $rg --name $app --query id -o tsv
az role assignment create --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
  --role 'Website Contributor' --scope $appId

gh secret set AZURE_CLIENT_ID -R $repo -b (az identity show --resource-group $rg --name scoremap-github --query clientId -o tsv)
gh secret set AZURE_TENANT_ID -R $repo -b (az account show --query tenantId -o tsv)
gh secret set AZURE_SUBSCRIPTION_ID -R $repo -b (az account show --query id -o tsv)
gh variable set AZURE_WEBAPP_NAME -R $repo -b $app
```

## If it doesn't work

- **Blank page or 404 at `/`**: the deploy has no `wwwroot`. Use `scripts/deploy.ps1` or `dotnet publish` without `-p:SkipBrowserApp=true`, and make sure Node.js is installed where you publish.
- **App won't start**: check the startup command (`dotnet ScoreMap.Server.dll`) and the runtime (`az webapp config show --resource-group scoremap-rg --name scoremap --query linuxFxVersion`).
- **Live updates never arrive**: make sure WebSockets are on (`az webapp config show ... --query webSocketsEnabled`). SignalR should fall back to other transports anyway, so check the browser console for connection errors.
- **GitHub deploy fails at Azure login with `AADSTS700213`**: the federated credential's subject doesn't match the token. The error shows the subject GitHub sent; update the credential with `az identity federated-credential update` and the same arguments as above. A run from a branch other than `main` always fails here, by design.
- **App stops for the rest of the day**: the F1 daily CPU limit was hit. Scale up with `az appservice plan update --resource-group scoremap-rg --name scoremap-plan --sku B1`.
