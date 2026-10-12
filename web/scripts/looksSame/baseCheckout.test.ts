import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkOutBase, removeLeftBaseCheckouts } from './baseCheckout.ts'

let repo: string
let base: string

const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' })
const write = (path: string, text: string) => {
  mkdirSync(join(repo, path, '..'), { recursive: true })
  writeFileSync(join(repo, path), text)
}

beforeEach(() => {
  // A repo shaped like ScoreMap's: the browser app in web/, its packages installed and ignored.
  repo = mkdtempSync(join(tmpdir(), 'looks-same-repo-'))
  git('init', '--quiet', '--initial-branch=main')
  // Files come out as they went in, whatever the machine's git does with line endings.
  git('config', 'core.autocrlf', 'false')
  write('.gitignore', 'node_modules/\n')
  write('web/src/index.css', '.card { padding: 6px }\n')
  write('web/package-lock.json', '{ "lockfileVersion": 3 }\n')
  write('web/node_modules/vite/package.json', '{ "name": "vite" }\n')
  git('add', '.')
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '--quiet', '-m', 'Base')
  base = git('rev-parse', 'HEAD').trim()
})

afterEach(() => {
  // Any a failing test left.
  removeLeftBaseCheckouts(repo)
  rmSync(repo, { recursive: true, force: true })
})

describe('checkOutBase', () => {
  it("checks the base out on its own, leaving the working tree's uncommitted changes as they were", () => {
    write('web/src/index.css', '.card { padding: 7px }\n')
    write('web/src/new.css', '.new {}\n')
    const status = git('status', '--porcelain')

    const checkout = checkOutBase(repo, 'main', { install: () => {} })
    try {
      expect(checkout.commit).toBe(base)
      expect(readFileSync(join(checkout.web, 'src/index.css'), 'utf8')).toBe('.card { padding: 6px }\n')
    } finally {
      checkout.remove()
    }

    expect(readFileSync(join(repo, 'web/src/index.css'), 'utf8')).toBe('.card { padding: 7px }\n')
    expect(existsSync(join(repo, 'web/src/new.css'))).toBe(true)
    expect(git('status', '--porcelain')).toBe(status)
  })

  it("shares the working tree's packages where the lockfiles match, and removing the checkout leaves them be", () => {
    let installed = false

    const checkout = checkOutBase(repo, 'main', { install: () => (installed = true) })
    expect(readFileSync(join(checkout.web, 'node_modules/vite/package.json'), 'utf8')).toContain('vite')
    checkout.remove()

    expect(installed).toBe(false)
    expect(existsSync(checkout.web)).toBe(false)
    expect(readFileSync(join(repo, 'web/node_modules/vite/package.json'), 'utf8')).toContain('vite')
    expect(git('worktree', 'list').trim().split('\n')).toHaveLength(1)
  })

  it('installs the base its own packages where the lockfiles differ', () => {
    write('web/package-lock.json', '{ "lockfileVersion": 3, "packages": {} }\n')
    const installedIn: string[] = []

    const checkout = checkOutBase(repo, 'main', { install: (web) => installedIn.push(web) })
    checkout.remove()

    expect(installedIn).toEqual([checkout.web])
  })

  it("says so when the base isn't a commit", () => {
    expect(() => checkOutBase(repo, 'no-such-branch', { install: () => {} })).toThrow(/no-such-branch/)
  })
})

describe('removeLeftBaseCheckouts', () => {
  it("removes the base checkouts a killed check left, leaving the working tree's packages be", () => {
    // Killed before it could remove them: one sharing the working tree's packages, one with its own.
    const linked = checkOutBase(repo, 'main', { install: () => {} })
    write('web/package-lock.json', '{ "lockfileVersion": 3, "packages": {} }\n')
    const installed = checkOutBase(repo, 'main', { install: (web) => mkdirSync(join(web, 'node_modules/vite'), { recursive: true }) })

    const removed = removeLeftBaseCheckouts(repo)

    expect(removed.sort()).toEqual([linked.web, installed.web].map((web) => join(web, '..')).sort())
    expect(existsSync(linked.web)).toBe(false)
    expect(existsSync(installed.web)).toBe(false)
    expect(readFileSync(join(repo, 'web/node_modules/vite/package.json'), 'utf8')).toContain('vite')
    expect(git('worktree', 'list').trim().split('\n')).toHaveLength(1)
  })

  it('leaves worktrees that are not base checkouts be', () => {
    const other = mkdtempSync(join(tmpdir(), 'looks-same-other-'))
    rmSync(other, { recursive: true })
    git('worktree', 'add', '--detach', '--quiet', other, 'main')
    try {
      expect(removeLeftBaseCheckouts(repo)).toEqual([])
      expect(existsSync(join(other, 'web/src/index.css'))).toBe(true)
    } finally {
      git('worktree', 'remove', '--force', other)
    }
  })
})
