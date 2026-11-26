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
  const check = (base, head, extraEnv = {}) => spawnSync(process.execPath, [script, base, head].filter(Boolean), {
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

  git('checkout', '-q', '--detach', clean)
  const otherTools = [
    'Copilot <175728472+Copilot@users.noreply.github.com>',
    'Cursor Agent <cursoragent@cursor.com>',
    'chatgpt-codex-connector[bot] <199175422+chatgpt-codex-connector[bot]@users.noreply.github.com>',
    'gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>',
  ]
  for (const tool of otherTools) {
    const credited = commit(`Tool work\n\nCo-authored-by: ${tool}`)
    assert.equal(check('HEAD^', credited).status, 1, `rejects a coauthor trailer for ${tool}`)
  }
  git('commit', '--allow-empty', '--author=Copilot <175728472+Copilot@users.noreply.github.com>', '-m', 'Tool authored')
  assert.equal(check('HEAD^', 'HEAD').status, 1, 'catches another tool as the author')
  const human = commit('Pair work\n\nCo-authored-by: Ada Lovelace <ada@example.com>')
  assert.equal(check('HEAD^', human).status, 0, 'allows a human coauthor')
  const mention = commit('Turn off Copilot and Cursor suggestions in the editor settings')
  assert.equal(check('HEAD^', mention).status, 0, 'allows tools named outside a trailer')

  const event = join(cwd, 'event.json')
  writeFileSync(event, JSON.stringify({ pull_request: { title: 'Clean title',
    body: 'Description\n\nCo-authored-by: Claude <noreply@anthropic.com>' } }))
  assert.equal(check('--pr', undefined, { GITHUB_EVENT_PATH: event }).status, 1, 'catches a squash description')
  assert.equal(check(oldCredit, clean, { GITHUB_EVENT_PATH: event }).status, 0,
    'leaves the description to --pr, so an edit reruns only the metadata check')
  writeFileSync(event, JSON.stringify({ pull_request: { title: 'Disable Claude attribution', body: null } }))
  assert.equal(check('--pr', undefined, { GITHUB_EVENT_PATH: event }).status, 0, 'allows a clean PR')
})
