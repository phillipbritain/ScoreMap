import { useEffect, useMemo, useState } from 'react'
import type { LoadingPreview } from '../loading/LoadingScreen'
import { globeFonts } from '../theme/globeFonts'
import { resolveTheme, type Theme } from '../theme/theme'
import {
  changes,
  changesIn,
  componentName,
  rowChanged,
  describeChanges,
  isTypeStyleSize,
  numberRange,
  saveDraft,
  settingAt,
  shiftedJob,
  stepOfJob,
  themeColours,
  tunerTabs,
  withSetting,
  type Json,
  type JsonObject,
  type SettingPath,
  type ThemeColour,
  type ThemeJson,
} from './themeDraft'
import './themeTuner.css'

interface ThemeTunerProps {
  /** The built-in theme's JSON, which the draft starts from and is compared with. */
  builtIn: ThemeJson
  /** The draft to start with: one saved in this browser, or the built-in theme. */
  initial: ThemeJson
  /** Called with the draft, resolved, each time it changes and resolves: the app's one way to change its theme. */
  onTheme: (theme: Theme) => void
  /** The loading screen held up over the globe to be looked at, and the way to change it. */
  loadingPreview: LoadingPreview
  onLoadingPreview: (preview: LoadingPreview) => void
}

/**
 * The theme tuner (local runs only): a panel for trying changes to the theme on the running app,
 * by part of the theme and of the screen. A colour picks a step of the theme's colours or one of its
 * palette's colours, or steps lighter or darker, so it stays within the theme's colours; sizes,
 * opacities and fonts change in place. Changes show at once,
 * the globe's included. The draft is kept in this browser, and its changes can be copied to put into
 * the theme's JSON. The loading screen, seen only once a page, can be held up over the globe to tune.
 */
