// The required checks reject Claude authorship before a PR can restore it to main. Two modes,
// sharing one rule: `<base> <head>` checks the new commits (ci.yml's web job, on each push), and
// `--pr` checks the pull request's title and description (pr-metadata.yml, on each push or edit).
// Read commit messages as data, never as shell commands. Scan every new ancestor so merging
// an old branch cannot bring back credits removed by a history cleanup.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const claudeIdentity = /\bclaude\b|noreply@anthropic\.com/i
const claudeCredit = /^\s*co-authored-by:[^\r\n]*(?:\bclaude\b|noreply@anthropic\.com)/im
const failures = []
const args = process.argv.slice(2)

if (args[0] === '--pr') {
  // A squash merge can use the PR title/description as its commit message.
  if (!process.env.GITHUB_EVENT_PATH) throw new Error('--pr needs GITHUB_EVENT_PATH, a pull_request event')
  const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  if (!pr) throw new Error('GITHUB_EVENT_PATH holds no pull_request')
  if (claudeCredit.test(`${pr.title}\n${pr.body ?? ''}`))
    failures.push('The pull request title/description contains a Claude coauthor trailer.')
} else {
  const [base, head] = args
  if (!base || !head)
    throw new Error('Usage: node scripts/check-commit-attribution.mjs <base> <head> | --pr')
  const log = execFileSync('git', [
    'log', '-z', '--format=%H%x00%an <%ae>%x00%cn <%ce>%x00%B', `${base}..${head}`, '--',
  ], { encoding: 'utf8' }).split('\0')
  log.pop() // git log -z ends each record with NUL, which commit messages cannot contain.

  for (let i = 0; i < log.length; i += 4) {
    const [sha, author, committer, message] = log.slice(i, i + 4)
    if (claudeIdentity.test(author) || claudeIdentity.test(committer) || claudeCredit.test(message))
      failures.push(`Commit ${sha.slice(0, 12)} credits Claude.`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  console.error(args[0] === '--pr'
    ? 'Remove the Claude coauthor trailer from the PR title/description; the check reruns on the edit.'
    : 'Remove Claude author/coauthor metadata from the new commits, then push again.')
  process.exitCode = 1
} else {
  console.log(args[0] === '--pr'
    ? 'No Claude coauthor trailer in the PR title/description.'
    : 'No Claude attribution in the new commits.')
}
