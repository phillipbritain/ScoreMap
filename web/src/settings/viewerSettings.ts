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
   * "Only show live games" in Display Settings: no Upcoming game shows, neither those starting within 30
   * minutes nor those filling a globe with few games on (ADR-0029). Final games still do.
   */
  onlyLiveGames: boolean
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
  /** What the globe is drawn as (see MapType): the plain map unless the viewer switched to satellite. */
  mapType: MapType
  /** Whether the event panel shows the venue's photo behind its details: on unless the viewer switched it off in Display Settings. */
  venuePhotos: boolean
  /**
   * The conferences the viewer narrowed a league's games to, by league name: the league shows only its games
   * with a team in one of them. A league not listed shows all its games, as does every league on Top Events.
   */
  chosenConferences: Readonly<Record<string, readonly string[]>>
  /** How many score cards the globe shows at once where it's busy (see CardDensity): Default unless the viewer picked another in Display Settings. */
  cardDensity: CardDensity
}

/**
 * How many score cards the globe shows at once where it's busy, the rest counted in card clusters (see
 * cardCount): Minimal for the fewest, and the fewest trails, Dense for the most.
 */
export const cardDensities = ['minimal', 'default', 'dense'] as const

export type CardDensity = (typeof cardDensities)[number]

export function isCardDensity(value: unknown): value is CardDensity {
  return cardDensities.includes(value as CardDensity)
}

/** Each card density's name, as Display Settings lists it. */
export const cardDensityNames: Record<CardDensity, string> = { minimal: 'Minimal', default: 'Default', dense: 'Dense' }

/**
 * The globe's map types: the plain map of borders and place names in the theme's colors, or
 * satellite imagery under the same borders and names (ADR-0022).
 */
export const mapTypes = ['plain', 'satellite'] as const

export type MapType = (typeof mapTypes)[number]

export function isMapType(value: unknown): value is MapType {
  return mapTypes.includes(value as MapType)
}

/** Every league on with all its conferences, Top Events and Only show live games off, no colors picked, the plain map, venue photos on and Default card density. */
export const firstVisitSettings: ViewerSettings = {
  hiddenLeagues: [],
  topEventsOnly: false,
  onlyLiveGames: false,
  sportColors: {},
  leagueColors: {},
  mapType: 'plain',
  venuePhotos: true,
  chosenConferences: {},
  cardDensity: 'default',
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

/** The conferences chosen in a league; empty when it shows all of them. */
export function chosenConferences(settings: ViewerSettings, league: string): readonly string[] {
  return settings.chosenConferences[league] ?? []
}

/** The settings with one conference in a league chosen, or unchosen. With none left chosen, the league shows all of them. */
export function withConference(settings: ViewerSettings, league: string, conference: string, chosen: boolean): ViewerSettings {
  const others = chosenConferences(settings, league).filter((other) => other !== conference)
  return withChosenConferences(settings, league, chosen ? [...others, conference] : others)
}

/** "All conferences": the settings with a league showing all of its conferences again. */
export function withAllConferences(settings: ViewerSettings, league: string): ViewerSettings {
  return withChosenConferences(settings, league, [])
}

function withChosenConferences(settings: ViewerSettings, league: string, conferences: readonly string[]): ViewerSettings {
  const { [league]: _cleared, ...others } = settings.chosenConferences
  return { ...settings, chosenConferences: conferences.length === 0 ? others : { ...others, [league]: conferences } }
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

/**
 * Whether the viewer's Leagues choices keep games of these leagues off the globe, so the Leagues button on the
 * rail marks it: Top Events on, a league switched off, or a league that's on narrowed to some conferences. A
 * league no longer in the list doesn't count. Only show live games doesn't either: it's in Display Settings,
 * not Leagues, where the viewer would look for it.
 */
export function leaguesFilterGames(settings: ViewerSettings, leagues: readonly League[]): boolean {
  if (settings.topEventsOnly) return true
  return leagues.some((league) => !isLeagueOn(settings, league.name) || chosenConferences(settings, league.name).length > 0)
}

function withLeagues(settings: ViewerSettings, leagues: readonly string[], on: boolean): ViewerSettings {
  const others = settings.hiddenLeagues.filter((hidden) => !leagues.includes(hidden))
  return { ...settings, hiddenLeagues: on ? others : [...others, ...leagues] }
}

/** A league as the server configures it (GET /api/leagues). */
export interface League {
  name: string
  sport: string
  /** The conferences its games can be narrowed to (college leagues), by name in order; empty for a league without them. */
  conferences: readonly string[]
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
