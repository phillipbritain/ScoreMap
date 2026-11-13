// PROTOTYPE, throwaway: Leagues' "Top Events | My leagues" control in each of the looks on
// `?scopeProto=` (see scopePrototype). Each says, in its own way, "you're choosing what the globe shows".
import './scopePrototype.css'
import { useScopeVariant } from './scopePrototype'

interface ScopeProps {
  top: boolean
  onPick: (top: boolean) => void
}

const topNote = 'The games ESPN picks as the most important right now, in every sport.'
const mineNote = 'Only the leagues you switch on below.'

function Star({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

function Check() {
  return (
    <svg className="scope-proto__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

export function ScopeControl({ top, onPick }: ScopeProps) {
  const variant = useScopeVariant()
  switch (variant) {
    case 'current':
      return <Current top={top} onPick={onPick} />
    case 'segmented':
      return <Segmented top={top} onPick={onPick} />
    case 'radio':
      return <RadioCards top={top} onPick={onPick} />
    case 'show-chips':
      return <ShowChips top={top} onPick={onPick} />
    case 'switch':
      return <TopSwitch top={top} onPick={onPick} />
    case 'dropdown':
      return <Dropdown top={top} onPick={onPick} />
  }
}

/** Today's: two tabs, the choice underlined and lit. */
function Current({ top, onPick }: ScopeProps) {
  return (
    <>
      <div className="leagues-scope" role="radiogroup" aria-label="Show">
        <button type="button" role="radio" aria-checked={top} className="leagues-scope__option" onClick={() => onPick(true)}>
          <Star className="leagues-scope__star" />
          Top Events
        </button>
        <button type="button" role="radio" aria-checked={!top} className="leagues-scope__option" onClick={() => onPick(false)}>
          My leagues
        </button>
      </div>
      {top && <p className="leagues-scope__note">{topNote}</p>}
    </>
  )
}

/** A "Show on the globe" label over one rounded track, the chosen half filled and lit, a sliding thumb. */
function Segmented({ top, onPick }: ScopeProps) {
  return (
    <div className="scope-proto__block">
      <div className="scope-proto__label" id="scope-proto-label">
        Show on the globe
      </div>
      <div className={`scope-seg ${top ? 'scope-seg--first' : 'scope-seg--second'}`} role="radiogroup" aria-labelledby="scope-proto-label">
        <span className="scope-seg__thumb" aria-hidden="true" />
        <button type="button" role="radio" aria-checked={top} className="scope-seg__option" onClick={() => onPick(true)}>
          <Star className="scope-proto__star" />
          Top Events
        </button>
        <button type="button" role="radio" aria-checked={!top} className="scope-seg__option" onClick={() => onPick(false)}>
          My leagues
        </button>
      </div>
      <p className="scope-proto__note">{top ? topNote : mineNote}</p>
    </div>
  )
}

/** Two stacked options, each a radio dot, a name and what it shows; the chosen one outlined and lit. */
function RadioCards({ top, onPick }: ScopeProps) {
  const option = (value: boolean, name: string, note: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={top === value}
      className="scope-radio__option"
      onClick={() => onPick(value)}
    >
      <span className="scope-radio__dot" aria-hidden="true" />
      <span className="scope-radio__text">
        <span className="scope-radio__name">
          {value && <Star className="scope-proto__star" />}
          {name}
        </span>
        <span className="scope-radio__note">{note}</span>
      </span>
    </button>
  )
  return (
    <div className="scope-proto__block">
      <div className="scope-proto__label" id="scope-proto-label">
        Show on the globe
      </div>
      <div className="scope-radio" role="radiogroup" aria-labelledby="scope-proto-label">
        {option(true, 'Top Events', 'ESPN’s most important games right now, in every sport')}
        {option(false, 'My leagues', 'Only the leagues you switch on below')}
      </div>
    </div>
  )
}

/** "Show:" then two chips, the chosen one lit with a check, as the league chips are lit. */
function ShowChips({ top, onPick }: ScopeProps) {
  return (
    <div className="scope-proto__block">
      <div className="scope-chips" role="radiogroup" aria-labelledby="scope-proto-label">
        <span className="scope-chips__label" id="scope-proto-label">
          Show:
        </span>
        <button type="button" role="radio" aria-checked={top} className="rail-chip scope-chips__chip" aria-pressed={top} onClick={() => onPick(true)}>
          {top && <Check />}
          Top Events
        </button>
        <button type="button" role="radio" aria-checked={!top} className="rail-chip scope-chips__chip" aria-pressed={!top} onClick={() => onPick(false)}>
          {!top && <Check />}
          My leagues
        </button>
      </div>
      <p className="scope-proto__note">{top ? topNote : mineNote}</p>
    </div>
  )
}

/** One setting, "Top Events only", with its switch at the right, as Display Settings' photo switch. Off, the leagues below decide. */
function TopSwitch({ top, onPick }: ScopeProps) {
  return (
    <div className="scope-proto__block scope-switch">
      <button type="button" role="switch" aria-checked={top} className="scope-switch__row" onClick={() => onPick(!top)}>
        <span className="scope-switch__name">
          <Star className="scope-proto__star" />
          Show Top Events only
        </span>
        <span className={top ? 'switch switch--on' : 'switch switch--off'} aria-hidden="true" />
      </button>
      <p className="scope-proto__note">{top ? topNote : 'Off: the globe shows the leagues you switch on below.'}</p>
    </div>
  )
}

/** A form field: a "Show on the globe" label over a box with the choice in it and a caret, as a select. */
function Dropdown({ top, onPick }: ScopeProps) {
  return (
    <div className="scope-proto__block">
      <label className="scope-proto__label" htmlFor="scope-proto-select">
        Show on the globe
      </label>
      <div className="scope-select">
        <select id="scope-proto-select" className="scope-select__box" value={top ? 'top' : 'mine'} onChange={(event) => onPick(event.target.value === 'top')}>
          <option value="top">★ Top Events</option>
          <option value="mine">My leagues</option>
        </select>
        <svg className="scope-select__caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <p className="scope-proto__note">{top ? topNote : mineNote}</p>
    </div>
  )
}
