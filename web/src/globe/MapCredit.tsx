import { satelliteCredit } from './globeStyle'

/**
 * The satellite map's credit, which EOX's licence asks for wherever its imagery shows (ADR-0022): at
 * the bottom left of the globe, with its links, while the satellite map is on (else hidden), and while
 * Map Type is open, which shows a picture of it (see the CSS).
 */
export function MapCredit({ hidden }: { hidden: boolean }) {
  const { name, url, by, data } = satelliteCredit
  return (
    <p className="map-credit" hidden={hidden}>
      <a href={url} target="_blank" rel="noreferrer">
        {name}
      </a>{' '}
      by {by} ({data})
    </p>
  )
}
