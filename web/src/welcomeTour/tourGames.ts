import type { Camera } from '../globe/camera'
import type { Game, GameSituation, GameStatus, ScoringPlay } from '../games/game'
import { chosenConferences, isLeagueOn, type League, type ViewerSettings } from '../settings/viewerSettings'
import { visibleGames } from '../settings/visibleGames'
import { leagueTourExample } from './tourExamples'
import type { TourProgress } from './welcomeTour'

/**
 * The featured Tour games cluster around the opening camera. Other selections can use real venues
 * farther away, so the tour can bring a selected game into view.
 */

/** Where the globe looks while the tour's games show: on all six, with the tour's panel clear of them. */
const camera: Camera = { longitude: -81, latitude: 38, zoom: 4.8 }
/** On a phone the step's panel takes the screen's width, so the camera sits further south and further out, the games above it. */
const phoneCamera: Camera = { longitude: -79.5, latitude: 36.5, zoom: 3.8 }

/**
 * On a short screen on its side (a phone in landscape), Click a score card's panel sits at the foot, so
 * the camera sits further north and further out, the games in the little height above it.
 */
const shortCamera: Camera = { longitude: -79, latitude: 40.5, zoom: 4.2 }

/** The screens the tour's camera is chosen for: a phone held upright, a short screen on its side, or wider. */
export type TourScreen = 'phone' | 'short' | 'wide'

/** The camera for the tour's games on a screen. */
export function tourCamera(screen: TourScreen): Camera {
  return screen === 'phone' ? phoneCamera : screen === 'short' ? shortCamera : camera
}

/**
 * Whether the globe shows the tour's games in place of real ones (or the scenario's): from the tour's
 * start until it's finished, when they go at once, with any panel of theirs still open.
 */
export function showsTourGames(progress: TourProgress): boolean {
  return progress !== 'finished'
}

/**
 * The tour's games, timed from `now` (ms since the epoch): each Live game started a while before it,
 * each Upcoming one starts within half an hour, and the Final one ended a moment ago. Everything else
 * is the same every time.
 */
export function tourGames(now: number): Game[] {
  return specs.map((spec) => made(spec, now))
}

/** The tour begins with an empty globe and uses matching, simulated games after confirmation. */
export function selectedTourGames(
  confirmed: boolean,
  examples: readonly Game[],
  settings: ViewerSettings,
  leagues: readonly League[],
): Game[] {
  if (!confirmed) return []
  const matching = visibleGames(examples, settings).map(live)
  if (settings.topEventsOnly) return matching

  const seed = examples.find((game) => game.status === 'Live')
  if (!seed) return matching
  for (const league of leagues) {
    if (!isLeagueOn(settings, league.name)) continue
    const conferences = chosenConferences(settings, league.name)
    for (const conference of conferences.length === 0 ? [null] : conferences) {
      const alreadyShown = matching.some(({ league: name, contest }) =>
        league.name === name && (conference === null ||
          (contest.kind === 'sides' && [contest.home.conference, contest.away.conference].includes(conference))))
      if (alreadyShown) continue
      const game = leagueTourExample(league, conference, seed)
      if (game) matching.push(game)
    }
  }
  return matching
}

function live(game: Game): Game {
  if (game.status === 'Live' || game.contest.kind !== 'sides') return game
  return {
    ...game,
    status: 'Live',
    startTime: game.status === 'Upcoming' ? new Date(Date.parse(game.startTime) - 60 * 60_000).toISOString() : game.startTime,
    endTime: null,
    clock: game.sport === 'Basketball' ? 'Q2 6:24' : "62'",
    contest: {
      kind: 'sides',
      home: { ...game.contest.home, score: game.contest.home.score ?? '0' },
      away: { ...game.contest.away, score: game.contest.away.score ?? '0' },
    },
  }
}

/** Keeps the first selected game in view when its real venue is outside the tour's opening region. */
export function tourCameraForGame(game: Game | undefined, screen: TourScreen, single = false): Camera | null {
  const defaultCamera = tourCamera(screen)
  const { longitude, latitude } = game?.venue ?? {}
  if (longitude == null || latitude == null) return null
  if (!single && Math.abs(longitude - defaultCamera.longitude) < 10 && Math.abs(latitude - defaultCamera.latitude) < 8) return null
  const offset = screen === 'short' ? 1 : screen === 'phone' ? 5 : 4
  return { longitude, latitude: Math.max(-85, latitude - offset), zoom: defaultCamera.zoom }
}

interface SideSpec {
  abbreviation: string
  fullName: string
  logoUrl: string
  score?: string
  record?: string
}

interface GameSpec {
  id: string
  league: string
  sport: string
  status: GameStatus
  clock?: string
  period?: number
  situation?: GameSituation
  lastScore?: ScoringPlay
  /** Minutes from now: negative for a game under way or over. */
  startsIn: number
  home: SideSpec
  away: SideSpec
  venue: { name: string; city: string; region: string; country: string; latitude: number; longitude: number; timeZone: string; espnId: string }
}

