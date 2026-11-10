// PROTOTYPE (throwaway) variant C, "Ticker": a broadcast lower third of one fixed, short height. The score bug
// stays put at the left (on a phone, on top); everything else (progress, sets, the whole leaderboard, every
// bout, the last score, venue, channels) is a row of chips that scrolls sideways. Never grows.
import { Fragment } from 'react'
import { boutLine, closeOnEscape, colorStyle, entrantPosition, panelFacts, type ScoreRow, type VariantProps } from './facts'
import { useScoredRow } from './hooks'
import { Mark, WatchAnchor } from './shared'

export function VariantC({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  const { scoreline, lastScore } = game
  return (
    <aside ref={panelRef} className="pp pp-c" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="pp-c__bug">
        <div className="pp-label pp-c__league" data-tooltip={game.league} data-tooltip-when-clipped>
          {game.league}
        </div>
        {facts.rows.map((row) => (
          <CRow key={row.key} row={row} />
        ))}
      </div>
      <div
        className="pp-c__rail"
        // A mouse wheel scrolls the chips sideways.
        onWheel={(event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY
        }}
      >
        {facts.progress && <span className="pp-c__chip pp-c__chip--color">{facts.progress}</span>}
        {scoreline?.sets.map((set) => (
          <span key={set.name} className="pp-c__chip">
            <span className="pp-muted">{set.name}</span> <span className="pp-strong">{set.score}</span>
            {set.winner && <span className="pp-muted"> {set.winner}</span>}
          </span>
        ))}
        {scoreline?.ending && <span className="pp-c__chip pp-strong">{scoreline.ending}</span>}
        {scoreline?.advanced && <span className="pp-c__chip">{scoreline.advanced} advances</span>}
        {lastScore && (
          <span className="pp-c__chip pp-c__chip--text" data-tooltip={`${lastScore.when ?? ''} ${lastScore.team}: ${lastScore.text}`.trim()}>
            <span className="pp-strong">
              {lastScore.when && `${lastScore.when} · `}
              {lastScore.team}
            </span>{' '}
            {lastScore.text}
          </span>
        )}
        {facts.field?.entries.map((entrant) => (
          <span key={entrant.name} className="pp-c__chip" data-tooltip={entrant.name}>
            <span className="pp-muted">{entrantPosition(entrant, facts.field!)}</span> {entrant.shortName}
            {entrant.score && <span className="pp-strong"> {entrant.score}</span>}
          </span>
        ))}
        {facts.bouts.map((bout) => {
          const line = boutLine(bout) || bout.weightClass
          return (
            <span key={bout.id} className={bout === facts.boutsShown ? 'pp-c__chip pp-c__chip--on' : 'pp-c__chip'} data-tooltip={`${bout.first.name} v ${bout.second.name}`}>
              <span className={bout.first.winner ? 'pp-strong' : undefined}>{bout.first.shortName}</span> v{' '}
              <span className={bout.second.winner ? 'pp-strong' : undefined}>{bout.second.shortName}</span>
              {line && <span className="pp-muted"> · {line}</span>}
            </span>
          )
        })}
        <span className="pp-c__chip pp-c__chip--text">
          <span className="pp-muted">{game.sport} at </span>
          {facts.mapsUrl ? (
            <a className="pp-plain-link" href={facts.mapsUrl} target="_blank" rel="noopener noreferrer">
              {facts.venueName}
            </a>
          ) : (
            facts.venueName
          )}
          {facts.place && <span className="pp-muted"> · {facts.place}</span>}
        </span>
        {facts.links.length === 0 && <span className="pp-c__chip pp-muted">No channels listed</span>}
        {facts.links.map((link, i) => (
          <Fragment key={`${link.name} ${link.url}`}>
            <span className="pp-c__chip">
              {i === 0 && <span className="pp-muted">Watch </span>}
              <WatchAnchor link={link} />
            </span>
          </Fragment>
        ))}
      </div>
      <button type="button" className="game-panel__close pp-close" onClick={onClose} aria-label="Close game panel">
        ×
      </button>
    </aside>
  )
}

function CRow({ row }: { row: ScoreRow }) {
  const ref = useScoredRow<HTMLDivElement>(row.scoredAt)
  return (
    <div ref={ref} className="pp-c__row">
      <Mark url={row.mark} />
      <span className="pp-c__name game-panel__team-name" data-tooltip={[row.before, row.name, row.after && `(${row.after})`].filter(Boolean).join(' ')}>
        {row.before && <span className="pp-muted">{row.before} </span>}
        {row.name}
      </span>
      {row.value && <span className="pp-c__value game-panel__team-score">{row.value}</span>}
    </div>
  )
}
