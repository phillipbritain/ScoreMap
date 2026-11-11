using 'main.bicep'

// The deployed app (docs/deploy.md). The region comes from the resource group, scoremap-eastus2-rg in eastus2.

// Passed on each run from the shell (docs/deploy.md): the image, so a run keeps the one GitHub Actions
// last deployed, and the feedback token, which is never checked in. Unset, the token switches filing off.
param image = readEnvironmentVariable('SCOREMAP_IMAGE')
param feedbackGitHubToken = readEnvironmentVariable('SCOREMAP_FEEDBACK_TOKEN', '')

// The token GitHub sends for runs on main. Owner and repo are named with their IDs, which can't be
// reused if the repo is renamed.
param githubSubject = 'repo:phillipbritain@35792740/ScoreMap@1403601772:ref:refs/heads/main'
