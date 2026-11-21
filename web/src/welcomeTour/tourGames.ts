import type { Camera } from '../globe/camera'
import type { GameSituation } from '../games/game'
import { tourClockLine, type TourClock, type TourGame } from './tourGame'

/**
 * The Tour games: the same six every time, whatever the viewer chooses on Welcome, around the opening
 * camera, so the tour is the same for everyone (ADR-0027). Click a score card points at Ravens v Steelers.
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

/** The tour's six Live games, timed from when the tour starts. */
export function tourGames(now: number): TourGame[] {
  return specs.map((spec) => made(spec, now))
}

/** The Click a score card step's game: Ravens v Steelers, in Pittsburgh. */
export const tourGameToTry = 'tour-nfl-pit'

interface SideSpec {
  abbreviation: string
  fullName: string
  logoUrl: string
  score: number
  record?: string
}

interface GameSpec {
  id: string
  league: string
  sport: string
  clock: TourClock
  period: number
  phase?: TourGame['tourPlay']['phase']
  situation?: GameSituation
  /** Minutes from now: negative for a game under way or over. */
  startsIn: number
  home: SideSpec
  away: SideSpec
  /**
   * Links for the event panel's ESPN and StreamEast logos, as a scenario's made-up ones do: each to its
   * site's home page, the game not being real.
   */
  links?: boolean
  /** As a real game's scoreboard gives it (so its city, region and country are ESPN's), with ESPN's id for it in the league. */
  venue: { name: string; city: string; region: string | null; country: string | null; latitude: number; longitude: number; timeZone: string; espnId: string }
}

function made(spec: GameSpec, now: number): TourGame {
  const side = ({ abbreviation, fullName, logoUrl, score, record }: SideSpec) => ({
    abbreviation,
    fullName,
    logoUrl,
    score: String(score),
    rank: null,
    record: record ?? null,
    conference: null,
  })
  return {
    id: `tour-${spec.id}`,
    league: spec.league,
    sport: spec.sport,
    startTime: new Date(now + spec.startsIn * 60_000).toISOString(),
    status: 'Live',
    delayed: false,
    endTime: null,
    contest: { kind: 'sides', home: side(spec.home), away: side(spec.away) },
    clock: tourClockLine(spec.clock),
    period: spec.period,
    tourPlay: {
      scores: { home: spec.home.score, away: spec.away.score },
      phase: spec.phase ?? 'Playing',
      clock: spec.clock,
    },
    hot: false,
    // Its photo comes from the server, as a real game's does (see tourVenuePhotos).
    venue: { ...spec.venue, photo: null, court: null },
    streamLinks: spec.links ? [{ site: 'StreamEast', url: 'https://streameast.cool/' }] : [],
    note: null,
    situation: spec.situation ?? null,
    keyEvents: [],
    // So they show whichever choice the viewer makes on Welcome.
    topEvent: true,
    scoreline: null,
    espnUrl: spec.links ? 'https://www.espn.com/' : null,
  }
}

const logo = (league: string, team: string) => `https://a.espncdn.com/i/teamlogos/${league}/500/${team}.png`
const soccerLogo = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`
const eastern = 'America/New_York'

const specs: GameSpec[] = [
  {
    id: 'nfl-nyg', league: 'NFL', sport: 'Football', period: 2, clock: { kind: 'countdown', label: 'Q2', seconds: 151 }, startsIn: -60,
    home: { abbreviation: 'NYG', fullName: 'New York Giants', logoUrl: logo('nfl', 'nyg'), score: 10 },
    away: { abbreviation: 'WSH', fullName: 'Washington Commanders', logoUrl: logo('nfl', 'wsh'), score: 14 },
    venue: { name: 'MetLife Stadium', city: 'East Rutherford', region: 'New Jersey', country: 'USA', latitude: 40.8135, longitude: -74.0745, timeZone: eastern, espnId: '3839' },
  },
  {
    id: 'mlb-nyy', league: 'MLB', sport: 'Baseball', period: 6, phase: 'InningBottom', clock: { kind: 'fixed', line: 'Bot 6th' }, startsIn: -110,
    home: { abbreviation: 'NYY', fullName: 'New York Yankees', logoUrl: logo('mlb', 'nyy'), score: 4 },
    away: { abbreviation: 'BOS', fullName: 'Boston Red Sox', logoUrl: logo('mlb', 'bos'), score: 2 },
    venue: { name: 'Yankee Stadium', city: 'Bronx', region: 'New York', country: null, latitude: 40.8296, longitude: -73.9262, timeZone: eastern, espnId: '208' },
  },
  {
    id: 'nba-bkn', league: 'NBA', sport: 'Basketball', period: 2, clock: { kind: 'countdown', label: 'Q2', seconds: 384 }, startsIn: -35,
    home: { abbreviation: 'BKN', fullName: 'Brooklyn Nets', logoUrl: logo('nba', 'bkn'), score: 0 },
    away: { abbreviation: 'MIA', fullName: 'Miami Heat', logoUrl: logo('nba', 'mia'), score: 0 },
    venue: { name: 'Barclays Center', city: 'Brooklyn', region: 'New York', country: null, latitude: 40.6826, longitude: -73.9754, timeZone: eastern, espnId: '3559' },
  },
  {
    id: 'nhl-tor', league: 'NHL', sport: 'Hockey', period: 2, clock: { kind: 'countdown', label: '2nd', seconds: 484 }, startsIn: -50,
    home: { abbreviation: 'TOR', fullName: 'Toronto Maple Leafs', logoUrl: logo('nhl', 'tor'), score: 1 },
    away: { abbreviation: 'MTL', fullName: 'Montreal Canadiens', logoUrl: logo('nhl', 'mtl'), score: 1 },
    venue: { name: 'Scotiabank Arena', city: 'Toronto', region: 'Ontario', country: 'Canada', latitude: 43.6435, longitude: -79.3791, timeZone: 'America/Toronto', espnId: '1838' },
  },
  {
    id: 'mls-chi', league: 'MLS', sport: 'Soccer', period: 2, clock: { kind: 'minute', minute: 62 }, startsIn: -130,
    home: { abbreviation: 'CHI', fullName: 'Chicago Fire FC', logoUrl: soccerLogo(182), score: 2 },
    away: { abbreviation: 'CLB', fullName: 'Columbus Crew', logoUrl: soccerLogo(183), score: 0 },
    venue: { name: 'Soldier Field', city: 'Chicago, Illinois', region: null, country: 'USA', latitude: 41.8623, longitude: -87.6167, timeZone: 'America/Chicago', espnId: '1452' },
  },
  {
    id: 'nfl-pit', league: 'NFL', sport: 'Football', period: 3, clock: { kind: 'countdown', label: 'Q3', seconds: 372 }, startsIn: -95, links: true,
    home: { abbreviation: 'PIT', fullName: 'Pittsburgh Steelers', logoUrl: logo('nfl', 'pit'), score: 13, record: '6-3' },
    away: { abbreviation: 'BAL', fullName: 'Baltimore Ravens', logoUrl: logo('nfl', 'bal'), score: 17, record: '7-2' },
    situation: {
      lastPlay: 'J. Warren rush to the right for 6 yards to the BAL 38',
      downAndDistance: '2nd & 4 at BAL 38',
      possession: 'PIT',
      balls: null, strikes: null, outs: null, onFirst: false, onSecond: false, onThird: false,
    },
    venue: { name: 'Acrisure Stadium', city: 'Pittsburgh', region: 'Pennsylvania', country: 'USA', latitude: 40.4468, longitude: -80.0158, timeZone: eastern, espnId: '3752' },
  },
]
