import { useEffect, useState } from 'react'
import { saveBehaviour, type Behaviour, type Overlays } from './behaviour'
// The theme tuner's plain look, so the two tools read as one.
import '../themeTuner/themeTuner.css'

/** A number the tuner can change, and where it lives in the app's settings files. */
interface NumberSetting {
  group: string
  name: string
  /** What it controls, shown on hovering its name. */
  description: string
  /** The settings file and key it's kept in, for copying the changes into. */
  file: string
  key: string
  range: { min: number; max: number; step: number }
  /** What can be drawn on the globe to show it at work, with a switch to show it, if anything. */
  overlay?: { key: keyof Overlays; label: string }
  get: (behaviour: Behaviour) => number
  set: (behaviour: Behaviour, value: number) => Behaviour
}

const settings: readonly NumberSetting[] = [
  {
    group: 'City labels',
    name: 'Reach (km)',
    description:
      'How far a city may be from a game and still be the city it is labelled by. Each game gets the most ' +
      'populous Small city within this reach, unless a city label is already that close; a game with no listed ' +
      'city within reach gets none. Bigger: fewer Small city labels, and games named by cities further away. ' +
      'Big cities are labelled anyway (see docs/city-labels.md).',
    file: 'web/src/globe/cityLabelSettings.json',
    key: 'gameCityKm',
    range: { min: 10, max: 300, step: 5 },
    overlay: { key: 'gameCityReach', label: "Ring each game at its reach" },
    get: (behaviour) => behaviour.cityLabels.gameCityKm,
    set: (behaviour, gameCityKm) => ({ ...behaviour, cityLabels: { ...behaviour.cityLabels, gameCityKm } }),
  },
  {
    group: 'Zoom',
    name: 'Furthest out',
    description:
      'The lowest zoom the globe goes to, measured at the equator: away from it the globe zooms a little further ' +
      'out and stays the same size on screen. Lower: a smaller globe with more space around it. Keep it below 3, ' +
      'where pins become score cards, for small pins and their clusters to show.',
    file: 'web/src/globe/zoomSettings.json',
    key: 'minZoom',
    range: { min: 0, max: 5, step: 0.1 },
    get: (behaviour) => behaviour.zoom.minZoom,
    set: (behaviour, minZoom) => ({ ...behaviour, zoom: { ...behaviour.zoom, minZoom } }),
  },
  {
    group: 'Zoom',
    name: 'Start',
    description:
      'The zoom a first visit opens at, centred on the viewer\'s region, and Home flies back to. ' +
      'The globe goes there as it changes. Measured at the equator, as Furthest out is, and never further out than it. A returning viewer opens ' +
      'where they left the globe.',
    file: 'web/src/globe/zoomSettings.json',
    key: 'startZoom',
    range: { min: 0, max: 8, step: 0.1 },
    get: (behaviour) => behaviour.zoom.startZoom,
    set: (behaviour, startZoom) => ({ ...behaviour, zoom: { ...behaviour.zoom, startZoom } }),
  },
  {
    group: 'Zoom',
    name: 'Furthest in',
    description: 'The highest zoom the globe goes to. At 11 the view is a city some ten kilometres across; each step in halves that.',
    file: 'web/src/globe/zoomSettings.json',
    key: 'maxZoom',
    range: { min: 5, max: 22, step: 0.5 },
    get: (behaviour) => behaviour.zoom.maxZoom,
    set: (behaviour, maxZoom) => ({ ...behaviour, zoom: { ...behaviour.zoom, maxZoom } }),
  },
]

interface BehaviourTunerProps {
  /** The app's own behaviour, which the draft is compared with and reset to. */
  builtIn: Behaviour
  /** The behaviour the app is in now. */
  behaviour: Behaviour
  /** Called with the draft each time it changes: the app's one way to change its behaviour. */
  onChange: (behaviour: Behaviour) => void
  /** What's drawn on the globe to show settings at work, and the way to change it. */
  overlays: Overlays
  onOverlays: (overlays: Overlays) => void
  /** The globe's zoom where its camera last settled, shown with the zoom settings. */
  zoomNow: number
}

/**
 * The behaviour tuner (local runs only): a panel for trying settings that change how the app behaves
 * rather than how it looks, on the running app. Changes show at once. The draft is kept in this
 * browser, and its changes can be copied to put into the settings files.
 */
export function BehaviourTuner(props: BehaviourTunerProps) {
  const { builtIn, behaviour, onChange } = props
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const changed = settings.filter((setting) => setting.get(behaviour) !== setting.get(builtIn))

  useEffect(() => saveBehaviour(window.localStorage, behaviour, builtIn), [behaviour, builtIn])

  const copy = () => {
    const text = changed.map((setting) => `${setting.file}: "${setting.key}": ${setting.get(behaviour)}`).join('\n')
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="theme-tuner theme-tuner--behaviour">
      <button type="button" className="theme-tuner__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Behaviour{changed.length > 0 && <span className="theme-tuner__badge">{changed.length}</span>}
      </button>
      {open && (
        <div className="theme-tuner__panel">
          <div className="theme-tuner__body">
            {[...new Set(settings.map((setting) => setting.group))].map((group) => (
              <div key={group} className="theme-tuner__group theme-tuner__group--top">
                <div className="theme-tuner__heading">
                  {group}
                  {group === 'Zoom' && <span className="behaviour-tuner__now">now {props.zoomNow.toFixed(2)}</span>}
                </div>
                {settings
                  .filter((setting) => setting.group === group)
                  .map((setting) => (
                    <SettingRow key={setting.key} setting={setting} {...props} />
                  ))}
              </div>
            ))}
          </div>
          <div className="theme-tuner__footer">
            <span>{changed.length === 0 ? 'No changes' : `${changed.length} changed`}</span>
            <button type="button" disabled={changed.length === 0} onClick={copy}>
              {copied ? 'Copied' : 'Copy changes'}
            </button>
            <button type="button" disabled={changed.length === 0} onClick={() => onChange(builtIn)}>
              Reset all
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingRow({ setting, behaviour, builtIn, onChange, overlays, onOverlays }: { setting: NumberSetting } & BehaviourTunerProps) {
  const value = setting.get(behaviour)
  const original = setting.get(builtIn)
  const changed = value !== original
  const set = (next: number) => onChange(setting.set(behaviour, next))
  return (
    <div className={changed ? 'theme-tuner__row theme-tuner__row--changed' : 'theme-tuner__row'}>
      <span className="theme-tuner__name behaviour-tuner__name" title={`${setting.description}\n\n${setting.file}: ${setting.key}`}>
        {setting.overlay && (
          <button
            type="button"
            role="switch"
            className="behaviour-tuner__switch"
            title={setting.overlay.label}
            aria-label={setting.overlay.label}
            aria-checked={overlays[setting.overlay.key]}
            onClick={() => onOverlays({ ...overlays, [setting.overlay!.key]: !overlays[setting.overlay!.key] })}
          />
        )}
        {setting.name}
      </span>
      <span className="theme-tuner__number">
        <input type="range" {...setting.range} value={value} onChange={(event) => set(Number(event.target.value))} />
        <input type="number" step={setting.range.step} value={value} onChange={(event) => event.target.value !== '' && set(Number(event.target.value))} />
      </span>
      <button
        type="button"
        className="theme-tuner__reset"
        title={`Back to ${original}`}
        style={{ visibility: changed ? 'visible' : 'hidden' }}
        onClick={() => set(original)}
      >
        ↺
      </button>
    </div>
  )
}