function made(spec: GameSpec, now: number): Game {
  const side = ({ abbreviation, fullName, logoUrl, score, record }: SideSpec) => ({
    abbreviation,
    fullName,
    logoUrl,
    score: spec.status === 'Upcoming' ? null : (score ?? '0'),
    rank: null,
    record: record ?? null,
    conference: null,
  })
  return {
    id: `tour-${spec.id}`,
    league: spec.league,
    sport: spec.sport,
    startTime: new Date(now + spec.startsIn * 60_000).toISOString(),
    status: spec.status,
    delayed: false,
    endTime: spec.status === 'Final' ? new Date(now - 2 * 60_000).toISOString() : null,
    contest: { kind: 'sides', home: side(spec.home), away: side(spec.away) },
    clock: spec.clock ?? null,
    period: spec.period ?? null,
    hot: false,
    // Its photo comes from the server, as a real game's does (see tourVenuePhotos).
    venue: { ...spec.venue, photo: null, court: null },
    streamLinks: [],
    note: null,
    situation: spec.situation ?? null,
    lastScore: spec.lastScore ?? null,
    keyEvents: [],
    // So they show whichever choice the viewer makes on Welcome.
    topEvent: true,
    scoreline: null,
    espnUrl: null,
  }
}

const logo = (league: string, team: string) => `https://a.espncdn.com/i/teamlogos/${league}/500/${team}.png`
const soccerLogo = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`
const eastern = 'America/New_York'

const specs: GameSpec[] = [
  {
    id: 'nfl-nyg', league: 'NFL', sport: 'Football', status: 'Live', clock: 'Q2 2:31', startsIn: -60,
    home: { abbreviation: 'NYG', fullName: 'New York Giants', logoUrl: logo('nfl', 'nyg'), score: '10' },
    away: { abbreviation: 'WSH', fullName: 'Washington Commanders', logoUrl: logo('nfl', 'wsh'), score: '14' },
    venue: { name: 'MetLife Stadium', city: 'East Rutherford', region: 'New Jersey', country: 'USA', latitude: 40.8135, longitude: -74.0745, timeZone: eastern, espnId: '3839' },
  },
  {
    id: 'mlb-nyy', league: 'MLB', sport: 'Baseball', status: 'Live', clock: 'Bot 6th', startsIn: -110,
    home: { abbreviation: 'NYY', fullName: 'New York Yankees', logoUrl: logo('mlb', 'nyy'), score: '4' },
    away: { abbreviation: 'BOS', fullName: 'Boston Red Sox', logoUrl: logo('mlb', 'bos'), score: '2' },
    venue: { name: 'Yankee Stadium', city: 'Bronx', region: 'New York', country: 'USA', latitude: 40.8296, longitude: -73.9262, timeZone: eastern, espnId: '208' },
  },
  {
    id: 'nba-bkn', league: 'NBA', sport: 'Basketball', status: 'Upcoming', startsIn: 25,
    home: { abbreviation: 'BKN', fullName: 'Brooklyn Nets', logoUrl: logo('nba', 'bkn') },
    away: { abbreviation: 'MIA', fullName: 'Miami Heat', logoUrl: logo('nba', 'mia') },
    venue: { name: 'Barclays Center', city: 'Brooklyn', region: 'New York', country: 'USA', latitude: 40.6826, longitude: -73.9754, timeZone: eastern, espnId: '3559' },
  },
  {
    id: 'nhl-tor', league: 'NHL', sport: 'Hockey', status: 'Live', clock: '2nd 8:04', startsIn: -50,
    home: { abbreviation: 'TOR', fullName: 'Toronto Maple Leafs', logoUrl: logo('nhl', 'tor'), score: '1' },
    away: { abbreviation: 'MTL', fullName: 'Montreal Canadiens', logoUrl: logo('nhl', 'mtl'), score: '1' },
    venue: { name: 'Scotiabank Arena', city: 'Toronto', region: 'Ontario', country: 'Canada', latitude: 43.6435, longitude: -79.3791, timeZone: 'America/Toronto', espnId: '1838' },
  },
  {
    id: 'mls-chi', league: 'MLS', sport: 'Soccer', status: 'Final', clock: 'FT', startsIn: -130,
    home: { abbreviation: 'CHI', fullName: 'Chicago Fire FC', logoUrl: soccerLogo(182), score: '2' },
    away: { abbreviation: 'CLB', fullName: 'Columbus Crew', logoUrl: soccerLogo(183), score: '0' },
    venue: { name: 'Soldier Field', city: 'Chicago', region: 'Illinois', country: 'USA', latitude: 41.8623, longitude: -87.6167, timeZone: 'America/Chicago', espnId: '1452' },
  },
  {
    id: 'nfl-pit', league: 'NFL', sport: 'Football', status: 'Live', clock: 'Q3 6:12', period: 3, startsIn: -95,
    home: { abbreviation: 'PIT', fullName: 'Pittsburgh Steelers', logoUrl: logo('nfl', 'pit'), score: '13', record: '6-3' },
    away: { abbreviation: 'BAL', fullName: 'Baltimore Ravens', logoUrl: logo('nfl', 'bal'), score: '17', record: '7-2' },
    situation: {
      lastPlay: 'J. Warren rush to the right for 6 yards to the BAL 38',
      downAndDistance: '2nd & 4 at BAL 38',
      possession: 'PIT',
      balls: null, strikes: null, outs: null, onFirst: false, onSecond: false, onThird: false,
    },
    lastScore: { team: 'BAL', text: 'D. Henry 12 yard run (J. Tucker kick)', when: 'Q3 9:47' },
    venue: { name: 'Acrisure Stadium', city: 'Pittsburgh', region: 'Pennsylvania', country: 'USA', latitude: 40.4468, longitude: -80.0158, timeZone: eastern, espnId: '3752' },
  },
]
