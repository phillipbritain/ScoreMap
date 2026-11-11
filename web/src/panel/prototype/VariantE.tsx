// PROTOTYPE (throwaway) round 2, variant E, "Info ribbon": today's sport, venue and watch columns become one
// thin ribbon across the top (with the league and progress), and the photo fades in behind the right of the
// panel; under the ribbon, the score block and the contest details side by side.
import { closeOnEscape, colorStyle, panelFacts, type VariantProps } from './facts'
import { CloseButton, InlineBoard, TeamRow, Venue, WatchInline } from './strip'

export function VariantE({ game, scorer, color, textOnColor, onClose, panelRef }: VariantProps) {
  const facts = panelFacts(game, scorer)
  return (
    <aside ref={panelRef} className="pp pp-strip pe" style={colorStyle(color, textOnColor)} aria-label="Game panel" onKeyDown={closeOnEscape(onClose)}>
      {facts.photo && <img className="pe__photo" src={facts.photo.url} alt="" />}
      <div className="pe__ribbon">
        <span className="pe__league">{game.league}</span>
        {facts.progress && <span className="pp-progress">{facts.progress}</span>}
        <span className="pe__info">
          <span className="pp-muted">{game.sport} · </span>
          <Venue facts={facts} separator=" · " />
        </span>
        <span className="pe__info">
          <span className="pp-muted">Watch </span>
          <WatchInline facts={facts} max={2} />
        </span>
        <CloseButton onClose={onClose} />
      </div>
      <div className="pe__main">
        <div className="pe__score">
          {facts.rows.map((row) => (
            <TeamRow key={row.key} row={row} prefix="pe" />
          ))}
        </div>
        <InlineBoard game={game} facts={facts} prefix="pe" />
      </div>
    </aside>
  )
}
