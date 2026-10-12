import { spawnSync } from 'node:child_process'
import { closeSync, openSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Runs a command to the end and gives its standard output. The output goes through files in
 * `scratch`, not pipes: a daemon the command starts (agent-browser's) would hold a pipe open forever.
 */
export function runCommand(
  command: string,
  args: string[],
  { cwd, scratch, input, shell = false }: { cwd: string; scratch: string; input?: string; shell?: boolean },
): string {
  const [outFile, errFile] = [join(scratch, 'command.out'), join(scratch, 'command.err')]
  const out = openSync(outFile, 'w')
  const err = openSync(errFile, 'w')
  let result
  try {
    const stdio = [input === undefined ? 'ignore' : 'pipe', out, err] as const
    const quote = (arg: string) => (/[\s"&|<>^()%!]/.test(arg) ? `"${arg.replaceAll('"', '""')}"` : arg)
    result = shell
      ? spawnSync([command, ...args].map(quote).join(' '), { cwd, input, shell: true, stdio: [...stdio] })
      : spawnSync(command, args, { cwd, input, stdio: [...stdio] })
  } finally {
    closeSync(out)
    closeSync(err)
  }
  const text = readFileSync(outFile, 'utf8')
  if (result.error) throw new Error(`${command} ${args[0]}: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${(text + readFileSync(errFile, 'utf8')).trim()}`)
  return text
}
