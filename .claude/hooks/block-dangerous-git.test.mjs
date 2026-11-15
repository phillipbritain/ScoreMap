// Runs the hook against a scratch repository with a fake gh on the PATH, which answers
// `gh pr list` with the pull requests in FAKE_GH_PRS, or fails when FAKE_GH_FAIL is set.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const hook = fileURLToPath(new URL('./block-dangerous-git.mjs', import.meta.url))

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'scoremap-git-hook-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const bin = join(dir, 'bin')
  const repo = join(dir, 'repo')
  mkdirSync(bin)
  mkdirSync(repo)
  const gh = join(bin, 'gh')
  writeFileSync(gh, `#!${process.execPath}
if (process.env.FAKE_GH_FAIL) { process.stderr.write('offline\\n'); process.exit(1) }
process.stdout.write(process.env.FAKE_GH_PRS ?? '[]')
`)
  chmodSync(gh, 0o755)
  execFileSync('git', ['init', '-q', '-b', 'feature', repo])
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-q', '--allow-empty', '-m', 'Start'], { cwd: repo })

  return (command, ghEnv = {}) =>
    spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ tool_input: { command }, cwd: repo }),
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, ...ghEnv },
      encoding: 'utf8',
    })
}

const prs = (...states) => ({ FAKE_GH_PRS: JSON.stringify(states.map((state, i) => ({ state, number: 40 + i }))) })

test('allows a push to a branch with an open pull request', (t) => {
  const run = setup(t)
  assert.equal(run('git push', prs('OPEN')).status, 0)
  assert.equal(run('git push origin feature', prs('MERGED', 'OPEN')).status, 0, 'an open one beside a merged one')
})

test('blocks a push to a branch whose pull request is merged', (t) => {
  const run = setup(t)
  const result = run('gh pr view 40 --json state && git push -u origin HEAD', prs('MERGED'))
  assert.equal(result.status, 2)
  assert.match(result.stderr, /#40 is merged/)
  assert.match(result.stderr, /new branch from origin\/main and a new pull request/)
})

test('blocks a push to a branch whose pull request is closed', (t) => {
  const run = setup(t)
  const result = run('git push origin local:feature', prs('CLOSED'))
  assert.equal(result.status, 2)
  assert.match(result.stderr, /pushes to feature, whose pull request #40 is closed/)
})

test('allows a push to a branch with no pull request', (t) => {
  const run = setup(t)
  assert.equal(run('git push', prs()).status, 0)
})

test('allows the push when gh fails', (t) => {
  const run = setup(t)
  assert.equal(run('git push', { FAKE_GH_FAIL: '1' }).status, 0)
})
