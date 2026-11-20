import type { Game, GameEntrant, GameTeam } from '../games/game'
import type { League } from '../settings/viewerSettings'
// ESPN historical scoreboards joined to coordinates from ScoreMap's venue catalogs; each venue as ESPN's scoreboard gives it.
import collegeExamples from './tourCollegeExamples.json'

type Venue = Pick<Game['venue'], 'name' | 'city' | 'region' | 'country' | 'latitude' | 'longitude'> & Partial<Pick<Game['venue'], 'espnId' | 'court'>>
type Team = Pick<GameTeam, 'abbreviation' | 'conference' | 'logoUrl'> & { name: string }
type SidesExample = { venue: Venue; teams: readonly Team[] }

const espn = 'https://a.espncdn.com/i/teamlogos'
const flag = (country: string) => `${espn}/countries/500/${country}.png`
const team = (abbreviation: string, name: string, logoPath: string): Team => ({
  abbreviation, name, logoUrl: `${espn}/${logoPath}.png`, conference: null,
})

/**
 * A venue as a real game's scoreboard gives it (its city, region and country ESPN's, the region in full as
 * the server sends it), with ESPN's id for it in the example's league where a real game there carries one.
 */
function venue(name: string, city: string, latitude: number, longitude: number, region: string | null = null, country: string | null = 'USA', espnId?: string): Venue {
  return { name, city, latitude, longitude, region, country, ...(espnId && { espnId }) }
}

const emirates = venue('Emirates Stadium', 'London', 51.555, -0.1086, null, 'England', '2267')
// ESPN gives a soccer venue's state in its city.
const hardRock = venue('Hard Rock Stadium', 'Miami Gardens, Florida', 25.958, -80.239, null, 'USA', '4643')
// An F1 race is at its circuit, which ESPN gives no state.
const miamiAutodrome = venue('Miami International Autodrome', 'Florida', 25.958, -80.239, null, 'USA', '4243')
// A tennis match's venue is its tournament, in the city ESPN gives, on its court.
const usOpen: Venue = { ...venue('US Open', 'New York, USA', 40.7499, -73.847, null, null), court: 'Arthur Ashe Stadium' }
const msg = venue('Madison Square Garden', 'New York', 40.7505, -73.9934, 'New York', 'USA', '1830')

// Real participants and venues drawn from ScoreMap's scenario catalog. The matchups and scores are simulated.
const sides: Record<string, SidesExample> = {
  WNBA: { venue: venue('Wintrust Arena', 'Chicago', 41.8538, -87.6215, 'Illinois', null, '5427'), teams: [
    team('CHI', 'Chicago Sky', 'wnba/500/chi'), team('ATL', 'Atlanta Dream', 'wnba/500/atl'),
  ] },
  'NCAA Baseball': { venue: venue('Charles Schwab Field', 'Omaha', 41.267, -95.932, 'Nebraska', null, '5051'), teams: [
    team('LSU', 'LSU Tigers', 'ncaa/500/99'), team('ARK', 'Arkansas Razorbacks', 'ncaa/500/8'),
  ] },
  'NCAA Softball': { venue: venue('OGE Energy Field at Devon Park', 'Oklahoma City', 35.527, -97.464, 'Oklahoma', null, '5006'), teams: [
    team('OU', 'Oklahoma Sooners', 'ncaa/500/201'), team('TEX', 'Texas Longhorns', 'ncaa/500/251'),
  ] },
  "NCAA Men's Hockey": { venue: venue('Agganis Arena', 'Boston', 42.352, -71.117, 'Massachusetts', 'USA', '990'), teams: [
    team('BU', 'Boston University Terriers', 'ncaa/500/104'), team('BC', 'Boston College Eagles', 'ncaa/500/103'),
  ] },
  'Premier League': { venue: emirates, teams: [
    team('ARS', 'Arsenal', 'soccer/500/359'), team('CHE', 'Chelsea', 'soccer/500/363'),
  ] },
  'Champions League': { venue: emirates, teams: [
    team('ARS', 'Arsenal', 'soccer/500/359'), team('BAY', 'Bayern Munich', 'soccer/500/132'),
  ] },
  'World Cup': { venue: hardRock, teams: [
    team('ARG', 'Argentina', 'countries/500/arg'), team('COL', 'Colombia', 'countries/500/col'),
  ] },
  IPL: { venue: venue('Wankhede Stadium', 'Mumbai', 18.9388, 72.8258, null, 'India'), teams: [
    team('MI', 'Mumbai Indians', 'cricket/500/335978'), team('CSK', 'Chennai Super Kings', 'cricket/500/335974'),
  ] },
  'Six Nations': { venue: venue('Aviva Stadium', 'Dublin', 53.3352, -6.2285, 'Ireland', null, '16102'), teams: [
    team('IRE', 'Ireland', 'rugby/teams/500/3'), team('FRA', 'France', 'rugby/teams/500/9'),
  ] },
  ATP: { venue: usOpen, teams: [
    team('J. Sinner', 'Jannik Sinner', 'countries/500/ita'), team('C. Alcaraz', 'Carlos Alcaraz', 'countries/500/esp'),
  ] },
  WTA: { venue: usOpen, teams: [
    team('C. Gauff', 'Coco Gauff', 'countries/500/usa'), team('I. Świątek', 'Iga Świątek', 'countries/500/pol'),
  ] },
}

