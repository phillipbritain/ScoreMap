// The required checks keep AI tools out of a PR's authorship before it can reach main: no commit
// authored or committed as an AI tool, and no Co-Authored-By trailer naming one. Two modes,
// sharing one rule: `<base> <head>` checks the new commits (ci.yml's web job, on each push), and
// `--pr` checks the pull request's title and description (pr-metadata.yml, on each push or edit).
// Read commit messages as data, never as shell commands. Scan every new ancestor so merging
// an old branch cannot bring back credits removed by a history cleanup.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// AI coding tools, by the names and email domains they sign commits with. A new tool goes here.
const aiTool = new RegExp([
  String.raw`\b(?:claude|anthropic|openai|chatgpt|codex|copilot|cursor ?agent|gemini|aider|windsurf|codeium|devin-ai-integration)\b`,
  String.raw`@(?:anthropic\.com|openai\.com|cursor\.com|cognition\.ai|aider\.chat|codeium\.com|windsurf\.com)\b`,
].join('|'), 'i')
const coauthorTrailers = (text) => text.match(/^\s*co-authored-by:.*$/gim) ?? []
const creditsAiTool = (text) => coauthorTrailers(text).some((line) => aiTool.test(line))
const failures = []
const args = process.argv.slice(2)

if (args[0] === '--pr') {
  // A squash merge can use the PR title/description as its commit message.
  if (!process.env.GITHUB_EVENT_PATH) throw new Error('--pr needs GITHUB_EVENT_PATH, a pull_request event')
  const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  if (!pr) throw new Error('GITHUB_EVENT_PATH holds no pull_request')
  if (creditsAiTool(`${pr.title}\n${pr.body ?? ''}`))
    failures.push('The pull request title/description has a Co-Authored-By trailer naming an AI tool.')
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
    if (aiTool.test(author) || aiTool.test(committer) || creditsAiTool(message))
      failures.push(`Commit ${sha.slice(0, 12)} credits an AI tool.`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  console.error(args[0] === '--pr'
    ? 'Remove the AI tool Co-Authored-By trailer from the PR title/description; the check reruns on the edit.'
    : 'Remove AI tool author/coauthor metadata from the new commits, then push again.')
  process.exitCode = 1
} else {
  console.log(args[0] === '--pr'
    ? 'No AI tool Co-Authored-By trailer in the PR title/description.'
    : 'No AI tool attribution in the new commits.')
}
