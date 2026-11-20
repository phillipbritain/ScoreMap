/**
 * The iOS install hint: how to add ScoreMap to the Home Screen, which iOS browsers can't be asked to do
 * for a page. Shown in the bottom stack (see showsIosHint), with a close button.
 */
export function IosInstallHint({ onClose }: { onClose: () => void }) {
  return (
    <div className="install-hint" role="status">
      <p className="install-hint__text">
        Install ScoreMap: tap Share{' '}
        <svg
          className="install-hint__share"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {/* iOS's Share: a box with an arrow up out of it. */}
          <path d="M8 10H6v11h12V10h-2M12 15V3M8 7l4-4 4 4" />
        </svg>{' '}
        then Add to Home Screen.
      </p>
      <button type="button" className="install-hint__close" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
