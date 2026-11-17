/**
 * A team's logo, or what stands in for it. ESPN gives no logo for some teams (in college basketball,
 * most opponents from outside Division I), and a logo it gives may not load: either way the team
 * shows its mark, its initial on the logo's plate, rather than an empty space.
 */

/** A team's mark: its abbreviation's (or a player's short name's) first letter, as a capital. */
export function logoMark(abbreviation: string): string {
  return abbreviation.slice(0, 1).toUpperCase()
}

const broken = new Set<string>()

/** Notes that a logo wouldn't load, so the team shows its mark from now on rather than trying it again. */
export function logoFailed(url: string): void {
  broken.add(url)
}

/** The logo to show: null when there's none, or it has already failed to load (see logoFailed). */
export function shownLogo(url: string | null): string | null {
  return url && !broken.has(url) ? url : null
}
