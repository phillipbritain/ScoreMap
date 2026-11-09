import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const script = fileURLToPath(new URL('./check-commit-attribution.mjs', import.meta.url))

test('checks actual git history and squash-message input without counting existing history', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'scoremap-attribution-'))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const env = { ...process.env, GITHUB_EVENT_PATH: '', GIT_AUTHOR_NAME: 'Test Owner',
    GIT_AUTHOR_EMAIL: 'owner@example.com', GIT_COMMITTER_NAME: 'Test Owner',
    GIT_COMMITTER_EMAIL: 'owner@example.com' }
  const git = (...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()
  const commit = (message) => {
    git('commit', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD')
  }
  const check = (base, head, extraEnv = {}) => spawnSync(process.execPath, [script, base, head], {
    cwd, env: { ...env, ...extraEnv }, encoding: 'utf8',
  })

  git('init', '-q')
  const initial = commit('Initial commit')
  const oldCredit = commit('Old work\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')
  assert.equal(check(initial, oldCredit).status, 1, 'rejects a model-specific coauthor')
  const clean = commit('Document how Claude attribution works')
  assert.equal(check(oldCredit, clean).status, 0, 'allows ordinary mentions and excludes existing ancestry')
  const newCredit = commit('New work\n\nco-authored-by: Claude <noreply@anthropic.com>')
  assert.equal(check(clean, newCredit).status, 1, 'rejects a generic coauthor regardless of capitalization')

  git('checkout', '-q', '--detach', initial)
  const newMain = commit('Clean main history')
  git('merge', '--no-ff', newCredit, '-m', 'Bring back an older branch')
  assert.equal(check(newMain, 'HEAD').status, 1, 'catches credits in reintroduced ancestors')

  git('checkout', '-q', '--detach', clean)
  git('commit', '--allow-empty', '--author=Claude <noreply@anthropic.com>', '-m', 'Authored directly')
  assert.equal(check(clean, 'HEAD').status, 1, 'catches primary authorship without a trailer')
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Committed directly'], {
    cwd, env: { ...env, GIT_COMMITTER_NAME: 'Claude', GIT_COMMITTER_EMAIL: 'noreply@anthropic.com' },
  })
  assert.equal(check('HEAD^', 'HEAD').status, 1, 'catches committer metadata')

  const event = join(cwd, 'event.json')
  writeFileSync(event, JSON.stringify({ pull_request: { title: 'Clean title',
    body: 'Description\n\nCo-authored-by: Claude <noreply@anthropic.com>' } }))
  assert.equal(check(oldCredit, clean, { GITHUB_EVENT_PATH: event }).status, 1, 'catches a squash description')
  writeFileSync(event, JSON.stringify({ pull_request: { title: 'Disable Claude attribution', body: null } }))
  assert.equal(check(oldCredit, clean, { GITHUB_EVENT_PATH: event }).status, 0, 'allows a clean PR')
})
