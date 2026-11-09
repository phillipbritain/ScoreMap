// The required web check rejects Claude authorship before a PR can restore it to main.
// Read commit messages as data, never as shell commands. Scan every new ancestor so merging
// an old branch cannot bring back credits removed by a history cleanup.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [base, head] = process.argv.slice(2)
if (!base || !head) throw new Error('Usage: node scripts/check-commit-attribution.mjs <base> <head>')

const claudeIdentity = /\bclaude\b|noreply@anthropic\.com/i
const claudeCredit = /^\s*co-authored-by:[^\r\n]*(?:\bclaude\b|noreply@anthropic\.com)/im
const failures = []
const log = execFileSync('git', [
  'log', '-z', '--format=%H%x00%an <%ae>%x00%cn <%ce>%x00%B', `${base}..${head}`, '--',
], { encoding: 'utf8' }).split('\0')
log.pop() // git log -z ends each record with NUL, which commit messages cannot contain.

for (let i = 0; i < log.length; i += 4) {
  const [sha, author, committer, message] = log.slice(i, i + 4)
  if (claudeIdentity.test(author) || claudeIdentity.test(committer) || claudeCredit.test(message))
    failures.push(`Commit ${sha.slice(0, 12)} credits Claude.`)
}

// A squash merge can use the PR title/description as its commit message.
if (process.env.GITHUB_EVENT_PATH) {
  const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  if (pr && claudeCredit.test(`${pr.title}\n${pr.body ?? ''}`))
    failures.push('The pull request title/description contains a Claude coauthor trailer.')
}

if (failures.length) {
  console.error(failures.join('\n'))
  console.error('Remove Claude author/coauthor metadata from the new commits and PR description, then push again.')
  process.exitCode = 1
} else {
  console.log('No Claude attribution in the new commits or PR description.')
}
