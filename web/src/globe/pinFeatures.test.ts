import { describe, expect, it } from 'vitest'
import type { Game } from '../games/game'
import { firstVisitSettings, withSportColour } from '../settings/viewerSettings'
import builtIn from '../theme/builtInTheme.json'
import { resolveTheme, type Theme } from '../theme/theme'
import { pinFeatures } from './pinFeatures'

/** The built-in theme, with Live's colour and its pins' core each a colour of its own. */
function testTheme(): Theme {
  const json = structuredClone(builtIn) as Record<string, any>
  json.palette.live.main = '#ff0000'
  json.components.Pin.live.core.color = '#ffcccc'
  const result = resolveTheme(json)
  if (!result.ok) throw new Error(result.problems.join('\n'))
  return result.theme
}

const theme = testTheme()
const noColours = firstVisitSettings

const arrowhead: Game = {
  id: '401',
  league: 'NFL',
  sport: 'Football',
  startTime: '2026-10-04T17:00:00+00:00',
  status: 'Live',
  delayed: false,
  disruption: null,
  endTime: null,
  home: { abbreviation: 'KC', fullName: 'Kansas City Chiefs', logoUrl: null, score: 21 },
  away: { abbreviation: 'BUF', fullName: 'Buffalo Bills', logoUrl: null, score: 17 },
  clock: '4:12',
  period: 3,
  clutchTime: false,
  venue: {
    name: 'GEHA Field at Arrowhead Stadium',
    city: 'Kansas City',
    country: 'USA',
    latitude: 39.0489,
    longitude: -94.4839,
    timeZone: 'America/Chicago',
    photo: null,
  },
  broadcasters: [{ name: 'CBS', country: 'US', watchUrl: null }],
  streamLinks: [],
}

describe('pinFeatures', () => {
  it('places one pin per game at its venue, longitude first', () => {
    const collection = pinFeatures([arrowhead], noColours, theme)

    expect(collection).toEqual({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: '401',
          geometry: { type: 'Point', coordinates: [-94.4839, 39.0489] },
          properties: { gameId: '401', status: 'Live', color: '#ff0000', coreColor: '#ffcccc' },
        },
      ],
    })
  })

  it('gives games at the same venue pins of their own, both exactly at the venue', () => {
    const [first, second] = pinFeatures([arrowhead, { ...arrowhead, id: '402' }], noColours, theme).features

    expect(first.properties.gameId).toBe('401')
    expect(second.properties.gameId).toBe('402')
    expect(first.geometry.coordinates).toEqual([-94.4839, 39.0489])
    expect(second.geometry.coordinates).toEqual([-94.4839, 39.0489])
  })

  it("colours a pin, core and all, in the colour the viewer picked for its game's sport", () => {
    const colours = withSportColour(firstVisitSettings, 'Football', '#123456')

    expect(pinFeatures([arrowhead], colours, theme).features[0].properties).toMatchObject({
      color: '#123456',
      coreColor: '#123456',
    })
  })
})
