# Deploying ScoreMap to Azure Container Apps

ScoreMap runs as one container on Azure Container Apps (ADR-0024), with exactly one replica always running: never zero, so a visitor never waits for a cold start, and never two, because the poller and game cache live in memory. The server serves the browser app and the SignalR hub (`/hubs/games`) from the same address, so the browser connects to the hub through a relative URL and needs no extra setup.

The `Dockerfile` at the repo root builds the browser app with Vite and the server with `dotnet publish`, into one image on `mcr.microsoft.com/dotnet/aspnet:11.0`. GitHub Actions builds it on every push to `main`, pushes it to GitHub Container Registry as `ghcr.io/phillipbritain/scoremap:<commit>`, and deploys it as a new revision. The repo is public, and so is the image, so Container Apps pulls it with no registry password.

## What it runs on

The application infrastructure is managed in [Terraform](terraform.md), in the resource group `scoremap-rg` in East US 2:

- **The container app** `scoremap`: external HTTPS ingress (http:// redirects), WebSockets, sticky sessions for SignalR, 0.25 vCPU and 0.5 GiB, minimum and maximum 1 replica. One revision is active at a time: a new revision takes the traffic once it accepts connections, and the old one keeps serving until then.
- **The environment** `scoremap-env`, on the consumption plan: no charge for the environment itself.
- **A file share** (`data`, in a storage account named `scoremap<hash>`) mounted at `/data`, where the venue lookups, venue photos and event venues are saved (`Venues__Saved*Path`), so they survive a new revision.
- **A Log Analytics workspace** `scoremap-logs`, holding the app's logs for 30 days, capped at 0.15 GB a day to stay within the free 5 GB a month.
- **The identity GitHub Actions deploys as**, `scoremap-github` (see "Deploy from GitHub Actions").
- **A Key Vault for feedback**, with a separate managed identity that lets Container Apps read the GitHub token. The app's deployment identity has no Key Vault role.

The replica currently uses 0.25 vCPU and 0.5 GiB. To increase both together, edit the container's `resources` in `infra/terraform/app.tf` and follow the [Terraform change procedure](terraform.md#changing-infrastructure).

## Feedback vault

The operator uses **Key Vault Secrets Officer** on the feedback vault. To rotate the [fine-grained GitHub token](configuration.md#feedback), open **Objects → Secrets** in the Azure portal and add a version of `feedback-github-token`. Container Apps checks the versionless reference and restarts the active revision to pick up the new value, normally within 30 minutes. Coordinate a Feedback form submission before revoking the old token, since the submission creates a public issue.

## App settings

Settings reach the server as environment variables, with `__` separating configuration sections. Edit the container's `env` in `infra/terraform/app.tf` to change them.

| Setting | Value | Purpose |
| --- | --- | --- |
| `ASPNETCORE_FORWARDEDHEADERS_ENABLED` | `true` | Each visitor's own address from the ingress's `X-Forwarded-For`, for feedback's per-visitor limit. |
| `Venues__SavedLocationsPath` | `/data/venue-locations.json` | Where venue lookups are saved, on the file share. |
| `Venues__SavedPhotosPath` | `/data/venue-photos.json` | Where the venue photos found are saved. |
| `Venues__SavedEventVenuesPath` | `/data/event-venues.json` | Where NASCAR races' and golf tournaments' venues, from ESPN's core API, are saved. |
| `Feedback__GitHubToken` | the Container Apps secret reference `feedback-github-token-kv` | The token Container Apps reads from Key Vault. |

The rest (`Espn__BaseUrl`, `Nominatim__BaseUrl` and so on) keep the defaults in `appsettings.json`. The venue corrections file and the IndyCar track list ship in the image: to change one, edit it in the repo and deploy.

## Custom domain

ScoreMap uses the Azure hostname. Adding a domain would require a Terraform change for the ingress binding and managed certificate, plus DNS verification. Container Apps issues and renews the certificate after [domain validation](https://learn.microsoft.com/en-us/azure/container-apps/custom-domains-managed-certificates).

## Deploy from GitHub Actions

`.github/workflows/deploy.yml` builds and pushes the image on every push to `main`, then deploys it as a new revision and waits: the run fails unless the new revision reports Running and Healthy, takes the traffic, and answers `/api/leagues`, within 10 minutes. A revision that doesn't start leaves the old one serving. To deploy by hand, use Actions → deploy → Run workflow, or `gh workflow run deploy`. Only runs on `main` can sign in to Azure; on another branch the workflow only builds and pushes.

GitHub signs in to Azure as the user-assigned managed identity `scoremap-github`. Its federated credential trusts this repo's `main` branch. It has Container Apps Contributor on the app and Container Apps Operator on the environment. Terraform manages these assignments and the `github_subject` in `infra/terraform/production.tfvars`. The workflow changes the image and waits for the new revision to serve traffic.

The following repository settings connect GitHub Actions to production. They are already configured.

```sh
repo=phillipbritain/ScoreMap
rg=scoremap-rg
gh secret set AZURE_CLIENT_ID -R $repo -b "$(az identity show -g $rg -n scoremap-github --query clientId -o tsv)"
gh secret set AZURE_TENANT_ID -R $repo -b "$(az account show --query tenantId -o tsv)"
gh secret set AZURE_SUBSCRIPTION_ID -R $repo -b "$(az account show --query id -o tsv)"
gh variable set AZURE_RESOURCE_GROUP -R $repo -b $rg
gh variable set AZURE_CONTAINERAPP_NAME -R $repo -b scoremap
```

If the identity is ever replaced, update `AZURE_CLIENT_ID` to its new client ID.

## Checking it works

- Open the site and wait for pins to appear. During live games, scores should change on their own.
- The app's log: `az containerapp logs show -g $rg -n scoremap --follow`; Container Apps' own (pulling the image, starting, probes) with `--type system`.
- The revisions and which one takes the traffic: `az containerapp revision list -g $rg -n scoremap -o table`.
- CPU and memory over time, for whether 0.25 vCPU keeps up: the app's Metrics in the portal (CPU Usage, Memory Working Set Bytes), or `az monitor metrics list --resource $(az containerapp show -g $rg -n scoremap --query id -o tsv) --metric UsageNanoCores --interval PT5M`.
- To build and run the image locally: `docker build --build-arg COMMIT=$(git rev-parse HEAD) -t scoremap . && docker run --rm -p 8080:8080 scoremap`, then open http://localhost:8080. Without `/data` mounted, venue lookups are only kept in memory.

## If it doesn't work

- **The deploy run fails waiting for the revision**: the run prints Container Apps' system log for it. A crash on start shows in the app's log for that revision: `az containerapp logs show -g $rg -n scoremap --revision <name>`.
- **The revision can't pull the image**. Check that the GHCR package is public under Package settings → Change visibility.
- **GitHub deploy fails at Azure login with `AADSTS700213`**. Compare the reported token subject with `github_subject` in `infra/terraform/production.tfvars` and the live federated credential.
- **The certificate isn't issued**: check the CNAME (or A) and TXT records with `dig`, and that they're DNS only in Cloudflare.
- **Venue lookups are lost on a new revision**: check the share is mounted (`az containerapp show -g $rg -n scoremap --query properties.template.volumes`) and look for "saving failed" warnings in the app's log.
