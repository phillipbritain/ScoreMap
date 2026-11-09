import { satelliteCredit } from './globeStyle'

/**
 * The satellite map's credit, which EOX's licence asks for wherever its imagery shows (ADR-0022): at
 * the bottom left of the globe while the satellite map is on, with its links.
 */
export function MapCredit() {
  const { name, url, by, data } = satelliteCredit
  return (
    <p className="map-credit">
      <a href={url} target="_blank" rel="noreferrer">
        {name}
      </a>{' '}
      by {by} ({data})
    </p>
  )
}
