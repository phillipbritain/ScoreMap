# Deploying ScoreMap to Azure Container Apps

ScoreMap runs as one container on Azure Container Apps (ADR-0024), with exactly one replica always running: never zero, so a visitor never waits for a cold start, and never two, because the poller and game cache live in memory. The server serves the browser app and the SignalR hub (`/hubs/games`) from the same address, so the browser connects to the hub through a relative URL and needs no extra setup.

The `Dockerfile` at the repo root builds the browser app with Vite and the server with `dotnet publish`, into one image on `mcr.microsoft.com/dotnet/aspnet:11.0`. GitHub Actions builds it on every push to `main`, pushes it to GitHub Container Registry as `ghcr.io/phillipbritain/scoremap:<commit>`, and deploys it as a new revision. The repo is public, and so is the image, so Container Apps pulls it with no registry password.

## What it runs on

Everything is in `infra/main.bicep`, in the resource group `scoremap-eastus2-rg` in East US 2:

- **The container app** `scoremap`: external HTTPS ingress (http:// redirects), WebSockets, sticky sessions for SignalR, 0.25 vCPU and 0.5 GiB, minimum and maximum 1 replica. One revision is active at a time: a new revision takes the traffic once it accepts connections, and the old one keeps serving until then.
- **The environment** `scoremap-env`, on the consumption plan: no charge for the environment itself.
- **A file share** (`data`, in a storage account named `scoremap<hash>`) mounted at `/data`, where the venue lookups, venue photos and event venues are saved (`Venues__Saved*Path`), so they survive a new revision.
- **A Log Analytics workspace** `scoremap-logs`, holding the app's logs for 30 days, capped at 0.15 GB a day to stay within the free 5 GB a month.
- **The identity GitHub Actions deploys as**, `scoremap-github` (see "Deploy from GitHub Actions").

At 0.25 vCPU and 0.5 GiB, one replica always running costs about $4–5 a month, less while it's idle (no requests and almost no CPU), which Container Apps bills at a lower rate. If it struggles on a busy evening, 0.5 vCPU and 1 GiB is about $8–10: set `cpu` and `memory` in `infra/main.bicepparam` and run the template.

## One-time setup

You need the Azure CLI and an Azure subscription. Sign in, register the resource providers the template uses (once per subscription) and create the resource group:

```sh
rg=scoremap-eastus2-rg
az login
for p in Microsoft.App Microsoft.OperationalInsights Microsoft.Storage; do az provider register -n $p --wait; done
az group create --name $rg --location eastus2
```

The template is scoped to the resource group, so a deploy needs rights on that group only. The container app needs an image that already exists, so the first image comes from GitHub Actions: run the deploy workflow on any branch (`gh workflow run deploy --ref <branch>`), which on a branch other than `main` only builds and pushes. The first push creates the package `scoremap` under your GitHub account; make it public under Package settings → Change visibility, or Container Apps can't pull it. Then run the template with that image:

```sh
export SCOREMAP_IMAGE=ghcr.io/phillipbritain/scoremap:<commit>
export SCOREMAP_FEEDBACK_TOKEN=<token>   # optional; leave unset to only log feedback
az deployment group create -g $rg --template-file infra/main.bicep --parameters infra/main.bicepparam
```

The outputs give the app's address (`url`) and the identity's client ID (`githubClientId`).

### Running the template again

Running it again changes nothing unless the template changed, so change settings in the template and run it again, not in the portal: a setting changed in the portal is put back by the next run. Every run replaces the app's settings, secret and image, so pass the image that's running now, and the feedback token if filing is on:

```sh
export SCOREMAP_IMAGE=$(az containerapp show -g $rg -n scoremap --query 'properties.template.containers[0].image' -o tsv)
export SCOREMAP_FEEDBACK_TOKEN=<token>
az deployment group what-if -g $rg --template-file infra/main.bicep --parameters infra/main.bicepparam
az deployment group create -g $rg --template-file infra/main.bicep --parameters infra/main.bicepparam
```

`what-if` previews the changes. It lists the role assignments' `principalId` as changed on every run, because it can't work out the identity's ID before a deploy; that one is harmless.

### App settings

Settings reach the server as environment variables, with `__` separating configuration sections. They are the container's `env` in `infra/main.bicep`: add one there and run the template; one added any other way is removed by the next run. The template sets:

| Setting | Value | Purpose |
| --- | --- | --- |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` | Each visitor's own address from the ingress's `X-Forwarded-For`, for feedback's per-visitor limit. |
| `Venues__SavedLocationsPath` | `/data/venue-locations.json` | Where venue lookups are saved, on the file share. |
| `Venues__SavedPhotosPath` | `/data/venue-photos.json` | Where the venue photos found are saved. |
| `Venues__SavedEventVenuesPath` | `/data/event-venues.json` | Where NASCAR races' and golf tournaments' venues, from ESPN's core API, are saved. |
| `Feedback__GitHubToken` | the secret `feedback-github-token` | The token feedback is filed as issues with, from `SCOREMAP_FEEDBACK_TOKEN`; left out without one, see [configuration.md](configuration.md#feedback). |

The rest (`Espn__BaseUrl`, `Nominatim__BaseUrl` and so on) keep the defaults in `appsettings.json`. The venue corrections file and the IndyCar track list ship in the image: to change one, edit it in the repo and deploy.

## Custom domain

Container Apps issues and renews a free certificate for the domain once its DNS points at the app. With the domain at Cloudflare, every record below must be **DNS only** (grey cloud): through Cloudflare's proxy, Azure can't see the records and won't issue the certificate. Get the values from the template's outputs (`az deployment group show -g $rg -n main --query properties.outputs`):

| Type | Name | Value |
| --- | --- | --- |
| CNAME | the subdomain, such as `www` | `fqdn` (`scoremap.<random>.eastus2.azurecontainerapps.io`) |
| TXT | `asuid.` and the subdomain, such as `asuid.www` | `customDomainVerificationId` |

For an apex domain (`example.com` itself), use an A record to `staticIp` instead of the CNAME, a TXT record named `asuid`, and `customDomainValidation = 'HTTP'`.

Then set `customDomain` in `infra/main.bicepparam` and run the template twice ("Running the template again"): first with `bindCustomDomain=false` added to the run (`--parameters infra/main.bicepparam bindCustomDomain=false`), which adds the domain to the app unbound; then as usual, which issues the certificate (a few minutes) and binds it. From then on every run keeps it.

## Deploy from GitHub Actions

`.github/workflows/deploy.yml` builds and pushes the image on every push to `main`, then deploys it as a new revision and waits: the run fails unless the new revision reports Running and Healthy, takes the traffic, and answers `/api/leagues`, within 10 minutes. A revision that doesn't start leaves the old one serving. To deploy by hand, use Actions → deploy → Run workflow, or `gh workflow run deploy`. Only runs on `main` can sign in to Azure; on another branch the workflow only builds and pushes.

GitHub signs in to Azure as the user-assigned managed identity `scoremap-github`, with no password stored anywhere. A federated credential tells Azure to trust GitHub's sign-in tokens for this repo's `main` branch. The identity can deploy a new revision of this one app and nothing else: Container Apps Contributor on the app, and Container Apps Operator on the environment (read it, and place a revision in it). The template creates all three. The trusted token is set by `githubSubject` in `infra/main.bicepparam`. It names the owner and repo with their IDs, which can't be reused if the repo is renamed. For another repo, get it from `gh api repos/<owner>/<repo> --jq '"repo:\(.owner.login)@\(.owner.id)/\(.name)@\(.id)"'` and add `:ref:refs/heads/main`.

Then tell GitHub which identity, tenant, subscription and app to use, once, after the template has run:

```sh
repo=phillipbritain/ScoreMap
gh secret set AZURE_CLIENT_ID -R $repo -b "$(az identity show -g $rg -n scoremap-github --query clientId -o tsv)"
gh secret set AZURE_TENANT_ID -R $repo -b "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID -R $repo -b "$(az account show --query id -o tsv)"
gh variable set AZURE_RESOURCE_GROUP -R $repo -b $rg
gh variable set AZURE_CONTAINERAPP_NAME -R $repo -b scoremap
```

The identity keeps its client ID when the template runs again. Deleting it and creating it again gives it a new one, and `AZURE_CLIENT_ID` then needs setting again.

## Checking it works

- Open the site and wait for pins to appear. During live games, scores should change on their own.
- The app's log: `az containerapp logs show -g $rg -n scoremap --follow`; Container Apps' own (pulling the image, starting, probes) with `--type system`.
- The revisions and which one takes the traffic: `az containerapp revision list -g $rg -n scoremap -o table`.
- CPU and memory over time, for whether 0.25 vCPU keeps up: the app's Metrics in the portal (CPU Usage, Memory Working Set Bytes), or `az monitor metrics list --resource $(az containerapp show -g $rg -n scoremap --query id -o tsv) --metric UsageNanoCores --interval PT5M`.
- To build and run the image locally: `docker build --build-arg COMMIT=$(git rev-parse HEAD) -t scoremap . && docker run --rm -p 8080:8080 scoremap`, then open http://localhost:8080. Without `/data` mounted, venue lookups are only kept in memory.

## If it doesn't work

- **The deploy run fails waiting for the revision**: the run prints Container Apps' system log for it. A crash on start shows in the app's log for that revision: `az containerapp logs show -g $rg -n scoremap --revision <name>`.
- **The revision can't pull the image**: the package isn't public (see "One-time setup").
- **GitHub deploy fails at Azure login with `AADSTS700213`**: the federated credential's subject doesn't match the token. The error shows the subject GitHub sent; fix `githubSubject` in `infra/main.bicepparam` and run the template again. A run from a branch other than `main` never gets to the login, by design.
- **The certificate isn't issued**: check the CNAME (or A) and TXT records with `dig`, and that they're DNS only in Cloudflare.
- **Venue lookups are lost on a new revision**: check the share is mounted (`az containerapp show -g $rg -n scoremap --query properties.template.volumes`) and look for "saving failed" warnings in the app's log.
