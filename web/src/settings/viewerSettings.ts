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
  /**
   * The colour the viewer picked for each sport, by name, as #rrggbb: every game in the sport shows
   * in it (see gameColour). A sport with none takes the theme's colours.
   */
  sportColours: Readonly<Record<string, string>>
}

/** Every league on, "Live only" off, Disrupted games shown and no colours picked. */
export const firstVisitSettings: ViewerSettings = {
  hiddenLeagues: [],
  liveOnly: false,
  showDisrupted: true,
  sportColours: {},
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

/** The settings with a sport's colour picked, or cleared (null) so its games take the theme's colours again. */
export function withSportColour(settings: ViewerSettings, sport: string, colour: string | null): ViewerSettings {
  const { [sport]: _cleared, ...others } = settings.sportColours
  return { ...settings, sportColours: colour === null ? others : { ...others, [sport]: colour } }
}

/** "Reset colours": the settings with every colour cleared. */
export function withoutColours(settings: ViewerSettings): ViewerSettings {
  return { ...settings, sportColours: {} }
}

/** Whether the viewer has picked any colour, so there's something for "Reset colours" to clear. */
export function hasColours(settings: ViewerSettings): boolean {
  return Object.keys(settings.sportColours).length > 0
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
