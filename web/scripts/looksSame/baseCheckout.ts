import { execFileSync, execSync } from 'node:child_process'
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'

/** The base, checked out on its own beside the working tree. */
export interface BaseCheckout {
  /** The commit checked out. */
  commit: string
  /** The checkout's browser app folder, its packages installed. */
  web: string
  /** Removes the checkout, leaving the working tree and its packages as they were. */
  remove(): void
}

export interface CheckOutOptions {
  /** Installs packages in a browser app folder; `npm ci` unless a test says otherwise. */
  install?: (web: string) => void
}

/**
 * Checks `ref` out of the repo at `repo` into a git worktree of its own, in a temporary folder, so
 * the working tree and its uncommitted changes are never touched (#97 lost edits swapping the source
 * in place). The browser app's packages are the working tree's, linked, where the lockfiles match,
 * else installed afresh.
 */
export function checkOutBase(repo: string, ref: string, { install = npmCi }: CheckOutOptions = {}): BaseCheckout {
  const git = gitIn(repo)
  let commit: string
  try {
    commit = git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`)
  } catch {
    throw new Error(`The base "${ref}" isn't a commit in this repo`)
  }

  const dir = mkdtempSync(join(tmpdir(), checkoutPrefix))
  git('worktree', 'add', '--detach', '--quiet', dir, commit)
  const web = join(dir, 'web')
  const packages = join(web, 'node_modules')
  const ours = join(repo, 'web')
  const remove = () => removeCheckout(repo, dir)

  try {
    if (existsSync(join(ours, 'node_modules')) && sameFile(join(ours, 'package-lock.json'), join(web, 'package-lock.json'))) {
      // A junction on Windows, which needs no special rights.
      symlinkSync(join(ours, 'node_modules'), packages, 'junction')
    } else {
      install(web)
    }
  } catch (error) {
    remove()
    throw error
  }
  return { commit, web, remove }
}

/**
 * Removes the base checkouts of the repo at `repo` that a check killed outright (its terminal
 * closed, its task stopped) left behind, and gives the folders removed. A check removes its own as
 * it ends, so any still registered with git are left over.
 */
export function removeLeftBaseCheckouts(repo: string): string[] {
  const git = gitIn(repo)
  // Forgets checkouts whose folders are gone already.
  git('worktree', 'prune')
  const temp = resolve(tmpdir()).toLowerCase()
  const left = git('worktree', 'list', '--porcelain')
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => resolve(line.slice('worktree '.length)))
    .filter((dir) => dirname(dir).toLowerCase() === temp && basename(dir).startsWith(checkoutPrefix))
  for (const dir of left) removeCheckout(repo, dir)
  return left
}

const checkoutPrefix = 'scoremap-base-'

const gitIn =
  (repo: string) =>
  (...args: string[]) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim()

function removeCheckout(repo: string, dir: string): void {
  const git = gitIn(repo)
  // A link to the working tree's packages goes first, on its own, so nothing removing the checkout
  // can reach into them through it.
  const packages = join(dir, 'web', 'node_modules')
  if (lstatSync(packages, { throwIfNoEntry: false })?.isSymbolicLink()) unlinkSync(packages)
  try {
    git('worktree', 'remove', '--force', dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    git('worktree', 'prune')
  }
}

/** Whether two text files say the same, whatever line endings git gave each. */
function sameFile(a: string, b: string): boolean {
  const text = (path: string) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
  return existsSync(a) && existsSync(b) && text(a) === text(b)
}

function npmCi(web: string): void {
  // Through the shell, which finds npm as npm.cmd on Windows.
  execSync('npm ci --no-audit --no-fund', { cwd: web, stdio: 'ignore' })
}
