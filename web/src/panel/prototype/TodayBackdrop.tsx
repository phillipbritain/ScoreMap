// PROTOTYPE (throwaway) round 4: today's panel (its sizes and arrangement) with round 3's photo backdrop (the
// venue photo filling the panel behind the details and band, in place of today's photo column), and no Sport.
// Three variants differ only in where the last score goes; see ./README.md.
import type { ReactNode } from 'react'
import type { Game } from '../../games/game'
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, VenuePhoto, WatchStacked } from './strip'

/**
 * Where the last score goes: in the band under the strip, as today ('band'); a third column beside venue and
 * watch ('column', where a leaderboard, fight card or sets go too, so there's no band at all); or in the score
 * block under the progress line ('score', other details staying in the band).
 */
type LastScorePlace = 'band' | 'column' | 'score'

interface Options {
  place: LastScorePlace
  /** Round 5: false leaves out the "Venue" label over the venue's name and place. */
  venueLabel?: boolean
  /** Round 5: true puts the photo behind the whole panel, the score block too, in place of its solid color. */
  photoUnderScore?: boolean
}

function TodayBackdrop({
  place,
  venueLabel = true,
  photoUnderScore = false,
  game,
  scorer,
  color,
  textOnColor,
  onClose,
  panelRef,
}: VariantProps & Options) {
  const facts = panelFacts(game, scorer)
  const band = place === 'band' || place === 'score'
  return (
    <aside
      ref={panelRef}
      className={`pp pp-strip tb tb--${place}${photoUnderScore ? ' tb--photo-under-score' : ''}`}
      style={colorStyle(color, textOnColor)}
      aria-label="Game panel"
      onKeyDown={closeOnEscape(onClose)}
    >
      <VenuePhoto facts={facts} className="tb__backdrop" />
      <div className="tb__main">
        <div className="tb__score">
          <div className="pp-label tb__league">{game.league}</div>
          {facts.rows.map((row) => (
            <TeamRow key={row.key} row={row} prefix="tb" />
          ))}
          {facts.progress && <span className="pp-progress tb__progress">{facts.progress}</span>}
          {place === 'score' && <ScoreBlockLastScore game={game} />}
        </div>
        <div className="tb__details">
          <Cell label={venueLabel ? 'Venue' : null}>
            <Venue facts={facts} />
          </Cell>
          <Cell label="Watch">
            <WatchStacked facts={facts} />
          </Cell>
          {place === 'column' && <InlineBoard game={game} facts={facts} prefix="tb-col" />}
        </div>
      </div>
      {band && <InlineBoard game={game} facts={facts} prefix="tb" lastScore={place === 'band'} />}
      <CloseButton onClose={onClose} />
    </aside>
  )
}

function Cell({ label, children }: { label: string | null; children: ReactNode }) {
  return (
    <div className="tb__cell">
      {label && <div className="pp-label">{label}</div>}
      {children}
    </div>
  )
}

/** The last score as a quiet line under the progress, two lines at most (in full on hover). */
function ScoreBlockLastScore({ game }: { game: Game }) {
  const { lastScore } = game
  if (!lastScore) return null
  return (
    <div className="pp-clamp tb__last" data-tooltip={`${lastScore.when ?? ''} ${lastScore.team}: ${lastScore.text}`.trim()}>
      <span className="pp-strong">
        {lastScore.when && `${lastScore.when} · `}
        {lastScore.team}
      </span>{' '}
      {lastScore.text}
    </div>
  )
}

/** A: today's panel with the photo backdrop, the last score in the band under it as today. */
export function VariantA(props: VariantProps) {
  return <TodayBackdrop place="band" {...props} />
}

/** B: as A, with the last score (or leaderboard, fight card, sets) as a third column in the strip; no band. */
export function VariantB(props: VariantProps) {
  return <TodayBackdrop place="column" {...props} />
}

/** C: as A, with the last score in the score block under the progress line. */
export function VariantC(props: VariantProps) {
  return <TodayBackdrop place="score" {...props} />
}

/** D (round 5): A without the "Venue" label; the venue's name and place still show. */
export function VariantD(props: VariantProps) {
  return <TodayBackdrop place="band" venueLabel={false} {...props} />
}

/** E (round 5): D with the photo behind the whole panel, the score block too, in place of its solid color. */
export function VariantE(props: VariantProps) {
  return <TodayBackdrop place="band" venueLabel={false} photoUnderScore {...props} />
}
