import { describe, expect, it } from 'vitest'
import { loadingPhrases, pickPhrase, type PhraseScenario } from './loadingPhrases'

const scenarios = Object.keys(loadingPhrases) as PhraseScenario[]
const randoms = Array.from({ length: 20 }, (_, i) => i / 20).concat(0.999_999)
const shown = (scenario: PhraseScenario) => {
  const { phrases, hint } = loadingPhrases[scenario]
  return phrases.map((phrase) => (hint ? `${phrase} ${hint}` : phrase))
}

describe('pickPhrase', () => {
  it.each(scenarios)('picks one of the %s phrases, with its hint, whatever the roll', (scenario) => {
    for (const random of randoms) expect(shown(scenario)).toContain(pickPhrase(scenario, undefined, () => random))
  })

  it.each(scenarios)('has several %s phrases to pick between', (scenario) => {
    expect(new Set(randoms.map((random) => pickPhrase(scenario, undefined, () => random))).size).toBeGreaterThan(2)
  })

  it.each(scenarios)('never picks the %s phrase shown last', (scenario) => {
    for (const previous of shown(scenario)) {
      for (const random of randoms) expect(pickPhrase(scenario, previous, () => random)).not.toBe(previous)
    }
  })

  it('picks the only phrase again if a scenario has just one', () => {
    const onlyOne = { ...loadingPhrases, waking: { phrases: ['Only'] } }
    expect(pickPhrase('waking', 'Only', () => 0.5, onlyOne)).toBe('Only')
  })
})
