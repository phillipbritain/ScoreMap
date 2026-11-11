// PROTOTYPE (throwaway): pieces the round-2 variants share (layout updates of today's panel, see ./README.md).
// Each variant arranges and sizes them its own way through its CSS prefix.
import { useState, type ReactNode } from 'react'
import type { Game } from '../../games/game'
import { boutLine, entrantPosition, type PanelFacts, type ScoreRow } from './facts'
import { useScoredRow } from './hooks'
import { Mark, WatchAnchor } from './shared'

/** A team, entrant or bout side: mark, rank or position, full name (wrapping), record, score. */
export function TeamRow({ row, prefix, record = true }: { row: ScoreRow; prefix: string; record?: boolean }) {
  const ref = useScoredRow<HTMLDivElement>(row.scoredAt)
  return (
    <div ref={ref} className={`${prefix}__row`}>
      <Mark url={row.mark} />
      <span className={`${prefix}__name game-panel__team-name`}>
        {row.before && <span className="pp-muted">{row.before} </span>}
        {row.name}
      </span>
      {record && row.after && <span className={`pp-muted ${prefix}__record`}>{row.after}</span>}
      {row.value && <span className={`${prefix}__value game-panel__team-score`}>{row.value}</span>}
    </div>
  )
}

/** How many of a field show until "Show all", as today's band. */
const leaderboardLength = 10

/**
 * The contest's details, flowing inline as today's band does: a field's leaderboard, a fight card's bouts, a
 * tennis match's sets, or the last score. Empty when there's nothing.
 */
export function InlineBoard({
  game,
  facts,
  prefix,
  labels = true,
  lastScore: showLastScore = true,
}: {
  game: Game
  facts: PanelFacts
  prefix: string
  labels?: boolean
  /** False where the variant shows the last score elsewhere. */
  lastScore?: boolean
}) {
  const [all, setAll] = useState(false)
  const { field, bouts } = facts
  const { scoreline, lastScore } = game
  if (field) {
    const shown = all ? field.entries : field.entries.slice(0, leaderboardLength)
    return (
      <div className={`${prefix}__board`}>
        {labels && <div className="pp-label">Leaderboard</div>}
        <ol className="pp-flow">
          {shown.map((entrant) => (
            <li key={entrant.name} data-tooltip={entrant.name}>
              <span className="pp-muted">{entrantPosition(entrant, field)}</span> {entrant.shortName}
              {entrant.score && <span className="pp-strong"> {entrant.score}</span>}
            </li>
          ))}
          {field.entries.length > leaderboardLength && (
            <li>
              <button type="button" className="pp-text-button" onClick={() => setAll(!all)}>
                {all ? `Top ${leaderboardLength}` : `Show all ${field.entries.length}`}
              </button>
            </li>
          )}
        </ol>
      </div>
    )
  }
  if (bouts.length > 0)
    return (
      <div className={`${prefix}__board`}>
        {labels && <div className="pp-label">Fight card</div>}
        <ol className="pp-flow">
          {bouts.map((bout) => {
            const line = boutLine(bout) || bout.weightClass
            return (
              <li key={bout.id} className={bout === facts.boutsShown ? 'pp-flow__on' : undefined} data-tooltip={`${bout.first.name} v ${bout.second.name}`}>
                <span className={bout.first.winner ? 'pp-strong' : undefined}>{bout.first.shortName}</span> v{' '}
                <span className={bout.second.winner ? 'pp-strong' : undefined}>{bout.second.shortName}</span>
                {line && <span className="pp-muted"> · {line}</span>}
              </li>
            )
          })}
        </ol>
      </div>
    )
  if (scoreline)
    return (
      <div className={`${prefix}__board`}>
        <div className="pp-flow">
          {scoreline.sets.map((set) => (
            <span key={set.name} className="pp-set-pill">
              {[set.name, set.score, set.winner].filter(Boolean).join(' · ')}
            </span>
          ))}
          {scoreline.ending && <span className="pp-strong">{scoreline.ending}</span>}
          {scoreline.advanced && <span>{scoreline.advanced} advances</span>}
        </div>
      </div>
    )
  if (lastScore && showLastScore)
    return (
      <div className={`${prefix}__board`}>
        {labels && <div className="pp-label">Last score</div>}
        <div className="pp-clamp" data-tooltip={`${lastScore.when ?? ''} ${lastScore.team}: ${lastScore.text}`.trim()}>
          <span className="pp-strong">
            {lastScore.when && `${lastScore.when} · `}
            {lastScore.team}
          </span>{' '}
          {lastScore.text}
        </div>
      </div>
    )
  return null
}

