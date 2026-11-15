// PreToolUse hook for the Bash and PowerShell tools: blocks git commands that push to main or
// force-push, and gh commands that merge a pull request (only the user merges, after reviewing on
// GitHub). It also blocks a push to a branch whose pull request is merged or closed (and none is
// open), which would re-create the branch GitHub deleted on merge; it asks gh, and allows the push
// if gh is missing, offline or slow. Commands that only change local work, such as reset --hard, are
// left to the agent. Exits 2 with a message on stderr to block; 0 to allow.
// It matches command text, so it's an early warning, not a barrier. Nor is GitHub's branch rule
// for Claude: commands run as the user, whose admin role can bypass it.
import { execFileSync } from 'node:child_process'

const PROTECTED_BRANCH = 'main'
const GH_TIMEOUT_MS = 5000
const FEATURE_BRANCH_ADVICE =
  'Push a feature branch and open a pull request for the user to review and merge, or ask the user to run it.'

const input = JSON.parse(await readStdin())
const command = input.tool_input?.command ?? ''
const cwd = input.cwd ?? process.cwd()

for (const segment of command.split(/&&|\|\||[;|\n]/)) {
  const block = blockReason(tokens(segment))
  if (block) {
    const { reason, advice } = typeof block === 'string' ? { reason: block, advice: FEATURE_BRANCH_ADVICE } : block
    process.stderr.write(`BLOCKED: \`${segment.trim()}\` ${reason}. The user has prevented you from doing this. ${advice}\n`)
    process.exit(2)
  }
}
process.exit(0)

function blockReason(words) {
  const gh = words.indexOf('gh')
  const merge = gh === -1 ? null : ghReason(words.slice(gh + 1))
  if (merge) return merge
  const git = words.indexOf('git')
  if (git === -1) return null
  const { subcommand, args, dir } = gitSubcommand(words.slice(git + 1))

  return subcommand === 'push' ? pushReason(args, dir) : null
}

// gh pr merge, or the REST/GraphQL merge through gh api.
function ghReason(args) {
  if (args[0] === 'pr' && args[1] === 'merge') return 'merges a pull request'
  if (args[0] === 'api' && args.some((a) => /\/pulls\/\d+\/merge\b|mergePullRequest|enablePullRequestAutoMerge/.test(a)))
    return 'merges a pull request'
  return null
}

function pushReason(args, dir) {
  if (args.some((a) => /^--force(-with-lease|-if-includes)?(=|$)/.test(a) || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a)))
    return 'force-pushes'
  if (args.includes('--all') || args.includes('--mirror')) return `pushes every branch, including ${PROTECTED_BRANCH}`

  const positional = args.filter((a) => !a.startsWith('-'))
  const refspecs = positional.slice(1) // the first is the remote
  if (refspecs.some((r) => r.startsWith('+'))) return 'force-pushes (+refspec)'
  if (refspecs.some((r) => landsOnProtected(r, dir))) return `pushes to ${PROTECTED_BRANCH}`
  if (refspecs.length === 0 && currentBranch(dir) === PROTECTED_BRANCH)
    return `pushes to ${PROTECTED_BRANCH} (the checked-out branch)`
  if (args.includes('--delete') || args.includes('-d')) return null
  return finishedPullRequestReason(pushedBranches(refspecs, dir), dir)
}

// The branches a push lands on: each refspec's destination, else the checked-out branch. A refspec
// with no destination (":branch") deletes, so it's left out.
function pushedBranches(refspecs, dir) {
  if (refspecs.length === 0) return [currentBranch(dir)].filter(Boolean)
  return refspecs
    .filter((r) => !r.startsWith(':'))
    .map((r) => (r.includes(':') ? r.slice(r.lastIndexOf(':') + 1) : r))
    .map((r) => (r === 'HEAD' ? currentBranch(dir) : r?.replace(/^refs\/heads\//, '')))
    .filter((r) => r && r !== 'HEAD')
}

// A branch whose pull request is merged or closed, with none open. Fails open: no answer from gh
// allows the push.
function finishedPullRequestReason(branches, dir) {
  for (const branch of branches) {
    let prs
    try {
      const out = execFileSync('gh', ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'state,number'], {
        cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GH_TIMEOUT_MS,
      })
      prs = JSON.parse(out)
    } catch {
      continue
    }
    if (!Array.isArray(prs) || prs.length === 0 || prs.some((pr) => pr.state === 'OPEN')) continue
    const done = prs.find((pr) => pr.state === 'MERGED') ?? prs.find((pr) => pr.state === 'CLOSED')
    if (!done) continue
    return {
      reason: `pushes to ${branch}, whose pull request #${done.number} is ${done.state.toLowerCase()}`,
      advice: 'Pushing would re-create the branch on GitHub. Open a new branch from origin/main and a new pull request.',
    }
  }
  return null
}

function landsOnProtected(refspec, dir) {
  const destination = refspec.includes(':') ? refspec.slice(refspec.lastIndexOf(':') + 1) : refspec
  if (destination === PROTECTED_BRANCH || destination === `refs/heads/${PROTECTED_BRANCH}`) return true
  return destination === 'HEAD' && currentBranch(dir) === PROTECTED_BRANCH
}

// Skips git's global options (-C <dir>, -c <key=value>, --git-dir=..., and so on).
function gitSubcommand(rest) {
  let dir = cwd
  let i = 0
  while (i < rest.length && rest[i].startsWith('-')) {
    if (rest[i] === '-C') dir = rest[++i] ?? dir
    else if (rest[i] === '-c') i++
    i++
  }
  return { subcommand: rest[i], args: rest.slice(i + 1), dir }
}

function currentBranch(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

function tokens(segment) {
  return (segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((t) => t.replace(/^["']|["']$/g, ''))
}

async function readStdin() {
  let data = ''
  for await (const chunk of process.stdin) data += chunk
  return data
}
