import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Game, GameTeam } from './game'
import { gameLabel, gameMatchup, matchesSearch } from './gameLabel'
import { moveByArrows } from '../menus/arrowKeys'
import { sidesTopFirst } from './sides'
import { TeamLogoImage } from './TeamLogoImage'
import type { PinnedCards } from './pinnedCards'
import { RailIcon } from '../rail/railIcons'

/**
 * The Events popover's list (see Rail): every filtered game, independent of the camera and of which pins
 * have joined a cluster, with a search to narrow it, which takes the cursor on opening where there's a
 * mouse (on a touch screen it waits for a tap, so the keyboard doesn't cover the list). The games are
 * grouped under their leagues, each a row of the two teams' logos and the matchup; a matchup cut short
 * shows in full in a tooltip on the list's left, clear of the rail. The arrow keys move from the search
 * down through the games and back (see moveByArrows); Tab leaves the list rather than stepping through it.
 */
/** A screen with a mouse or trackpad, not only touch, whose search can take the cursor at once. */
const finePointer = '(pointer: fine)'
const noPinnedGames: readonly string[] = []
const unpinnedGames = () => noPinnedGames
const noPinSubscription = () => () => {}

export function GameNavigation({ games, scoreCardPins, onSelect }: {
  games: readonly Game[]
  scoreCardPins?: PinnedCards
  onSelect: (gameId: string) => void
}) {
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const focusedGame = useRef<HTMLElement | null>(null)
  const movingPin = useRef<string | null>(null)
  const [query, setQuery] = useState('')
  const pinned = useSyncExternalStore(scoreCardPins?.subscribe ?? noPinSubscription, scoreCardPins?.games ?? unpinnedGames)
  useEffect(() => {
    if (window.matchMedia(finePointer).matches) search.current?.focus({ preventScroll: true })
  }, [])
  useLayoutEffect(() => {
    const moved = movingPin.current
    movingPin.current = null
    if (moved && document.activeElement === document.body && list.current) {
      const toggle = [...list.current.querySelectorAll<HTMLButtonElement>('[data-pin-game-id]')].find(button => button.dataset.pinGameId === moved)
      if (toggle) {
        toggle.focus()
        return
      }
    }
    // A filter or a feed removal took away the focused game: back to the search.
    if (focusedGame.current && !focusedGame.current.isConnected && document.activeElement === document.body) {
      search.current?.focus({ preventScroll: true })
    }
  })
  const found = games.filter((game) => matchesSearch(game, query))
  const pinnedIds = new Set(pinned)
  const pinnedFirst = found.filter(game => pinnedIds.has(game.id))
  const groups = byLeague(found).map(([league, games]) => ({
    key: `league:${league}`, title: league,
    games: games.filter(game => !pinnedIds.has(game.id)),
  })).filter(group => group.games.length)
  if (pinnedFirst.length) groups.unshift({ key: 'pinned', title: 'Pinned', games: pinnedFirst })
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
        aria-label="Search events"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <ul ref={list} aria-label="Events" onFocus={(event) => { focusedGame.current = event.target }}>
        {groups.flatMap(({ key, title, games }) => [
          <li key={key} className="game-navigation__league" role="presentation">{title}</li>,
          ...games.map((game) => (
            <li key={game.id} className="game-navigation__game">
              <button type="button" tabIndex={-1} data-game-id={game.id} aria-label={gameLabel(game)}
                data-tooltip={gameMatchup(game)} data-tooltip-side="left"
                data-tooltip-when-clipped=".game-navigation__matchup" onClick={() => onSelect(game.id)}>
                <Logos game={game} />
                <span className="game-navigation__matchup">{gameMatchup(game)}</span>
                <span className="game-navigation__chevron" aria-hidden="true">›</span>
              </button>
              {scoreCardPins && (
                <button type="button" className="game-navigation__pin" data-pin-game-id={game.id} aria-pressed={pinnedIds.has(game.id)}
                  aria-label={`Pin score card for ${gameMatchup(game)}`} onClick={(event) => {
                    if (event.currentTarget.matches(':focus-visible')) movingPin.current = game.id
                    scoreCardPins.toggle(game.id)
                  }}>
                  <RailIcon className="game-navigation__pin-icon">
                    <path d="M8 4h8l-1 7 3 4v1H6v-1l3-4L8 4ZM12 16v5" />
                  </RailIcon>
                </button>
              )}
            </li>
          )),
        ])}
        {found.length === 0 && (
          <li className="game-navigation__none">{games.length === 0 ? 'No events match your filters.' : 'No events match your search.'}</li>
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
  return <TeamLogoImage team={team} className="game-navigation__logo" markClassName="game-navigation__logo--none" />
}
