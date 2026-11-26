# Local runs side by side

Any number of clones and worktrees can each have a local run at once. ADR-0013 made one run on the machine the normal case, with a second run only when asked for, because the machine it was written on struggled with more. Development has since moved to a more powerful machine, and work now runs in parallel, such as several agents each checking a change in its own worktree.

## Consequences

- A plain `aspire start` still uses the fixed ports (5173 for the app, 5147 for the server), so only one run on the machine is plain. Every other run is `aspire start --isolated`, on random ports read from `aspire describe`.
- An agent checking its own change starts an isolated run in its own workspace and stops it when done. It never stops a run it didn't start.
- The rest of ADR-0013 stands: the stock Aspire setup, and one run per clone or worktree.
