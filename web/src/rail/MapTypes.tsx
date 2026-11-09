import { mapTypeNames, mapTypes, withMapType, type MapType, type ViewerSettings } from '../settings/viewerSettings'

/**
 * The rail's Map Type popover: the globe's map types side by side, Plain and Satellite, the one
 * showing pressed. Picking one draws the globe as it, and closes the popover.
 */
export function MapTypes({ settings, onChange, onPicked }: { settings: ViewerSettings; onChange: (settings: ViewerSettings) => void; onPicked: () => void }) {
  const pick = (mapType: MapType) => {
    onChange(withMapType(settings, mapType))
    onPicked()
  }
  return (
    <div className="map-types" role="group" aria-label="Map type">
      {mapTypes.map((mapType) => (
        <button key={mapType} type="button" className="rail-chip" aria-pressed={settings.mapType === mapType} onClick={() => pick(mapType)}>
          {mapTypeNames[mapType]}
        </button>
      ))}
    </div>
  )
}
