// PROTOTYPE (throwaway) variant E, "Floating card": a small card off the bottom strip altogether: on a phone at
// the top of the screen (under the local-run top rail, left of the rail), on a desktop in the bottom left
// corner. Just the score; the rest sits behind chip buttons (board, venue, watch), one popping open at a time
// under the card. The bottom of a phone screen, where the thumb is, stays all globe.
import { useState } from 'react'
import { Board, VenueBlock, WatchList } from './details'
import { boardLabel, closeOnEscape, colorStyle, panelFacts, type ScoreRow, type VariantProps } from './facts'
import { usePhone, useScoredRow } from './hooks'
import { Mark } from './shared'

type Drawer = 'board' | 'venue' | 'watch' | null

export function VariantE({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  const phone = usePhone()
  const label = boardLabel(game, facts)
  const [drawer, setDrawer] = useState<Drawer>(null)
  const toggle = (which: Drawer) => setDrawer(drawer === which ? null : which)
  return (
    <aside
      // At the top on a phone, so the globe isn't told about it (panelClearance assumes a bottom strip).
      ref={phone ? undefined : panelRef}
      className="pp pp-e"
      style={colorStyle(color, textOnColor)}
      aria-label="Game panel"
      onKeyDown={closeOnEscape(onClose)}
    >
      <div className="pp-e__card">
        <div className="pp-e__top">
          <span className="pp-label pp-e__league" data-tooltip={game.league} data-tooltip-when-clipped>
            {game.league}
          </span>
          {facts.progress && <span className="pp-e__progress">{facts.progress}</span>}
          <button type="button" className="game-panel__close pp-close" onClick={onClose} aria-label="Close game panel">
            ×
          </button>
        </div>
        {facts.rows.map((row) => (
          <ERow key={row.key} row={row} />
        ))}
        <div className="pp-e__chips">
          {label && (
            <button type="button" className="pp-e__chip" aria-pressed={drawer === 'board'} onClick={() => toggle('board')}>
              {label}
              {facts.field && ` · ${facts.field.entries.length}`}
              {facts.bouts.length > 0 && ` · ${facts.bouts.length}`}
            </button>
          )}
          <button type="button" className="pp-e__chip" aria-pressed={drawer === 'venue'} onClick={() => toggle('venue')}>
            <span className="pp-muted">At</span> {facts.place || facts.venueName}
          </button>
          <button type="button" className="pp-e__chip" aria-pressed={drawer === 'watch'} onClick={() => toggle('watch')}>
            Watch{facts.links.length > 0 && ` · ${facts.links.length}`}
          </button>
        </div>
      </div>
      {drawer && (
        <div className="pp-e__drawer">
          {drawer === 'board' && <Board game={game} facts={facts} />}
          {drawer === 'venue' && (
            <>
              <div className="pp-muted">{game.sport}</div>
              <VenueBlock facts={facts} />
              {facts.photo && <img className="pp-e__photo" src={facts.photo.url} alt="" data-tooltip={facts.photo.credit ?? undefined} />}
            </>
          )}
          {drawer === 'watch' && <WatchList facts={facts} />}
        </div>
      )}
    </aside>
  )
}

function ERow({ row }: { row: ScoreRow }) {
  const ref = useScoredRow<HTMLDivElement>(row.scoredAt)
  return (
    <div ref={ref} className="pp-e__row">
      <Mark url={row.mark} />
      <span className="pp-e__name game-panel__team-name" data-tooltip={[row.before, row.name, row.after && `(${row.after})`].filter(Boolean).join(' ')}>
        {row.before && <span className="pp-muted">{row.before} </span>}
        {row.name}
      </span>
      {row.value && <span className="pp-e__value game-panel__team-score">{row.value}</span>}
    </div>
  )
}
