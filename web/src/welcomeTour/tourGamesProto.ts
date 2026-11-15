// PROTOTYPE, throw away: the welcome tour's own small fixed set of made-up games, in four variants
// picked with ?tourGamesProto=A|B|C|D (or [ and ] on the switcher). While the tour shows, the globe
// shows the variant's games, unfiltered by the viewer's settings, with the camera on them; once it's
// finished (and any panel opened from Click a score card is closed) real games (or the scenario) come
// back, the camera staying or flying back where it was, by variant.
import type { Camera } from '../globe/camera'
import type { Game, GameStatus } from '../games/game'

export type TourGamesVariant = 'A' | 'B' | 'C' | 'D'
export const tourGamesVariants: TourGamesVariant[] = ['A', 'B', 'C', 'D']

/** How the change to real games looks, once the tour's games go. */
export type Handoff = 'stay' | 'flyBack'

export interface TourGamesSet {
  name: string
  /** One line for the switcher bar. */
  summary: string
  games: Game[]
  camera: Camera
  /** On a phone the bottom sheet covers the lower half: the camera sits south so the cards show above it. */
  phoneCamera: Camera
  handoff: Handoff
}

export function tourGamesVariant(search: string): TourGamesVariant {
  const value = new URLSearchParams(search).get('tourGamesProto')?.toUpperCase()
  return tourGamesVariants.find((variant) => variant === value) ?? 'A'
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
  venue: { name: string; city: string; region?: string; country: string; latitude: number; longitude: number; timeZone: string }
  topEvent?: boolean
}

function made(spec: GameSpec): Game {
  const start = new Date(Date.now() + spec.startsIn * 60_000).toISOString()
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
    startTime: start,
    status: spec.status,
    delayed: false,
    endTime: spec.status === 'Final' ? new Date(Date.now() - 2 * 60_000).toISOString() : null,
    contest: { kind: 'sides', home: side(spec.home), away: side(spec.away) },
    clock: spec.clock ?? null,
    period: null,
    clutchTime: false,
    hot: false,
    venue: { ...spec.venue, region: spec.venue.region ?? null, photo: null, court: null },
    streamLinks: [],
    note: null,
    situation: null,
    lastScore: null,
    keyEvents: [],
    topEvent: spec.topEvent ?? true,
    scoreline: null,
    espnUrl: null,
  }
}

