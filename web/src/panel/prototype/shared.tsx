// PROTOTYPE (throwaway): game panel layout variants, see ./README.md. Not production code: no tests, no polish.
// Small components the variants share.
import type { PanelLink } from './facts'

/** A logo or flag on its plate; an empty space with no plate when missing. */
export function Mark({ url, className = 'pp-mark' }: { url: string | null; className?: string }) {
  return url ? <img className={className} src={url} alt="" /> : <span className={`${className} ${className}--none`} />
}

/** A link opening in a new tab, nofollow for unofficial streams. */
export function WatchAnchor({ link }: { link: PanelLink }) {
  if (!link.url) return <>{link.name}</>
  return (
    <a href={link.url} target="_blank" rel={link.unofficial ? 'noopener noreferrer nofollow' : 'noopener noreferrer'}>
      {link.name}
      {link.unofficial && <span className="pp-muted"> · unofficial</span>}
    </a>
  )
}

