import { satelliteTile } from '../globe/globeStyle'
import { mapTypeNames, mapTypes, withMapType, type MapType, type ViewerSettings } from '../settings/viewerSettings'

/**
 * Display Settings' Map type: a small picture of each of the globe's map types side by side, Plain
 * and Satellite, its name under it, the one showing ringed in gold, as map apps' layer pickers are.
 * Picking one draws the globe as it.
 */
export function MapTypes({ settings, onChange, labelledBy }: { settings: ViewerSettings; onChange: (settings: ViewerSettings) => void; labelledBy: string }) {
  return (
    <div className="map-types" role="group" aria-labelledby={labelledBy}>
      {mapTypes.map((mapType) => (
        <button
          key={mapType}
          type="button"
          className="map-type"
          aria-pressed={settings.mapType === mapType}
          onClick={() => onChange(withMapType(settings, mapType))}
        >
          <MapPicture mapType={mapType} />
          {mapTypeNames[mapType]}
        </button>
      ))}
    </div>
  )
}

/**
 * A map type's picture: one tile of the satellite map's imagery, over Florida and the Caribbean; or,
 * for the plain map, its look drawn small: land between two seas, with coastlines, a border and a city.
 */
function MapPicture({ mapType }: { mapType: MapType }) {
  if (mapType === 'satellite') return <img className="map-type__picture" src={satelliteTile(3, 3, 2)} alt="" />
  return (
    <svg className="map-type__picture map-type__picture--plain" viewBox="0 0 64 64" aria-hidden="true">
      <path className="map-type__sea" d="M0 18c10 2 16-4 24 1s9 13 18 12 12-9 22-7V0H0zM0 44c9-3 14 4 22 2s12-10 20-8 13 9 22 6v20H0z" />
      <path className="map-type__coast" d="M0 18c10 2 16-4 24 1s9 13 18 12 12-9 22-7M0 44c9-3 14 4 22 2s12-10 20-8 13 9 22 6" />
      <path className="map-type__border" d="M33 21l-6 13 2 11" />
      <circle className="map-type__city" cx="44" cy="40" r="2" />
    </svg>
  )
}
