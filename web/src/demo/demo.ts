// The query parameter, any value, that opens a demo. Must match GamesHub.DemoQuery on the server.
export const demoQuery = 'demo'

/**
 * Whether a page opened with the query `search` (as `location.search` has it) is a demo (ADR-0019): the
 * worldwide scenario's made-up games in place of real ones, for this viewer only.
 */
export function isDemo(search: string): boolean {
  return new URLSearchParams(search).has(demoQuery)
}