function entrants(names: [string, string, string, string | null][]): GameEntrant[] {
  return names.map(([name, shortName, country, score], index) => ({ position: index + 1, name, shortName, flagUrl: flag(country), score, logoUrl: null }))
}

const fields: Record<string, { venue: Venue; note: string; clock: string; entries: GameEntrant[] }> = {
  'NASCAR Cup Series': {
    venue: venue('Daytona International Speedway', 'Daytona Beach', 29.1852, -81.0705, 'Florida', 'USA', '1'),
    note: 'Daytona 500', clock: 'Lap 42', entries: entrants([
      ['Chase Elliott', 'C. Elliott', 'usa', null], ['Christopher Bell', 'C. Bell', 'usa', null],
    ]),
  },
  'Formula 1': { venue: miamiAutodrome, note: 'Miami Grand Prix', clock: 'Lap 42', entries: entrants([
    ['Lando Norris', 'L. Norris', 'gbr', null], ['Oscar Piastri', 'O. Piastri', 'aus', null],
  ]) },
  'IndyCar Series': {
    venue: venue('Indianapolis Motor Speedway', 'Speedway', 39.795, -86.235, 'Indiana'),
    note: 'Indianapolis 500', clock: 'Lap 42', entries: entrants([
      ['Scott Dixon', 'S. Dixon', 'nzl', null], ['Josef Newgarden', 'J. Newgarden', 'usa', null],
    ]),
  },
  'PGA Tour': {
    venue: venue('Augusta National Golf Club', 'Augusta', 33.503, -82.023, 'Georgia', 'USA', '21'),
    note: 'Masters Tournament', clock: 'Round 2', entries: entrants([
      ['Scottie Scheffler', 'S. Scheffler', 'usa', '-4'], ['Rory McIlroy', 'R. McIlroy', 'nir', '-3'],
    ]),
  },
  'LPGA Tour': {
    venue: venue('Pelican Golf Club', 'Belleair', 27.939, -82.801, 'Florida', 'USA', '10955'),
    note: 'The ANNIKA at Pelican', clock: 'Round 2', entries: entrants([
      ['Lindy Duncan', 'L. Duncan', 'usa', '-4'], ['Carlota Ciganda', 'C. Ciganda', 'esp', '-3'],
    ]),
  },
}

const fighter = (name: string, shortName: string, country: string) => ({
  name, shortName, flagUrl: flag(country), record: null, winner: false,
})

export function leagueTourExample(league: League, conference: string | null, seed: Game): Game | null {
  const game: Game = {
    ...seed,
    id: `tour-example-${league.name}`,
    league: league.name,
    sport: league.sport,
    status: 'Live',
    endTime: null,
    clock: openingClock[league.sport] ?? null,
    period: null,
    note: null,
    situation: null,
    topEvent: false,
  }
  const at = (place: Venue): Game['venue'] => ({ ...place, timeZone: null, court: place.court ?? null, photo: null })
  const field = fields[league.name]
  if (field) return { ...game, venue: at(field.venue), note: field.note, clock: field.clock, contest: { kind: 'field', entries: field.entries } }
  if (league.name === 'UFC') return {
    ...game, venue: at(msg), clock: 'R1 2:30', note: 'UFC at Madison Square Garden',
    contest: { kind: 'bouts', bouts: [{
      id: 'tour-bout', first: fighter('Jim Miller', 'J. Miller', 'usa'), second: fighter('Damon Jackson', 'D. Jackson', 'usa'),
      weightClass: 'Lightweight', scheduledRounds: 3, status: 'Live', round: 1, clock: '2:30', method: null,
    }] },
  }
  const college = collegeExamples.find((choice) =>
    choice.league === league.name && (conference === null || conference === choice.conference))
  const sample = sides[league.name] ?? college
  if (!sample) return null
  const side = ({ name, ...team }: Team, score: string): GameTeam => ({
    ...team, fullName: name, score, rank: null, record: null,
  })
  const [homeScore, awayScore] = initialScores[league.sport] ?? ['0', '0']
  return {
    ...game,
    id: college ? `${game.id}-${college.conference}` : game.id,
    venue: at(sample.venue),
    clock: league.name === "NCAA Men's Basketball" ? '1st 6:24' : game.clock,
    contest: { kind: 'sides', home: side(sample.teams[0], homeScore), away: side(sample.teams[1], awayScore) },
  }
}

const initialScores: Record<string, [string, string]> = {
  Baseball: ['3', '2'],
  Basketball: ['37', '34'],
  Cricket: ['116/3', '161/6'],
  Football: ['10', '7'],
  Hockey: ['2', '1'],
  Rugby: ['10', '7'],
  Soccer: ['1', '0'],
}

const openingClock: Record<string, string> = {
  Baseball: 'Bot 5th',
  Basketball: 'Q2 6:24',
  Cricket: '13.2 ov',
  Football: 'Q2 6:24',
  Hockey: '2nd 8:04',
  Rugby: "54'",
  Soccer: "62'",
  Tennis: 'Set 1 · 0-0',
}
