using 'main.bicep'

// The deployed app (docs/deploy.md). The region comes from the resource group, scoremap-rg in eastus2.

// Keep the image GitHub Actions last deployed (docs/deploy.md). Container Apps reads its own token
// from Key Vault using its managed identity.
param image = readEnvironmentVariable('SCOREMAP_IMAGE')

// The token GitHub sends for runs on main. Owner and repo are named with their IDs, which can't be
// reused if the repo is renamed.
param githubSubject = 'repo:phillipbritain@35792740/ScoreMap@1403601772:ref:refs/heads/main'
