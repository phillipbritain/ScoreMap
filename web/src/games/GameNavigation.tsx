import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Game, GameTeam } from './game'
import { gameLabel, gameMatchup, matchesSearch } from './gameLabel'
import { moveByArrows } from '../menus/arrowKeys'
import { sidesTopFirst } from './sides'
import { isPinned, onCardsPrototypeChange, togglePinned } from '../globe/cardsPrototype'

/**
 * The Games popover's list (see Rail): every filtered game, independent of the camera and of which pins
 * have joined a cluster, with a search to narrow it, which takes the cursor on opening where there's a
 * mouse (on a touch screen it waits for a tap, so the keyboard doesn't cover the list). The games are
 * grouped under their leagues, each a row of the two teams' logos and the matchup; a matchup cut short
 * shows in full in a tooltip on the list's left, clear of the rail. The arrow keys move from the search
 * down through the games and back (see moveByArrows); Tab leaves the list rather than stepping through it.
 */
/** A screen with a mouse or trackpad, not only touch, whose search can take the cursor at once. */
const finePointer = '(pointer: fine)'

export function GameNavigation({ games, onSelect }: {
  games: readonly Game[]
  onSelect: (gameId: string) => void
}) {
  const search = useRef<HTMLInputElement>(null)
  const focusedGame = useRef<HTMLElement | null>(null)
  const [query, setQuery] = useState('')
  // PROTOTYPE: redrawn as games are pinned.
  const [, redraw] = useState(0)
  useEffect(() => onCardsPrototypeChange(() => redraw((n) => n + 1)), [])
  useEffect(() => {
    if (window.matchMedia(finePointer).matches) search.current?.focus({ preventScroll: true })
  }, [])
  useLayoutEffect(() => {
    // A filter or a feed removal took away the focused game: back to the search.
    if (focusedGame.current && !focusedGame.current.isConnected && document.activeElement === document.body) {
      search.current?.focus({ preventScroll: true })
    }
  })
  const found = games.filter((game) => matchesSearch(game, query))
  return (
    <div
      className="game-navigation"
      data-tooltip-edge
      onKeyDown={(event) => moveByArrows(event.nativeEvent, event.currentTarget)}
    >
      <input
        ref={search}
        type="search"
        className="game-navigation__search"
        placeholder="Search teams, leagues, places"
        aria-label="Search games"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul aria-label="Games" onFocus={(event) => { focusedGame.current = event.target }}>
        {byLeague(found).map(([league, inLeague]) => [
          <li key={`league:${league}`} className="game-navigation__league" role="presentation">{league}</li>,
          ...inLeague.map((game) => (
            <li key={game.id} className="game-navigation__game">
              <button type="button" tabIndex={-1} data-game-id={game.id} aria-label={gameLabel(game)} onClick={() => onSelect(game.id)}>
                <Logos game={game} />
                <span className="game-navigation__matchup" data-tooltip={gameMatchup(game)} data-tooltip-side="left" data-tooltip-when-clipped>
                  {gameMatchup(game)}
                </span>
                <span className="game-navigation__chevron" aria-hidden="true">›</span>
              </button>
              {import.meta.env.DEV && (
                <button
                  type="button"
                  tabIndex={-1}
                  className="game-navigation__proto-pin"
                  aria-pressed={isPinned(game.id)}
                  aria-label={`${isPinned(game.id) ? 'Unpin' : 'Pin'} ${gameLabel(game)}`}
                  title={isPinned(game.id) ? 'Unpin: card shows only as usual' : 'Pin: card always shows'}
                  onClick={() => togglePinned(game.id)}
                >
                  📌
                </button>
              )}
            </li>
          )),
        ])}
        {found.length === 0 && (
          <li className="game-navigation__none">{games.length === 0 ? 'No games match your filters.' : 'No games match your search.'}</li>
        )}
      </ul>
    </div>
  )
}

/** The games grouped by league, each league where its first game comes. */
function byLeague(games: readonly Game[]): [string, Game[]][] {
  const leagues = new Map<string, Game[]>()
  for (const game of games) leagues.set(game.league, [...(leagues.get(game.league) ?? []), game])
  return [...leagues]
}

/** The two teams' logos, overlapping, top side first; an empty slot the same width for a game of any other kind. */
function Logos({ game }: { game: Game }) {
  if (game.contest.kind !== 'sides') return <span className="game-navigation__logos" />
  return (
    <span className="game-navigation__logos">
      {sidesTopFirst(game.sport, game.contest).map((team, i) => <Logo key={i} team={team} />)}
    </span>
  )
}

function Logo({ team }: { team: GameTeam }) {
  return team.logoUrl
    ? <img className="game-navigation__logo" src={team.logoUrl} alt="" />
    : <span className="game-navigation__logo game-navigation__logo--none">{team.abbreviation.slice(0, 1)}</span>
}
