// PROTOTYPE (throwaway) variant D, "Tabs": one fixed-height card. The score is always shown; below it (on a
// desktop, beside it) one tab at a time: the contest's board (leaderboard, fight card, sets or last score),
// Venue or Watch. The height never changes with the content; a long tab scrolls inside itself.
import { useState } from 'react'
import { Board, VenueBlock, WatchList } from './details'
import { boardLabel, closeOnEscape, colorStyle, panelFacts, type ScoreRow, type VariantProps } from './facts'
import { useScoredRow } from './hooks'
import { Mark } from './shared'

type Tab = 'board' | 'venue' | 'watch'

export function VariantD({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  const label = boardLabel(game, facts)
  // Per game, so another game opens on its own first tab.
  const [picked, setPicked] = useState<{ game: string; tab: Tab } | null>(null)
  const tab: Tab = picked?.game === game.id ? picked.tab : label ? 'board' : 'venue'
  const tabs: [Tab, string][] = [
    ...(label ? ([['board', label]] as [Tab, string][]) : []),
    ['venue', 'Venue'],
    ['watch', facts.links.length > 0 ? `Watch (${facts.links.length})` : 'Watch'],
  ]
  return (
    <aside ref={panelRef} className="pp pp-d" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      <div className="pp-d__score">
        <div className="pp-d__top">
          <span className="pp-label">{game.league}</span>
          {facts.progress && <span className="pp-d__progress">{facts.progress}</span>}
        </div>
        {facts.rows.map((row) => (
          <DRow key={row.key} row={row} />
        ))}
      </div>
      <div className="pp-d__tabs-area">
        <div className="pp-d__tabs" role="tablist">
          {tabs.map(([key, name]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className="pp-d__tab" onClick={() => setPicked({ game: game.id, tab: key })}>
              {name}
            </button>
          ))}
          <button type="button" className="game-panel__close pp-close" onClick={onClose} aria-label="Close game panel">
            ×
          </button>
        </div>
        <div className="pp-d__content" role="tabpanel">
          {tab === 'board' && <Board game={game} facts={facts} />}
          {tab === 'venue' && (
            <div className="pp-d__venue">
              {facts.photo && <img src={facts.photo.url} alt="" data-tooltip={facts.photo.credit ?? undefined} />}
              <div>
                <div className="pp-muted">{game.sport}</div>
                <VenueBlock facts={facts} />
              </div>
            </div>
          )}
          {tab === 'watch' && <WatchList facts={facts} />}
        </div>
      </div>
    </aside>
  )
}

function DRow({ row }: { row: ScoreRow }) {
  const ref = useScoredRow<HTMLDivElement>(row.scoredAt)
  return (
    <div ref={ref} className="pp-d__row">
      <Mark url={row.mark} />
      <span className="pp-d__name game-panel__team-name" data-tooltip={[row.before, row.name, row.after && `(${row.after})`].filter(Boolean).join(' ')} data-tooltip-when-clipped>
        {row.before && <span className="pp-muted">{row.before} </span>}
        {row.name}
      </span>
      {row.after && <span className="pp-muted pp-d__record">{row.after}</span>}
      {row.value && <span className="pp-d__value game-panel__team-score">{row.value}</span>}
    </div>
  )
}
