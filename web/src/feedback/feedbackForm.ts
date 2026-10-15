import { isLeagueOn, type League, type ViewerSettings } from '../settings/viewerSettings'

// Served by the server (Feedback/FeedbackEndpoints.cs), which files the feedback as an issue.
const feedbackPath = '/api/feedback'

export const minLength = 10
export const maxLength = 2000
/** How long the text gets before the box shows a counter towards the limit. */
const counterFrom = 1800

/**
 * What the viewer was looking at, sent with their feedback for the issue's Context section. Mirrors
 * FeedbackContext in Feedback/FeedbackIssue.cs. Nothing says where the viewer is.
 */
export interface FeedbackContext {
  screenWidth?: number
  screenHeight?: number
  phoneLayout?: boolean
  /** The open game's ID, if a game panel is open. */
  gameId?: string | null
  /** The leagues switched on, by name; left out until the league list has loaded. */
  leagues?: string[]
  topEventsOnly?: boolean
}

export interface FeedbackSubmission {
  text: string
  /** The honeypot: a field hidden from people, so only a bot fills it in. */
  website: string
  context: FeedbackContext
}

/** A filed issue's link, or a short error to show under the box. */
export type FeedbackResult = { issueUrl: string } | { error: string }

/** Whether the text can be sent: 10 to 2,000 characters, as the server takes, not counting space around it. */
export function canSubmit(text: string): boolean {
  const length = text.trim().length
  return length >= minLength && length <= maxLength
}

/** The counter under the box once the text nears the limit ("1,850 / 2,000"), and whether it's over. */
export function lengthCounter(text: string): { text: string; over: boolean } | null {
  const length = text.trim().length
  if (length < counterFrom) return null
  return { text: `${length.toLocaleString('en')} / ${maxLength.toLocaleString('en')}`, over: length > maxLength }
}

export interface FeedbackView {
  screen: { width: number; height: number }
  phoneLayout: boolean
  gameId: string | null
  /** The configured leagues; empty until they load. */
  leagues: readonly League[]
  settings: ViewerSettings
}

/** The context sent with feedback, from what the viewer has open and on. */
export function feedbackContext({ screen, phoneLayout, gameId, leagues, settings }: FeedbackView): FeedbackContext {
  return {
    screenWidth: screen.width,
    screenHeight: screen.height,
    phoneLayout,
    gameId,
    leagues: leagues.length > 0 ? leagues.filter((league) => isLeagueOn(settings, league.name)).map((league) => league.name) : undefined,
    topEventsOnly: settings.topEventsOnly,
  }
}

/** Sends the feedback to the server, which files it; resolves to the issue's link or an error, never rejecting. */
export async function sendFeedback(submission: FeedbackSubmission, post: typeof fetch = fetch): Promise<FeedbackResult> {
  let response: Response
  try {
    response = await post(feedbackPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...submission, text: submission.text.trim() }),
    })
  } catch {
    return { error: 'Couldn’t send it, check your connection and try again' }
  }
  const reply = (await response.json().catch(() => null)) as Partial<{ issueUrl: string; error: string }> | null
  if (response.ok && reply?.issueUrl) return { issueUrl: reply.issueUrl }
  return { error: reply?.error ?? 'Couldn’t send it just now, try again later' }
}
