using 'main.bicep'

// The deployed app (docs/deploy.md). The region comes from the resource group, scoremap-rg in eastus2.

// Passed on each run from the shell (docs/deploy.md): the image, so a run keeps the one GitHub Actions
// last deployed, and the feedback token, which is never checked in. A run without the token would switch
// filing off, so it fails unless SCOREMAP_ALLOW_NO_FEEDBACK=true says that's meant (docs/configuration.md).
// The check is here, not in main.bicep, because Azure hides a secure parameter's value while it validates.
param image = readEnvironmentVariable('SCOREMAP_IMAGE')
var feedbackToken = readEnvironmentVariable('SCOREMAP_FEEDBACK_TOKEN', '')
param feedbackGitHubToken = !empty(feedbackToken) || readEnvironmentVariable('SCOREMAP_ALLOW_NO_FEEDBACK', '') == 'true'
  ? feedbackToken
  : fail('SCOREMAP_FEEDBACK_TOKEN is not set: set it, or set SCOREMAP_ALLOW_NO_FEEDBACK=true to deploy with feedback only logged (docs/configuration.md#feedback).')

// The token GitHub sends for runs on main. Owner and repo are named with their IDs, which can't be
// reused if the repo is renamed.
param githubSubject = 'repo:phillipbritain@35792740/ScoreMap@1403601772:ref:refs/heads/main'
