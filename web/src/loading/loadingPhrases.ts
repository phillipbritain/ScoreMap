import { useEffect, useMemo } from 'react'

/**
 * Each thing the loading screen or cut-off note can say under its rocket (see GLOSSARY.md "Loading
 * screen"), as a playful space phrase picked at random each time it's shown.
 */
export type PhraseScenario = 'loading' | 'cutOff' | 'slowDrawing' | 'waking' | 'styleError' | 'constructionError'

interface ScenarioPhrases {
  /** One of these is shown, picked at random. Each must still say what's happening. */
  phrases: readonly string[]
  /** Plain advice after whichever phrase is picked, so an error still says how to recover. */
  hint?: string
}

/** The phrases, by scenario: edit them here. */
export const loadingPhrases: Record<PhraseScenario, ScenarioPhrases> = {
  // Loading as usual, for the first 10 seconds of each stage of the first load.
  loading: {
    phrases: [
      'Traveling to space…',
      'Preparing for liftoff…',
      'Counting down to launch…',
      'Fueling up the rocket…',
      'Climbing into orbit…',
      'Blasting off…',
      'Leaving the launch pad…',
      'Riding the rocket to ScoreMap…',
    ],
  },
  // Can't reach the server, while loading or after a drop, for 10 seconds or more; still trying.
  cutOff: {
    phrases: [
      'Houston, we have a problem. Still trying to reach ScoreMap…',
      'Lost contact with mission control. Trying again…',
      'Signal lost somewhere past the Moon. Reconnecting…',
      'Ground control isn’t answering. Still calling…',
      'Our radio’s crackling. Still trying to reach ScoreMap…',
      'Drifted out of range. Steering back to ScoreMap…',
    ],
  },
  // The globe has been drawing for 10 seconds or more on first load.
  slowDrawing: {
    phrases: [
      'Charting the stars. The map is taking a while…',
      'Still drawing the globe from orbit…',
      'Mapping a whole planet takes a moment. Nearly there…',
      'Unfolding the star chart. The map is slow today…',
      'Plotting the course. The map is still loading…',
    ],
  },
  // Waking up after being asleep, until the current games arrive.
  waking: {
    phrases: [
      'Waking up the crew…',
      'Warming up the engines…',
      'Rise and shine, astronauts…',
      'Back from hypersleep…',
      'Powering up the cockpit…',
    ],
  },
  // The map's style failed to load; a Try again button follows.
  styleError: {
    phrases: [
      'Houston, we have a problem: the map didn’t make it.',
      'Mission control lost the map.',
      'Launch scrubbed: the map couldn’t load.',
      'The map drifted off into deep space.',
    ],
    hint: 'Check your connection and try again.',
  },
  // The browser couldn't create the globe (no WebGL); a Try again button follows.
  constructionError: {
    phrases: [
      'The engines won’t fire: the globe couldn’t start.',
      'Failure to launch. The globe couldn’t start.',
      'Stuck on the launch pad: the globe couldn’t start.',
      'Houston, the globe won’t start.',
    ],
    hint: 'Check that WebGL is enabled in your browser, then try again.',
  },
}

/**
 * A phrase for the scenario, picked at random (random gives a number from 0 up to 1, as Math.random
 * does), never the one shown last for it unless it has only one; with its hint after it, if it has one.
 */
export function pickPhrase(
  scenario: PhraseScenario,
  previous: string | undefined,
  random: () => number = Math.random,
  phrases: Record<PhraseScenario, ScenarioPhrases> = loadingPhrases,
): string {
  const { phrases: all, hint } = phrases[scenario]
  const withHint = (phrase: string) => (hint ? `${phrase} ${hint}` : phrase)
  const choices = all.length > 1 ? all.filter((phrase) => withHint(phrase) !== previous) : all
  return withHint(choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))])
}

/** The phrase last shown for each scenario, so the next showing picks another. */
const lastShown = new Map<PhraseScenario, string>()

/**
 * The phrase to show for the scenario (null for none): picked once each time the scenario starts, and
 * kept while it lasts, so it doesn't change on every render.
 */
export function usePhrase(scenario: PhraseScenario | null): string | null {
  // Picked from what was last shown, not last picked, so a pick React throws away doesn't count.
  const phrase = useMemo(() => (scenario ? pickPhrase(scenario, lastShown.get(scenario)) : null), [scenario])
  useEffect(() => {
    if (scenario && phrase) lastShown.set(scenario, phrase)
  }, [scenario, phrase])
  return phrase
}
