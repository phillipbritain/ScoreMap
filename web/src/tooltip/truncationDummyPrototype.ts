// PROTOTYPE, throwaway: a made-up game for the truncation tap prototype (see TruncationTapPrototype).
import type { Game } from '../games/game'


/**
 * PROTOTYPE: in a local run (dev only), a made-up Live game in Lawrence, Kansas whose
 * every game panel line that can be cut off is too long for a phone: both team names (one ranked), the
 * progress line, the last score, the venue and its place.
 */
export function withTruncationDummy(games: Game[]): Game[] {
  if (!import.meta.env.DEV) return games
  return [...games, truncationDummy]
}

const truncationDummy: Game = {
  id: 'prototype-truncation-dummy',
  league: "NCAA Men's Basketball · Big Twelve and Southland Conference Challenge Series, Second Round",
  sport: 'Basketball',
  startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  status: 'Live',
  delayed: true,
  endTime: null,
  contest: {
    kind: 'sides',
    home: {
      abbreviation: 'KU',
      fullName: 'University of Kansas Jayhawks of the Big Twelve Conference',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2305.png',
      score: '64',
      rank: 12,
      record: '23-4',
      conference: null,
    },
    away: {
      abbreviation: 'SFA',
      fullName: 'Stephen F. Austin State University Lumberjacks',
      logoUrl: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2617.png',
      score: '61',
      rank: null,
      record: '19-9',
      conference: null,
    },
  },
  clock: '2nd Half 0:42 · Timeout Under Official Review of a Possible Flagrant Foul',
  period: 2,
  clutchTime: false,
  hot: false,
  venue: {
    name: 'Allen Fieldhouse at the James Naismith Court, Home of the University of Kansas Jayhawks Men\'s Basketball Program Since 1955',
    city: 'Lawrence, on the Kansas River in Douglas County, Forty Miles West of Downtown Kansas City in the Kansas City Metropolitan Area',
    region: 'Kansas',
    country: 'USA',
    latitude: 38.9543,
    longitude: -95.2525,
    timeZone: 'America/Chicago',
    photo: null,
    court: null,
  },
  streamLinks: [{ site: 'StreamEast', url: 'https://streameast.example' }],
  note: null,
  situation: null,
  lastScore: {
    team: 'KU',
    text: 'Hunter Dickinson makes a 26-foot step-back three point jumper from the left wing (Dajuan Harris Jr. assists)',
    when: 'H2 0:51',
  },
  keyEvents: [],
  topEvent: false,
  scoreline: null,
  espnUrl: 'https://www.espn.com',
}
