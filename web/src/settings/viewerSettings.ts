import { defaultCardStyle, type CardStyle } from '../globe/cardStyle'

/** What a viewer has chosen to see. Saved in the browser by the settings store. */
export interface ViewerSettings {
  /**
   * Leagues the viewer switched off, by name. Stored as the ones switched off (not on) so a
   * league added to the server's configuration later shows up switched on.
   */
  hiddenLeagues: readonly string[]
  /** Hides Upcoming and Final pins. */
  liveOnly: boolean
  /** "Show Disrupted games": shows postponed, suspended and canceled games. */
  showDisrupted: boolean
  /** "Card style": how score cards look. */
  cardStyle: CardStyle
}

/** Every league on, "Live only" off, Disrupted games shown and HUD score cards. */
export const firstVisitSettings: ViewerSettings = {
  hiddenLeagues: [],
  liveOnly: false,
  showDisrupted: true,
  cardStyle: defaultCardStyle,
}

export function isLeagueOn(settings: ViewerSettings, league: string): boolean {
  return !settings.hiddenLeagues.includes(league)
}

/** The settings with one league's switch set. */
export function withLeague(settings: ViewerSettings, league: string, on: boolean): ViewerSettings {
  return withLeagues(settings, [league], on)
}

/** The whole-sport switch: on when all its leagues are on, off when none are, otherwise mixed. */
export function sportSwitch(settings: ViewerSettings, group: SportGroup): 'on' | 'off' | 'mixed' {
  const on = group.leagues.filter((league) => isLeagueOn(settings, league.name)).length
  if (on === group.leagues.length) return 'on'
  return on === 0 ? 'off' : 'mixed'
}

/** The settings with every league in a sport switched on or off. */
export function withSport(settings: ViewerSettings, group: SportGroup, on: boolean): ViewerSettings {
  return withLeagues(
    settings,
    group.leagues.map((league) => league.name),
    on,
  )
}

/** The settings with every league switched on or off at once. */
export function withAllLeagues(settings: ViewerSettings, leagues: readonly League[], on: boolean): ViewerSettings {
  return withLeagues(
    settings,
    leagues.map((league) => league.name),
    on,
  )
}

function withLeagues(settings: ViewerSettings, leagues: readonly string[], on: boolean): ViewerSettings {
  const others = settings.hiddenLeagues.filter((hidden) => !leagues.includes(hidden))
  return { ...settings, hiddenLeagues: on ? others : [...others, ...leagues] }
}

/** A league as the server configures it (GET /api/leagues). */
export interface League {
  name: string
  sport: string
}

export interface SportGroup {
  sport: string
  leagues: League[]
}

/** Groups leagues under their sport for the settings menu, keeping the configured order. */
export function leaguesBySport(leagues: readonly League[]): SportGroup[] {
  const groups = new Map<string, League[]>()
  for (const league of leagues) {
    const group = groups.get(league.sport)
    if (group) group.push(league)
    else groups.set(league.sport, [league])
  }
  return [...groups].map(([sport, leagues]) => ({ sport, leagues }))
}
