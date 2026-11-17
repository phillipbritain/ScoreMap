import { useState } from 'react'
import { logoFailed, logoMark, shownLogo } from './teamLogo'
import type { GameTeam } from './game'

/**
 * A team's logo, or with none, or once it fails to load, its mark (see logoMark) in a span with the
 * same class and `markClassName`, for the CSS to put on the logo's plate.
 */
export function TeamLogoImage({ team, className, markClassName }: { team: GameTeam; className?: string; markClassName: string }) {
  const [, setFailed] = useState<string | null>(null)
  const url = shownLogo(team.logoUrl)
  if (!url) return <span className={className ? `${className} ${markClassName}` : markClassName} aria-hidden="true">{logoMark(team.abbreviation)}</span>
  const failed = () => {
    logoFailed(url)
    setFailed(url)
  }
  return <img className={className} src={url} alt="" onError={failed} />
}
