import { useEffect, useMemo, useState } from 'react'
import { globeFonts } from '../theme/globeFonts'
import { resolveTheme, type Theme } from '../theme/theme'
import {
  changes,
  describeChanges,
  numberRange,
  paletteColours,
  saveDraft,
  scaleOf,
  settingAt,
  shiftedJob,
  stepOfJob,
  tunerTabs,
  withSetting,
  type Json,
  type JsonObject,
  type PaletteColour,
  type SettingPath,
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
}

/**
 * The theme tuner (local runs only): a panel for trying changes to the theme on the running app,
 * by part of the screen. A colour picks a step of the theme's palette, or steps lighter or darker,
 * so it stays within the palette; sizes, opacities and fonts change in place. Changes show at once,
 * the globe's included. The draft is kept in this browser, and its changes can be copied to put into
 * the theme's JSON.
 */
export function ThemeTuner({ builtIn, initial, onTheme }: ThemeTunerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initial)
  const [tabIndex, setTabIndex] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const tabs = useMemo(() => tunerTabs(builtIn), [builtIn])
  const palette = useMemo(() => paletteColours(draft), [draft])
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
    palette,
    changed: new Set(changed.map((change) => change.path.join('.'))),
    set: (path, value) => setDraft((current) => withSetting(current, path, value)),
  }
  const tab = tabs[tabIndex]

  return (
    <div className="theme-tuner">
      <button type="button" className="theme-tuner__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        Theme{changed.length > 0 && <span className="theme-tuner__badge">{changed.length}</span>}
      </button>
      {open && (
        <div className="theme-tuner__panel">
          <div className="theme-tuner__tabs" role="tablist">
            {tabs.map(({ name }, i) => (
              <button key={name} type="button" role="tab" aria-selected={i === tabIndex} onClick={() => setTabIndex(i)}>
                {name}
              </button>
            ))}
          </div>
          {!result.ok && (
            <ul className="theme-tuner__problems">
              {result.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
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

interface RowContext {
  builtIn: ThemeJson
  draft: ThemeJson
  palette: readonly PaletteColour[]
  /** The changed settings' paths, joined with dots. */
  changed: ReadonlySet<string>
  set: (path: SettingPath, value: Json) => void
}

const isGroup = (value: Json | undefined): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A key as a label: "glowOpacity" as "glow opacity", a zoom level "4" as "zoom 4". */
const label = (key: string) => (/^\d/.test(key) ? `zoom ${key}` : key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`))

/** A setting, or a group of them under a heading. */
function Group({ path, value, context, title = false }: { path: SettingPath; value: Json | undefined; context: RowContext; title?: boolean }) {
  if (!isGroup(value)) {
    return (
      <div className={title ? 'theme-tuner__group theme-tuner__group--top' : undefined}>
        <Row path={path} value={value} context={context} name={title ? path.join(' › ') : label(path.at(-1)!)} />
      </div>
    )
  }
  return (
    <div className={title ? 'theme-tuner__group theme-tuner__group--top' : 'theme-tuner__group'}>
      <div className="theme-tuner__heading">{title ? path.map(label).join(' › ') : label(path.at(-1)!)}</div>
      {Object.entries(value).map(([key, inner]) => (
        <Group key={key} path={[...path, key]} value={inner} context={context} />
      ))}
    </div>
  )
}

/** One setting: its name, its control, and a reset to the built-in theme's when it's changed. */
function Row({ path, value, context, name }: { path: SettingPath; value: Json | undefined; context: RowContext; name: string }) {
  const changed = context.changed.has(path.join('.'))
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
  if (typeof value === 'boolean') return <input type="checkbox" checked={value} onChange={(event) => set(event.target.checked)} />
  if (typeof value === 'number') {
    const range = numberRange(path, typeof original === 'number' ? original : value)
    return (
      <span className="theme-tuner__number">
        <input type="range" {...range} value={value} onChange={(event) => set(Number(event.target.value))} />
        <input type="number" step={range.step} value={value} onChange={(event) => event.target.value !== '' && set(Number(event.target.value))} />
      </span>
    )
  }
  if (Array.isArray(value)) {
    return <DashInput value={value as readonly number[]} onChange={set} />
  }
  if (typeof value !== 'string') return <span>{JSON.stringify(value)}</span>
  const last = path.at(-1)
  if (last === 'family') return <input type="text" className="theme-tuner__text" value={value} onChange={(event) => set(event.target.value)} />
  const scale = scaleOf(path)
  if (scale) {
    const steps = settingAt(context.draft, [scale])
    return (
      <select value={value} onChange={(event) => set(event.target.value)}>
        {isGroup(steps) &&
          Object.entries(steps).map(([step, pixels]) => (
            <option key={step} value={step}>
              {step} ({String(pixels)}px)
            </option>
          ))}
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
  return <ColourJob job={value} palette={context.palette} onChange={set} />
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

/** The colour a colour job shows as: its palette step's, or the colour given directly. */
function colourOf(job: string, palette: readonly PaletteColour[]): string {
  const named = stepOfJob(job)
  return (named && palette.find((colour) => colour.name === named.colour)?.steps[named.step]) ?? job
}

/**
 * A colour job, picked from the palette's steps (a grid of each colour from light to dark) or stepped
 * lighter or darker in its palette colour. Transparent is there for shadows and outlines.
 */
function ColourJob({ job, palette, onChange }: { job: string; palette: readonly PaletteColour[]; onChange: (job: string) => void }) {
  const [picking, setPicking] = useState(false)
  const named = stepOfJob(job)
  return (
    <span className="theme-tuner__colour">
      <button type="button" className="theme-tuner__swatch-button" onClick={() => setPicking(!picking)}>
        <span className="theme-tuner__swatch" style={{ background: colourOf(job, palette) }} />
        {job}
      </button>
      <button type="button" title="Lighter" aria-label="Lighter" disabled={!named || named.step === '100'} onClick={() => onChange(shiftedJob(job, -1))}>
        ▲
      </button>
      <button type="button" title="Darker" aria-label="Darker" disabled={!named || named.step === '900'} onClick={() => onChange(shiftedJob(job, 1))}>
        ▼
      </button>
      {picking && (
        <span className="theme-tuner__grid">
          {palette.map(({ name, steps }) => (
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
                    onClick={() => {
                      onChange(option)
                      setPicking(false)
                    }}
                  />
                )
              })}
            </span>
          ))}
          <button
            type="button"
            className="theme-tuner__transparent"
            aria-pressed={job === 'transparent'}
            onClick={() => {
              onChange('transparent')
              setPicking(false)
            }}
          >
            transparent
          </button>
        </span>
      )}
    </span>
  )
}