export function ThemeTuner({ builtIn, initial, onTheme, loadingPreview, onLoadingPreview }: ThemeTunerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initial)
  const [tabIndex, setTabIndex] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const tabs = useMemo(() => tunerTabs(builtIn), [builtIn])
  const colours = useMemo(() => themeColours(draft), [draft])
  const changed = useMemo(() => changes(builtIn, draft), [builtIn, draft])
  const result = useMemo(() => resolveTheme(draft), [draft])

  useEffect(() => {
    saveDraft(window.localStorage, builtIn, draft)
    if (result.ok) onTheme(result.theme)
  }, [builtIn, draft, result, onTheme])

  const copy = (what: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what)
      window.setTimeout(() => setCopied(null), 1500)
    })
  }

  const context: RowContext = {
    builtIn,
    draft,
    colours,
    set: (path, value) => setDraft((current) => withSetting(current, path, value)),
  }
  const tab = tabs[tabIndex]

  return (
    <div className="theme-tuner theme-tuner--theme">
      <button type="button" className="theme-tuner__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Theme{changed.length > 0 && <span className="theme-tuner__badge">{changed.length}</span>}
      </button>
      {open && (
        <div className="theme-tuner__panel">
          <div className="theme-tuner__tabs">
            {(['theme', 'component'] as const).map((kind) => (
              <div key={kind} className={`theme-tuner__tab-group theme-tuner__tab-group--${kind}`}>
                <span className="theme-tuner__tab-group-name">{kind === 'theme' ? 'Whole theme' : 'Components'}</span>
                <div role="tablist" aria-label={kind === 'theme' ? 'Whole theme' : 'Components'}>
                  {tabs.map((tab, i) => {
                    if (tab.kind !== kind) return null
                    const count = changesIn(tab, changed)
                    return (
                      <button
                        key={tab.name}
                        type="button"
                        role="tab"
                        title={tab.paths.map((path) => path.join('.')).join(', ')}
                        aria-selected={i === tabIndex}
                        aria-label={count ? `${tab.name}, ${count} changed` : undefined}
                        onClick={() => setTabIndex(i)}
                      >
                        {tab.name}
                        {count > 0 && <span className="theme-tuner__badge">{count}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          {!result.ok && (
            <ul className="theme-tuner__problems">
              {result.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}
          {/* On the loading screen's tab, and on every tab while it's held up (its ring and message take
              settings from Shape and Type), so it can always be put away. */}
          {(tab.paths.some((path) => path[1] === 'LoadingScreen') || loadingPreview !== 'off') && (
            <LoadingPreviewControl preview={loadingPreview} onChange={onLoadingPreview} />
          )}
          <div className="theme-tuner__body">
            {tab.paths.map((path) => (
              <Group key={path.join('.')} path={path} value={settingAt(draft, path)} context={context} title />
            ))}
          </div>
          <div className="theme-tuner__footer">
            <span>{changed.length === 0 ? 'No changes' : `${changed.length} changed`}</span>
            <button type="button" disabled={changed.length === 0} onClick={() => copy('changes', describeChanges(changed))}>
              {copied === 'changes' ? 'Copied' : 'Copy changes'}
            </button>
            <button type="button" onClick={() => copy('json', JSON.stringify(draft, null, 2))}>
              {copied === 'json' ? 'Copied' : 'Copy JSON'}
            </button>
            <button type="button" disabled={changed.length === 0} onClick={() => setDraft(builtIn)}>
              Reset all
            </button>
          </div>
          {changed.length > 0 && (
            <details className="theme-tuner__changes">
              <summary>Changes</summary>
              <pre>{describeChanges(changed)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

const previews: [LoadingPreview, string][] = [
  ['off', 'Off'],
  ['rocket', 'Rocket'],
  ['slow', 'Slow message'],
]

/**
 * Holds the loading screen up over the globe, to tune its look: the dim and rocket, or those with the
 * slow message, until put away; or plays its exit, the fade it goes with once ScoreMap is ready.
 */
function LoadingPreviewControl({ preview, onChange }: { preview: LoadingPreview; onChange: (preview: LoadingPreview) => void }) {
  return (
    <div className="theme-tuner__preview" role="group" aria-label="Loading screen">
      <span className="theme-tuner__preview-name">Loading screen</span>
      {previews.map(([choice, name]) => (
        <button key={choice} type="button" aria-pressed={preview === choice} onClick={() => onChange(choice)}>
          {name}
        </button>
      ))}
      <button type="button" disabled={preview === 'off' || preview === 'leaving'} onClick={() => onChange('leaving')}>
        Play exit
      </button>
    </div>
  )
}

interface RowContext {
  builtIn: ThemeJson
  draft: ThemeJson
  colours: readonly ThemeColour[]
  set: (path: SettingPath, value: Json) => void
}

const isGroup = (value: Json | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A key as a label: "glowOpacity" as "glow opacity", a zoom level "4" as "zoom 4". */
const label = (key: string) => (/^\d/.test(key) ? `zoom ${key}` : key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`))

/** A tab's top setting or group as a heading: a component's by its name ("Score card"), the rest key by key. */
const heading = (path: SettingPath) =>
  path[0] === 'components' && path[1] !== undefined
    ? [componentName(path[1]), ...path.slice(2).map(label)].join(' › ')
    : path.map(label).join(' › ')

/** A setting, or a group of them under a heading. */
function Group({ path, value, context, title = false }: { path: SettingPath; value: Json | undefined; context: RowContext; title?: boolean }) {
  if (!isGroup(value)) {
    return (
      <div className={title ? 'theme-tuner__group theme-tuner__group--top' : undefined}>
        <Row path={path} value={value} context={context} name={title ? heading(path) : label(path.at(-1)!)} />
      </div>
    )
  }
  return (
    <div className={title ? 'theme-tuner__group theme-tuner__group--top' : 'theme-tuner__group'}>
      <div className="theme-tuner__heading">{title ? heading(path) : label(path.at(-1)!)}</div>
      {Object.entries(value).map(([key, inner]) => (
        <Group key={key} path={[...path, key]} value={inner} context={context} />
      ))}
    </div>
  )
}

/** One setting: its name, its control, and a reset to the built-in theme's when it's changed. */
function Row({ path, value, context, name }: { path: SettingPath; value: Json | undefined; context: RowContext; name: string }) {
  const changed = rowChanged(context.builtIn, context.draft, path)
  const original = settingAt(context.builtIn, path)
  return (
    <div className={changed ? 'theme-tuner__row theme-tuner__row--changed' : 'theme-tuner__row'}>
      <span className="theme-tuner__name" title={path.join('.')}>
        {name}
      </span>
      <Control path={path} value={value} original={original} context={context} />
      <button
        type="button"
        className="theme-tuner__reset"
        title={`Back to ${JSON.stringify(original)}`}
        style={{ visibility: changed ? 'visible' : 'hidden' }}
        onClick={() => original !== undefined && context.set(path, original)}
      >
        ↺
      </button>
    </div>
  )
}

function Control({ path, value, original, context }: { path: SettingPath; value: Json | undefined; original: Json | undefined; context: RowContext }) {
  const set = (next: Json) => context.set(path, next)
  const last = path.at(-1)
  const range = numberRange(path, typeof original === 'number' ? original : typeof value === 'number' ? value : 0)
  if (last === 'corner' && (typeof value === 'number' || value === 'pill')) {
    // A number of corner radii, or fully round.
    return (
      <span className="theme-tuner__number">
        <label>
          <input type="checkbox" checked={value === 'pill'} onChange={(event) => set(event.target.checked ? 'pill' : typeof original === 'number' ? original : 1)} />
          pill
        </label>
        {typeof value === 'number' && <NumberInput value={value} range={range} onChange={set} />}
      </span>
    )
  }
  if (typeof value === 'boolean') return <input type="checkbox" checked={value} onChange={(event) => set(event.target.checked)} />
  if (typeof value === 'number') return <NumberInput value={value} range={range} onChange={set} />
  if (Array.isArray(value)) {
    return <DashInput value={value as readonly number[]} onChange={set} />
  }
  if (typeof value !== 'string') return <span>{JSON.stringify(value)}</span>
  if (last === 'fontFamily') return <input type="text" className="theme-tuner__text" value={value} onChange={(event) => set(event.target.value)} />
  if (isTypeStyleSize(path)) {
    const styles = settingAt(context.draft, ['typography'])
    return (
      <select value={value} onChange={(event) => set(event.target.value)}>
        {isGroup(styles) &&
          Object.entries(styles).flatMap(([name, style]) =>
            isGroup(style) ? [
              <option key={name} value={name}>
                {name} ({String(style.fontSize)}px)
              </option>,
            ] : [],
          )}
      </select>
    )
  }
  if (last === 'font') {
    return (
      <select value={value} onChange={(event) => set(event.target.value)}>
        {[...globeFonts.keys()].map((font) => (
          <option key={font}>{font}</option>
        ))}
      </select>
    )
  }
  // The palette's own colours name the theme's colours' steps; everything else may name the palette's.
  return <ColourJob job={value} draft={context.draft} colours={context.colours} roles={path[0] !== 'palette'} onChange={set} />
}

function NumberInput({ value, range, onChange }: { value: number; range: { min: number; max: number; step: number }; onChange: (value: number) => void }) {
  return (
    <span className="theme-tuner__number">
      <input type="range" {...range} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <input type="number" step={range.step} value={value} onChange={(event) => event.target.value !== '' && onChange(Number(event.target.value))} />
    </span>
  )
}

/**
 * A dash pattern, as numbers separated by commas, taken on leaving the field when it reads as at
 * least two numbers. Made again when the pattern changes (a reset), to show it.
 */
function DashInput({ value, onChange }: { value: readonly number[]; onChange: (value: number[]) => void }) {
  return (
    <input
      key={value.join(',')}
      type="text"
      className="theme-tuner__text"
      defaultValue={value.join(', ')}
      onBlur={(event) => {
        const numbers = event.target.value.split(',').map(Number)
        if (numbers.length >= 2 && numbers.every((n) => Number.isFinite(n) && n >= 0)) onChange(numbers)
        else event.target.value = value.join(', ')
      }}
    />
  )
}

/** The colour a colour job shows as: the step it names, itself or through the palette, or the colour given directly. */
function colourOf(job: string, draft: ThemeJson, colours: readonly ThemeColour[]): string {
  const named = stepOfJob(job, draft)
  const direct = settingAt(draft, ['palette', ...job.split('.')])
  return (named && colours.find((colour) => colour.name === named.colour)?.steps[named.step]) ?? (typeof direct === 'string' ? direct : job)
}

/** The palette's colours, by their names in a colour job ("primary.dark", "divider"). */
function paletteJobs(draft: ThemeJson): string[] {
  const walk = (value: Json | undefined, name: string): string[] =>
    typeof value === 'string' ? [name] : isGroup(value) ? Object.entries(value).flatMap(([key, inner]) => walk(inner, name ? `${name}.${key}` : key)) : []
  return walk(settingAt(draft, ['palette']), '')
}

/**
 * A colour job, picked from the theme's colours' steps (a grid of each colour from light to dark) or,
 * where `roles` allows, the palette's colours, or stepped lighter or darker in its colour. Transparent
 * is there for shadows and outlines.
 */
function ColourJob({
  job,
  draft,
  colours,
  roles,
  onChange,
}: {
  job: string
  draft: ThemeJson
  colours: readonly ThemeColour[]
  roles: boolean
  onChange: (job: string) => void
}) {
  const [picking, setPicking] = useState(false)
  const named = stepOfJob(job, draft)
  const pick = (option: string) => {
    onChange(option)
    setPicking(false)
  }
  return (
    <span className="theme-tuner__colour">
      <button type="button" className="theme-tuner__swatch-button" onClick={() => setPicking(!picking)}>
        <span className="theme-tuner__swatch" style={{ background: colourOf(job, draft, colours) }} />
        {job}
      </button>
      <button type="button" title="Lighter" aria-label="Lighter" disabled={!named || named.step === '100'} onClick={() => onChange(shiftedJob(job, -1, draft))}>
        ▲
      </button>
      <button type="button" title="Darker" aria-label="Darker" disabled={!named || named.step === '900'} onClick={() => onChange(shiftedJob(job, 1, draft))}>
        ▼
      </button>
      {picking && (
        <span className="theme-tuner__grid">
          {roles && (
            <span className="theme-tuner__roles">
              {paletteJobs(draft).map((option) => (
                <button key={option} type="button" title={option} aria-pressed={option === job} className="theme-tuner__role" onClick={() => pick(option)}>
                  <span className="theme-tuner__swatch" style={{ background: colourOf(option, draft, colours) }} />
                  {option}
                </button>
              ))}
            </span>
          )}
          {colours.map(({ name, steps }) => (
            <span key={name} className="theme-tuner__grid-row">
              <span className="theme-tuner__grid-name">{name}</span>
              {Object.entries(steps).map(([step, hex]) => {
                const option = `${name}.${step}`
                return (
                  <button
                    key={step}
                    type="button"
                    title={`${option} ${hex}`}
                    aria-pressed={option === job}
                    className="theme-tuner__cell"
                    style={{ background: hex }}
                    onClick={() => pick(option)}
                  />
                )
              })}
            </span>
          ))}
          <button
            type="button"
            className="theme-tuner__transparent"
            aria-pressed={job === 'transparent'}
            onClick={() => pick('transparent')}
          >
            transparent
          </button>
        </span>
      )}
    </span>
  )
}
