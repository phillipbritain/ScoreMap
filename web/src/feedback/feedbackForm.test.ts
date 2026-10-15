import { describe, expect, it } from 'vitest'
import { firstVisitSettings } from '../settings/viewerSettings'
import { feedbackContext, lengthCounter, lengthProblem, sendFeedback } from './feedbackForm'

const leagues = [
  { name: 'NFL', sport: 'Football' },
  { name: 'NBA', sport: 'Basketball' },
  { name: 'MLS', sport: 'Soccer' },
]

describe('lengthProblem', () => {
  it('asks for more under 10 characters, not counting space around them', () => {
    expect(lengthProblem(`   ${'a'.repeat(9)}   `)).toBe('Please write at least 10 characters')
    expect(lengthProblem('')).toBe('Please write at least 10 characters')
  })

  it('asks for less over 2,000 characters', () => {
    expect(lengthProblem('a'.repeat(2001))).toBe('Please keep it to 2,000 characters')
  })

  it('has nothing to say from 10 to 2,000', () => {
    expect(lengthProblem('a'.repeat(10))).toBeNull()
    expect(lengthProblem('a'.repeat(2000))).toBeNull()
  })
})

describe('lengthCounter', () => {
  it('shows nothing until the text nears the limit', () => {
    expect(lengthCounter('a'.repeat(1799))).toBeNull()
  })

  it('counts towards the limit near it, and past it', () => {
    expect(lengthCounter('a'.repeat(1800))).toEqual({ text: '1,800 / 2,000', over: false })
    expect(lengthCounter('a'.repeat(2001))).toEqual({ text: '2,001 / 2,000', over: true })
  })
})

describe('feedbackContext', () => {
  const view = { screen: { width: 1440, height: 900 }, phoneLayout: false, gameId: null, leagues, settings: firstVisitSettings }

  it('says the screen, the open game and the leagues switched on', () => {
    expect(
      feedbackContext({
        ...view,
        screen: { width: 390, height: 844 },
        phoneLayout: true,
        gameId: '401772',
        settings: { ...firstVisitSettings, hiddenLeagues: ['NBA'] },
      }),
    ).toEqual({ screenWidth: 390, screenHeight: 844, phoneLayout: true, gameId: '401772', leagues: ['NFL', 'MLS'], topEventsOnly: false })
  })

  it('says when only Top Events show', () => {
    expect(feedbackContext({ ...view, settings: { ...firstVisitSettings, topEventsOnly: true } }).topEventsOnly).toBe(true)
  })

  it('leaves the leagues out until they have loaded', () => {
    expect(feedbackContext({ ...view, leagues: [] }).leagues).toBeUndefined()
  })

  it('says when it comes from a demo', () => {
    expect(feedbackContext({ ...view, demo: true }).demo).toBe(true)
    expect(feedbackContext(view).demo).toBeUndefined()
  })
})

describe('sendFeedback', () => {
  const reply = (status: number, body: object) => async () => new Response(JSON.stringify(body), { status })

  it('posts the text, the context and the honeypot, and gives the issue link', async () => {
    const posted: RequestInit[] = []
    const result = await sendFeedback(
      { text: '  Lovely globe  ', website: '', context: { screenWidth: 1, screenHeight: 1, phoneLayout: false, topEventsOnly: false } },
      async (url, init) => {
        expect(url).toBe('/api/feedback')
        posted.push(init!)
        return new Response(JSON.stringify({ issueUrl: 'https://github.com/o/r/issues/300' }))
      },
    )

    expect(result).toEqual({ issueUrl: 'https://github.com/o/r/issues/300' })
    expect(posted[0].method).toBe('POST')
    expect(JSON.parse(posted[0].body as string)).toMatchObject({ text: 'Lovely globe', website: '' })
  })

  it('gives the server’s short error when it refuses', async () => {
    const result = await sendFeedback(
      { text: 'x', website: '', context: {} },
      reply(429, { error: 'Feedback is closed for today, try tomorrow' }),
    )
    expect(result).toEqual({ error: 'Feedback is closed for today, try tomorrow' })
  })

  it('gives an error of its own when the server says nothing useful', async () => {
    const result = await sendFeedback({ text: 'x', website: '', context: {} }, async () => new Response('Bad gateway', { status: 502 }))
    expect(result).toHaveProperty('error')
  })

  it('gives an error when the server can’t be reached', async () => {
    const result = await sendFeedback({ text: 'x', website: '', context: {} }, async () => {
      throw new TypeError('Failed to fetch')
    })
    expect(result).toHaveProperty('error')
  })
})
