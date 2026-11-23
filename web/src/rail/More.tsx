import { OrbitIcon, RailIcon } from './railIcons'

/**
 * The rail's More popover: what's rarely needed, kept out of view until asked for, each with an icon.
 * Install app, only where the browser has offered to install ScoreMap (see offersInstall), closes it and opens the
 * browser's own install dialog;
 * Orbit starts or stops the camera's pan. Send feedback opens the Feedback panel in its place;
 * Welcome tour closes it and starts the tour afresh.
 */
export function More({
  orbit,
  onInstall,
  onFeedback,
  onTourAgain,
}: {
  orbit?: { active: boolean; toggle: (fromKeyboard: boolean) => void }
  onInstall?: () => void
  onFeedback: () => void
  onTourAgain: () => void
}) {
  return (
    <ul className="more">
      {orbit && (
        <li>
          <button type="button" className="more__item" onClick={(event) => orbit.toggle(event.detail === 0)}>
            <RailIcon className="more__icon"><OrbitIcon /></RailIcon>
            {orbit.active ? 'End Orbit mode' : 'Start Orbit mode'}
          </button>
        </li>
      )}
      {onInstall && (
        <li>
          <button type="button" className="more__item" onClick={onInstall}>
            <RailIcon className="more__icon">
              {/* An arrow down into a tray (Feather's "download"). */}
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </RailIcon>
            Install app
          </button>
        </li>
      )}
      <li>
        <button type="button" className="more__item" onClick={onTourAgain}>
          <RailIcon className="more__icon">
            {/* A compass, finding the way round (Feather's "compass"). */}
            <circle cx="12" cy="12" r="10" />
            <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
          </RailIcon>
          Welcome tour
        </button>
      </li>
      <li>
        <button type="button" className="more__item" aria-haspopup="dialog" onClick={onFeedback}>
          <RailIcon className="more__icon">
            {/* A speech bubble (Feather's "message-square"). */}
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </RailIcon>
          Send feedback
        </button>
      </li>
    </ul>
  )
}
