/** What a viewer has chosen to see. Saved in the browser by the settings store. */
export interface ViewerSettings {
  /**
   * Leagues the viewer switched off, by name. Stored as the ones switched off (not on) so a
   * league added to the server's configuration later shows up switched on.
   */
  hiddenLeagues: readonly string[]
  /**
   * "Top Events" in Leagues: shows only the games ESPN lists in its Top Events, in every league,
   * whichever leagues are switched off. Off, the league switches decide ("My leagues").
   */
  topEventsOnly: boolean
  /**
   * The color the viewer picked for each sport, by name, as #rrggbb: every game in the sport shows
   * in it (see gameColor). A sport with none takes the theme's colors.
   */
  sportColors: Readonly<Record<string, string>>
  /**
   * The color the viewer picked for each league, by name, as #rrggbb. It wins over its sport's, so
   * a viewer can color a sport and set one of its leagues apart. A league with none takes its sport's.
   */
  leagueColors: Readonly<Record<string, string>>
  /** "Flames on hot games" in Display Settings, on unless switched off: hot games (see GLOSSARY.md) show flames on their score cards, small pins and clusters. */
  hotGameFlames: boolean
  /** What the globe is drawn as (see MapType): the plain map unless the viewer switched to satellite. */
  mapType: MapType
}

/**
 * The globe's map types: the plain map of borders and place names in the theme's colors, or
 * satellite imagery under the same borders and names (ADR-0022).
 */
export const mapTypes = ['plain', 'satellite'] as const

export type MapType = (typeof mapTypes)[number]

export function isMapType(value: unknown): value is MapType {
  return mapTypes.includes(value as MapType)
}

/** Every league on, Top Events off, no colors picked, flames on hot games and the plain map. */
export const firstVisitSettings: ViewerSettings = {
  hiddenLeagues: [],
  topEventsOnly: false,
  sportColors: {},
  leagueColors: {},
  hotGameFlames: true,
  mapType: 'plain',
}

/** Each map type's name, as Map Type on the rail lists it. */
export const mapTypeNames: Record<MapType, string> = { plain: 'Plain', satellite: 'Satellite' }

/** The settings with the globe drawn as this map type, picked in Map Type on the rail. */
export function withMapType(settings: ViewerSettings, mapType: MapType): ViewerSettings {
  return { ...settings, mapType }
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

/** The settings with a sport's color picked, or cleared (null) so its games take the theme's colors again. */
export function withSportColor(settings: ViewerSettings, sport: string, color: string | null): ViewerSettings {
  const { [sport]: _cleared, ...others } = settings.sportColors
  return { ...settings, sportColors: color === null ? others : { ...others, [sport]: color } }
}

/** The settings with a league's color picked, or cleared (null) so its games take its sport's color again. */
export function withLeagueColor(settings: ViewerSettings, league: string, color: string | null): ViewerSettings {
  const { [league]: _cleared, ...others } = settings.leagueColors
  return { ...settings, leagueColors: color === null ? others : { ...others, [league]: color } }
}

/** "Reset colors": the settings with every sport's and league's color cleared. */
export function withoutColors(settings: ViewerSettings): ViewerSettings {
  return { ...settings, sportColors: {}, leagueColors: {} }
}

/** Whether the viewer has picked any color, so there's something for "Reset colors" to clear. */
export function hasColors(settings: ViewerSettings): boolean {
  return Object.keys(settings.sportColors).length > 0 || Object.keys(settings.leagueColors).length > 0
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

/** Groups leagues under their sport for the rail's Leagues and Display Settings, keeping the configured order. */
export function leaguesBySport(leagues: readonly League[]): SportGroup[] {
  const groups = new Map<string, League[]>()
  for (const league of leagues) {
    const group = groups.get(league.sport)
    if (group) group.push(league)
    else groups.set(league.sport, [league])
  }
  return [...groups].map(([sport, leagues]) => ({ sport, leagues }))
}
