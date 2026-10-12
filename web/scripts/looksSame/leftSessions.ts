const prefix = 'scoremap-looks-same-'

/** The agent-browser session of the check whose process is `pid`. */
export function sessionFor(pid: number): string {
  return `${prefix}${pid}`
}

/**
 * Of the agent-browser sessions going, the checks' ones whose check was killed outright before it
 * could close them. Sessions are the machine's, not a clone's, so a check still going in another
 * clone keeps its own.
 */
export function leftSessions(sessions: string[], isRunning: (pid: number) => boolean = processIsRunning): string[] {
  return sessions.filter((session) => {
    const pid = session.startsWith(prefix) ? session.slice(prefix.length) : ''
    return /^\d+$/.test(pid) && !isRunning(Number(pid))
  })
}

function processIsRunning(pid: number): boolean {
  try {
    // Signal 0 only asks whether the process is there.
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: it's there, but someone else's.
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