const logo = (league: string, team: string) => `https://a.espncdn.com/i/teamlogos/${league}/500/${team}.png`
const soccer = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`

const eastern = 'America/New_York'

/** A: three games in the northeastern US, one of each status; the camera stays when real games come. */
const northeast: TourGamesSet = {
  name: 'Three in the Northeast',
  summary: '3 games (Live NBA, Upcoming NHL, Final NFL) · Boston–New York–Philadelphia · camera stays',
  camera: { longitude: -73.6, latitude: 41.2, zoom: 5.6 },
  phoneCamera: { longitude: -73.2, latitude: 39.6, zoom: 5.2 },
  handoff: 'stay',
  games: [
    made({
      id: 'a-nba', league: 'NBA', sport: 'Basketball', status: 'Live', clock: 'Q3 4:12', startsIn: -80,
      home: { abbreviation: 'BOS', fullName: 'Boston Celtics', logoUrl: logo('nba', 'bos'), score: '88' },
      away: { abbreviation: 'PHI', fullName: 'Philadelphia 76ers', logoUrl: logo('nba', 'phi'), score: '84' },
      venue: { name: 'TD Garden', city: 'Boston', region: 'Massachusetts', country: 'USA', latitude: 42.3662, longitude: -71.0621, timeZone: eastern },
    }),
    made({
      id: 'a-nhl', league: 'NHL', sport: 'Hockey', status: 'Upcoming', startsIn: 20,
      home: { abbreviation: 'NYR', fullName: 'New York Rangers', logoUrl: logo('nhl', 'nyr') },
      away: { abbreviation: 'TOR', fullName: 'Toronto Maple Leafs', logoUrl: logo('nhl', 'tor') },
      venue: { name: 'Madison Square Garden', city: 'New York', region: 'New York', country: 'USA', latitude: 40.7505, longitude: -73.9934, timeZone: eastern },
    }),
    made({
      id: 'a-nfl', league: 'NFL', sport: 'Football', status: 'Final', clock: 'Final', startsIn: -200,
      home: { abbreviation: 'PHI', fullName: 'Philadelphia Eagles', logoUrl: logo('nfl', 'phi'), score: '27' },
      away: { abbreviation: 'DAL', fullName: 'Dallas Cowboys', logoUrl: logo('nfl', 'dal'), score: '20' },
      venue: { name: 'Lincoln Financial Field', city: 'Philadelphia', region: 'Pennsylvania', country: 'USA', latitude: 39.9008, longitude: -75.1675, timeZone: eastern },
    }),
  ],
}

/** B: five games around western Europe, in three sports; the camera flies back when real games come. */
const europe: TourGamesSet = {
  name: 'Five around Europe',
  summary: '5 games (soccer, rugby, Champions League) · London–Liverpool–Dublin–Paris–Madrid · flies back',
  camera: { longitude: -2.5, latitude: 48.3, zoom: 4.4 },
  phoneCamera: { longitude: -2.5, latitude: 44, zoom: 3.9 },
  handoff: 'flyBack',
  games: [
    made({
      id: 'b-epl-live', league: 'Premier League', sport: 'Soccer', status: 'Live', clock: "67'", startsIn: -75,
      home: { abbreviation: 'ARS', fullName: 'Arsenal', logoUrl: soccer(359), score: '2' },
      away: { abbreviation: 'CHE', fullName: 'Chelsea', logoUrl: soccer(363), score: '1' },
      venue: { name: 'Emirates Stadium', city: 'London', country: 'England', latitude: 51.5549, longitude: -0.1084, timeZone: 'Europe/London' },
    }),
    made({
      id: 'b-epl-final', league: 'Premier League', sport: 'Soccer', status: 'Final', clock: 'FT', startsIn: -120,
      home: { abbreviation: 'LIV', fullName: 'Liverpool', logoUrl: soccer(364), score: '3' },
      away: { abbreviation: 'MNC', fullName: 'Manchester City', logoUrl: soccer(382), score: '3' },
      venue: { name: 'Anfield', city: 'Liverpool', country: 'England', latitude: 53.4308, longitude: -2.9608, timeZone: 'Europe/London' },
    }),
    made({
      id: 'b-rugby', league: 'Six Nations', sport: 'Rugby', status: 'Upcoming', startsIn: 25,
      home: { abbreviation: 'IRE', fullName: 'Ireland', logoUrl: 'https://a.espncdn.com/i/teamlogos/rugby/teams/500/3.png' },
      away: { abbreviation: 'FRA', fullName: 'France', logoUrl: 'https://a.espncdn.com/i/teamlogos/rugby/teams/500/9.png' },
      venue: { name: 'Aviva Stadium', city: 'Dublin', country: 'Ireland', latitude: 53.3352, longitude: -6.2285, timeZone: 'Europe/Dublin' },
    }),
    made({
      id: 'b-ucl-paris', league: 'Champions League', sport: 'Soccer', status: 'Live', clock: "31'", startsIn: -35,
      home: { abbreviation: 'PSG', fullName: 'Paris Saint-Germain', logoUrl: soccer(160), score: '0' },
      away: { abbreviation: 'MUN', fullName: 'Bayern Munich', logoUrl: soccer(132), score: '1' },
      venue: { name: 'Parc des Princes', city: 'Paris', country: 'France', latitude: 48.8414, longitude: 2.253, timeZone: 'Europe/Paris' },
    }),
    made({
      id: 'b-ucl-madrid', league: 'Champions League', sport: 'Soccer', status: 'Live', clock: "HT", startsIn: -50,
      home: { abbreviation: 'RMA', fullName: 'Real Madrid', logoUrl: soccer(86), score: '1' },
      away: { abbreviation: 'INT', fullName: 'Internazionale', logoUrl: soccer(110), score: '1' },
      venue: { name: 'Santiago Bernabéu', city: 'Madrid', country: 'Spain', latitude: 40.4531, longitude: -3.6883, timeZone: 'Europe/Madrid' },
    }),
  ],
}

/** C: two games in one city, zoomed right in; the camera flies back out when real games come. */
const oneCity: TourGamesSet = {
  name: 'Two in one city',
  summary: '2 games (Live NBA, Upcoming MLB) · Los Angeles, zoomed in · flies back out',
  camera: { longitude: -118.255, latitude: 34.0, zoom: 11 },
  phoneCamera: { longitude: -118.255, latitude: 34.035, zoom: 10.6 },
  handoff: 'flyBack',
  games: [
    made({
      id: 'c-nba', league: 'NBA', sport: 'Basketball', status: 'Live', clock: 'Q2 7:45', startsIn: -40,
      home: { abbreviation: 'LAL', fullName: 'Los Angeles Lakers', logoUrl: logo('nba', 'lal'), score: '51' },
      away: { abbreviation: 'GS', fullName: 'Golden State Warriors', logoUrl: logo('nba', 'gs'), score: '48' },
      venue: { name: 'Crypto.com Arena', city: 'Los Angeles', region: 'California', country: 'USA', latitude: 34.043, longitude: -118.2673, timeZone: 'America/Los_Angeles' },
    }),
    made({
      id: 'c-mlb', league: 'MLB', sport: 'Baseball', status: 'Upcoming', startsIn: 15,
      home: { abbreviation: 'LAD', fullName: 'Los Angeles Dodgers', logoUrl: logo('mlb', 'lad') },
      away: { abbreviation: 'NYY', fullName: 'New York Yankees', logoUrl: logo('mlb', 'nyy') },
      venue: { name: 'Dodger Stadium', city: 'Los Angeles', region: 'California', country: 'USA', latitude: 34.0739, longitude: -118.24, timeZone: 'America/Los_Angeles' },
    }),
  ],
}

/**
 * D: six games over the eastern half of North America, three of them close together around New York
 * (a card cluster), the rest spread out; the camera stays when real games come.
 */
const clusterAndSpread: TourGamesSet = {
  name: 'A cluster and a spread',
  summary: '6 games, 3 clustered at New York, + Toronto, Chicago, Pittsburgh · 5 sports · camera stays',
  camera: { longitude: -81, latitude: 38, zoom: 4.8 },
  phoneCamera: { longitude: -79.5, latitude: 36.5, zoom: 3.8 },
  handoff: 'stay',
  games: [
    made({
      id: 'd-nfl', league: 'NFL', sport: 'Football', status: 'Live', clock: 'Q2 2:31', startsIn: -60,
      home: { abbreviation: 'NYG', fullName: 'New York Giants', logoUrl: logo('nfl', 'nyg'), score: '10' },
      away: { abbreviation: 'WSH', fullName: 'Washington Commanders', logoUrl: logo('nfl', 'wsh'), score: '14' },
      venue: { name: 'MetLife Stadium', city: 'East Rutherford', region: 'New Jersey', country: 'USA', latitude: 40.8135, longitude: -74.0745, timeZone: eastern },
    }),
    made({
      id: 'd-mlb', league: 'MLB', sport: 'Baseball', status: 'Live', clock: 'Bot 6th', startsIn: -110,
      home: { abbreviation: 'NYY', fullName: 'New York Yankees', logoUrl: logo('mlb', 'nyy'), score: '4' },
      away: { abbreviation: 'BOS', fullName: 'Boston Red Sox', logoUrl: logo('mlb', 'bos'), score: '2' },
      venue: { name: 'Yankee Stadium', city: 'Bronx', region: 'New York', country: 'USA', latitude: 40.8296, longitude: -73.9262, timeZone: eastern },
    }),
    made({
      id: 'd-nba', league: 'NBA', sport: 'Basketball', status: 'Upcoming', startsIn: 25,
      home: { abbreviation: 'BKN', fullName: 'Brooklyn Nets', logoUrl: logo('nba', 'bkn') },
      away: { abbreviation: 'MIA', fullName: 'Miami Heat', logoUrl: logo('nba', 'mia') },
      venue: { name: 'Barclays Center', city: 'Brooklyn', region: 'New York', country: 'USA', latitude: 40.6826, longitude: -73.9754, timeZone: eastern },
    }),
    made({
      id: 'd-nhl', league: 'NHL', sport: 'Hockey', status: 'Live', clock: '2nd 8:04', startsIn: -50,
      home: { abbreviation: 'TOR', fullName: 'Toronto Maple Leafs', logoUrl: logo('nhl', 'tor'), score: '1' },
      away: { abbreviation: 'MTL', fullName: 'Montreal Canadiens', logoUrl: logo('nhl', 'mtl'), score: '1' },
      venue: { name: 'Scotiabank Arena', city: 'Toronto', region: 'Ontario', country: 'Canada', latitude: 43.6435, longitude: -79.3791, timeZone: 'America/Toronto' },
    }),
    made({
      id: 'd-mls', league: 'MLS', sport: 'Soccer', status: 'Final', clock: 'FT', startsIn: -130,
      home: { abbreviation: 'CHI', fullName: 'Chicago Fire FC', logoUrl: soccer(182), score: '2' },
      away: { abbreviation: 'CLB', fullName: 'Columbus Crew', logoUrl: soccer(183), score: '0' },
      venue: { name: 'Soldier Field', city: 'Chicago', region: 'Illinois', country: 'USA', latitude: 41.8623, longitude: -87.6167, timeZone: 'America/Chicago' },
    }),
    made({
      id: 'd-nfl-pit', league: 'NFL', sport: 'Football', status: 'Upcoming', startsIn: 28,
      home: { abbreviation: 'PIT', fullName: 'Pittsburgh Steelers', logoUrl: logo('nfl', 'pit') },
      away: { abbreviation: 'BAL', fullName: 'Baltimore Ravens', logoUrl: logo('nfl', 'bal') },
      venue: { name: 'Acrisure Stadium', city: 'Pittsburgh', region: 'Pennsylvania', country: 'USA', latitude: 40.4468, longitude: -80.0158, timeZone: eastern },
    }),
  ],
}

export const tourGamesSets: Record<TourGamesVariant, TourGamesSet> = { A: northeast, B: europe, C: oneCity, D: clusterAndSpread }

/** The camera for the set on this screen: its phone camera at phone width. */
export function tourCamera(set: TourGamesSet): Camera {
  return window.matchMedia('(max-width: 640px)').matches ? set.phoneCamera : set.camera
}
