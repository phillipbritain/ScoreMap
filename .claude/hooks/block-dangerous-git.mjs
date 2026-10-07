// PreToolUse hook for the Bash and PowerShell tools: blocks git commands that push to main,
// force-push, or throw away local work. Exits 2 with a message on stderr to block; 0 to allow.
// It matches command text, so it's an early warning, not a barrier: the branch rule on GitHub is that.
import { execFileSync } from 'node:child_process'

const PROTECTED_BRANCH = 'main'

const input = JSON.parse(await readStdin())
const command = input.tool_input?.command ?? ''
const cwd = input.cwd ?? process.cwd()

for (const segment of command.split(/&&|\|\||[;|\n]/)) {
  const reason = blockReason(tokens(segment))
  if (reason) {
    process.stderr.write(
      `BLOCKED: \`${segment.trim()}\` ${reason}. The user has prevented you from doing this. ` +
        'Push a feature branch and open a pull request instead, or ask the user to run it.\n',
    )
    process.exit(2)
  }
}
process.exit(0)

function blockReason(words) {
  const git = words.indexOf('git')
  if (git === -1) return null
  const { subcommand, args, dir } = gitSubcommand(words.slice(git + 1))

  switch (subcommand) {
    case 'push':
      return pushReason(args, dir)
    case 'reset':
      return args.includes('--hard') ? 'discards uncommitted changes (reset --hard)' : null
    case 'clean':
      return args.some((a) => /^-[a-zA-Z]*f/.test(a) || a === '--force') ? 'deletes untracked files (clean -f)' : null
    case 'branch':
      return args.includes('-D') || (args.includes('--delete') && args.includes('--force'))
        ? 'deletes a branch even if it is unmerged (branch -D)'
        : null
    case 'checkout':
      return args.includes('.') ? 'discards every uncommitted change (checkout .)' : null
    case 'restore':
      return args.includes('.') && !(args.includes('--staged') && !args.includes('--worktree'))
        ? 'discards every uncommitted change (restore .)'
        : null
    default:
      return null
  }
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
