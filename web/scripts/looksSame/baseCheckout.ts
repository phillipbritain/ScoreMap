import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: 'pipe' }).trim()
  let commit: string
  try {
    commit = git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`)
  } catch {
    throw new Error(`The base "${ref}" isn't a commit in this repo`)
  }

  const dir = mkdtempSync(join(tmpdir(), 'scoremap-base-'))
  git('worktree', 'add', '--detach', '--quiet', dir, commit)
  const web = join(dir, 'web')
  const packages = join(web, 'node_modules')
  const ours = join(repo, 'web')
  let linked = false
  const remove = () => {
    // The link goes first, on its own, so nothing removing the checkout can reach into the working
    // tree's packages through it.
    if (linked) unlinkSync(packages)
    try {
      git('worktree', 'remove', '--force', dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
      git('worktree', 'prune')
    }
  }

  try {
    if (existsSync(join(ours, 'node_modules')) && sameFile(join(ours, 'package-lock.json'), join(web, 'package-lock.json'))) {
      // A junction on Windows, which needs no special rights.
      symlinkSync(join(ours, 'node_modules'), packages, 'junction')
      linked = true
    } else {
      install(web)
    }
  } catch (error) {
    remove()
    throw error
  }
  return { commit, web, remove }
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
