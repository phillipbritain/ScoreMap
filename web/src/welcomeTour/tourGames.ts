import type { Camera } from '../globe/camera'
import type { Game, GameStatus } from '../games/game'
import type { TourProgress } from './welcomeTour'

/**
 * The welcome tour's games (see GLOSSARY.md "Tour games", ADR-0027): six made-up games over the
 * eastern half of North America, the same every time the tour runs, so a first visit starts on a few
 * cards rather than however many real games are on. Three sit close together around New York, so
 * the tour shows cards making room for each other; the rest are spread out. Each sport and status
 * shows at least once.
 */

/** Where the globe looks while the tour's games show: on all six, with the tour's panel clear of them. */
const camera: Camera = { longitude: -81, latitude: 38, zoom: 4.8 }
/** On a phone the step's bottom sheet covers the lower half, so the camera sits further south and further out. */
const phoneCamera: Camera = { longitude: -79.5, latitude: 36.5, zoom: 3.8 }

/** The camera for the tour's games, at a phone's width or wider. */
export function tourCamera(phone: boolean): Camera {
  return phone ? phoneCamera : camera
}

/**
 * Whether the globe shows the tour's games in place of real ones (or the scenario's): from the tour's
 * start until it's finished, and after that for as long as a panel opened from Click a score card stays
 * open, so the game it shows doesn't vanish from under it.
 */
export function showsTourGames(progress: TourProgress, openedFromTour: string | null): boolean {
  return progress !== 'finished' || openedFromTour !== null
}

/**
 * The tour's games, timed from `now` (ms since the epoch): each Live game started a while before it,
 * each Upcoming one starts within half an hour, and the Final one ended a moment ago. Everything else
 * is the same every time.
 */
export function tourGames(now: number): Game[] {
  return specs.map((spec) => made(spec, now))
}

interface SideSpec {
  abbreviation: string
  fullName: string
  logoUrl: string
  score?: string
}

interface GameSpec {
  id: string
  league: string
  sport: string
  status: GameStatus
  clock?: string
  /** Minutes from now: negative for a game under way or over. */
  startsIn: number
  home: SideSpec
  away: SideSpec
  venue: { name: string; city: string; region: string; country: string; latitude: number; longitude: number; timeZone: string }
}

function made(spec: GameSpec, now: number): Game {
  const side = ({ abbreviation, fullName, logoUrl, score }: SideSpec) => ({
    abbreviation,
    fullName,
    logoUrl,
    score: spec.status === 'Upcoming' ? null : (score ?? '0'),
    rank: null,
    record: null,
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
    period: null,
    hot: false,
    venue: { ...spec.venue, photo: null, court: null },
    streamLinks: [],
    note: null,
    situation: null,
    lastScore: null,
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
    venue: { name: 'MetLife Stadium', city: 'East Rutherford', region: 'New Jersey', country: 'USA', latitude: 40.8135, longitude: -74.0745, timeZone: eastern },
  },
  {
    id: 'mlb-nyy', league: 'MLB', sport: 'Baseball', status: 'Live', clock: 'Bot 6th', startsIn: -110,
    home: { abbreviation: 'NYY', fullName: 'New York Yankees', logoUrl: logo('mlb', 'nyy'), score: '4' },
    away: { abbreviation: 'BOS', fullName: 'Boston Red Sox', logoUrl: logo('mlb', 'bos'), score: '2' },
    venue: { name: 'Yankee Stadium', city: 'Bronx', region: 'New York', country: 'USA', latitude: 40.8296, longitude: -73.9262, timeZone: eastern },
  },
  {
    id: 'nba-bkn', league: 'NBA', sport: 'Basketball', status: 'Upcoming', startsIn: 25,
    home: { abbreviation: 'BKN', fullName: 'Brooklyn Nets', logoUrl: logo('nba', 'bkn') },
    away: { abbreviation: 'MIA', fullName: 'Miami Heat', logoUrl: logo('nba', 'mia') },
    venue: { name: 'Barclays Center', city: 'Brooklyn', region: 'New York', country: 'USA', latitude: 40.6826, longitude: -73.9754, timeZone: eastern },
  },
  {
    id: 'nhl-tor', league: 'NHL', sport: 'Hockey', status: 'Live', clock: '2nd 8:04', startsIn: -50,
    home: { abbreviation: 'TOR', fullName: 'Toronto Maple Leafs', logoUrl: logo('nhl', 'tor'), score: '1' },
    away: { abbreviation: 'MTL', fullName: 'Montreal Canadiens', logoUrl: logo('nhl', 'mtl'), score: '1' },
    venue: { name: 'Scotiabank Arena', city: 'Toronto', region: 'Ontario', country: 'Canada', latitude: 43.6435, longitude: -79.3791, timeZone: 'America/Toronto' },
  },
  {
    id: 'mls-chi', league: 'MLS', sport: 'Soccer', status: 'Final', clock: 'FT', startsIn: -130,
    home: { abbreviation: 'CHI', fullName: 'Chicago Fire FC', logoUrl: soccerLogo(182), score: '2' },
    away: { abbreviation: 'CLB', fullName: 'Columbus Crew', logoUrl: soccerLogo(183), score: '0' },
    venue: { name: 'Soldier Field', city: 'Chicago', region: 'Illinois', country: 'USA', latitude: 41.8623, longitude: -87.6167, timeZone: 'America/Chicago' },
  },
  {
    id: 'nfl-pit', league: 'NFL', sport: 'Football', status: 'Upcoming', startsIn: 28,
    home: { abbreviation: 'PIT', fullName: 'Pittsburgh Steelers', logoUrl: logo('nfl', 'pit') },
    away: { abbreviation: 'BAL', fullName: 'Baltimore Ravens', logoUrl: logo('nfl', 'bal') },
    venue: { name: 'Acrisure Stadium', city: 'Pittsburgh', region: 'Pennsylvania', country: 'USA', latitude: 40.4468, longitude: -80.0158, timeZone: eastern },
  },
]
