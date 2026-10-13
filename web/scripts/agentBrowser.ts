import { runCommand } from './command.ts'

/** What a script run in the page says while it's still waiting, for what's named: run it again. */
export interface Waiting {
  waiting: string
}

/** agent-browser, for the scripts that drive a dev run's page, in the session AGENT_BROWSER_SESSION names. */
export function agentBrowser({ cwd, scratch }: { cwd: string; scratch: string }) {
  // agent-browser is an npm script on Windows (agent-browser.cmd), which only the shell can start.
  const browser = (args: string[], input?: string) =>
    runCommand('agent-browser', args, { cwd, scratch, input, shell: true })

  /** Runs a script in the page, giving back what it comes to. */
  const evaluate = (script: string): unknown => {
    const answer = JSON.parse(browser(['eval', '--stdin', '--json'], script)) as { success: boolean; data: { result: unknown }; error: string }
    if (!answer.success) throw new Error(`A script in the page failed: ${answer.error}`)
    return answer.data.result
  }

  /**
   * Runs a self-contained function in the page (sent there as its source text), again while it says
   * it's waiting (up to two minutes), giving back its answer. agent-browser gives up on a script
   * after 30 seconds, so the function waits less than that each time.
   */
  const inPage = <Arg, Answer>(fn: (arg: Arg) => Promise<Answer | Waiting>, arg: Arg): Exclude<Answer, Waiting> => {
    const end = Date.now() + 120_000
    for (;;) {
      const answer = evaluate(`(${fn.toString()})(${JSON.stringify(arg)})`) as Answer | Waiting
      if (!(answer && typeof answer === 'object' && 'waiting' in answer)) return answer as Exclude<Answer, Waiting>
      if (Date.now() > end) throw new TimedOut(`Timed out waiting for ${answer.waiting}`)
    }
  }

  return { browser, evaluate, inPage }
}

/** A script in the page was still waiting after two minutes. */
export class TimedOut extends Error {}
