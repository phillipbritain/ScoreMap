// PROTOTYPE (throwaway) round 8, variant H, "Corners": G (today's panel, the photo behind the whole panel, no
// Sport, no Venue label) with the score section on the photo alone (no block, wash or slant of its own), the
// venue's name and place in the panel's top right corner, and the watch links in its bottom right corner.
// Reuses round 4's today-sized rows and photo backdrop (the tb classes in prototype.css).
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, VenuePhoto, WatchInline } from './strip'

export function VariantH({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside
      ref={panelRef}
      className="pp pp-strip tb tb--photo-under-score tc"
      style={colorStyle(color, textOnColor)}
      aria-label="Game panel"
      onKeyDown={closeOnEscape(onClose)}
    >
      <VenuePhoto facts={facts} className="tb__backdrop" />
      <div className="tc__grid">
        <div className="pp-label tc__league">{game.league}</div>
        <div className="tc__venue">
          <Venue facts={facts} />
        </div>
        <div className="tc__score">
          {facts.rows.map((row) => (
            <TeamRow key={row.key} row={row} prefix="tb" />
          ))}
          {facts.progress && <span className="pp-progress tb__progress">{facts.progress}</span>}
        </div>
        <InlineBoard game={game} facts={facts} prefix="tc" />
        <div className="tc__watch">
          <span className="pp-label">Watch</span> <WatchInline facts={facts} max={2} />
        </div>
      </div>
      <CloseButton onClose={onClose} />
    </aside>
  )
}