/** The venue (a Maps link) and its place. */
export function Venue({ facts, separator }: { facts: PanelFacts; separator?: string }) {
  const name = facts.mapsUrl ? (
    <a className="pp-plain-link" href={facts.mapsUrl} target="_blank" rel="noopener noreferrer">
      {facts.venueName}
    </a>
  ) : (
    facts.venueName
  )
  const place =
    facts.place &&
    (facts.placeUrl ? (
      <a className="pp-plain-link" href={facts.placeUrl} target="_blank" rel="noopener noreferrer">
        {facts.place}
      </a>
    ) : (
      facts.place
    ))
  if (separator)
    return (
      <span>
        {name}
        {place && <span className="pp-muted">{separator}{place}</span>}
      </span>
    )
  return (
    <div>
      <div>{name}</div>
      {place && <div className="pp-muted">{place}</div>}
    </div>
  )
}

/** The first few watch links inline, the rest folded into "+N" (named on hover). */
export function WatchInline({ facts, max = 3 }: { facts: PanelFacts; max?: number }) {
  if (facts.links.length === 0) return <span className="pp-muted">No channels listed</span>
  const listed = facts.links.slice(0, max)
  const folded = facts.links.slice(max)
  return (
    <span className="pp-watch-inline">
      {listed.map((link, i) => (
        <span key={`${link.name} ${link.url}`}>
          {i > 0 && ', '}
          <WatchAnchor link={link} />
        </span>
      ))}
      {folded.length > 0 && (
        <span className="pp-muted" data-tooltip={folded.map((link) => link.name).join(', ')}>
          {' '}
          +{folded.length}
        </span>
      )}
    </span>
  )
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="game-panel__close pp-close" onClick={onClose} aria-label="Close game panel">
      ×
    </button>
  )
}

/**
 * The venue photo (round 3: every variant shows it), its credit on hover; a faint glow holds its place when the
 * venue has none or it fails to load, as today. Anything passed in lies over it (such as the venue's name).
 */
export function VenuePhoto({ facts, className, children }: { facts: PanelFacts; className: string; children?: ReactNode }) {
  const [broken, setBroken] = useState<string | null>(null)
  const photo = facts.photo && facts.photo.url !== broken ? facts.photo : null
  return (
    <figure className={photo ? `pp-photo ${className}` : `pp-photo pp-photo--none ${className}`}>
      {photo && <img src={photo.url} alt="" onError={() => setBroken(photo.url)} />}
      {photo?.credit && <figcaption className="pp-photo__credit">{photo.credit}</figcaption>}
      {children}
    </figure>
  )
}

/** The watch links one per line, as today's panel lists them: the first three, the rest as "+N more" (named on hover). */
export function WatchStacked({ facts }: { facts: PanelFacts }) {
  if (facts.links.length === 0) return <div className="pp-muted">No channels listed</div>
  const listed = facts.links.slice(0, 3)
  const folded = facts.links.slice(3)
  return (
    <ul className="pp-watch-stack">
      {listed.map((link) => (
        <li key={`${link.name} ${link.url}`}>
          <WatchAnchor link={link} />
        </li>
      ))}
      {folded.length > 0 && (
        <li className="pp-muted" data-tooltip={folded.map((link) => link.name).join(', ')}>
          +{folded.length} more
        </li>
      )}
    </ul>
  )
}
