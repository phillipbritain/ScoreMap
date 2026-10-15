import { useState, type FormEvent } from 'react'
import { canSubmit, lengthCounter, sendFeedback, type FeedbackContext } from './feedbackForm'

interface FeedbackProps {
  /** Hidden by Shift+S: hidden, not unmounted, so a half-written draft survives. */
  hidden: boolean
  /** What the viewer is looking at as they send, for the issue's Context section. */
  context: () => FeedbackContext
}

/**
 * The Feedback button at the bottom right of the globe, and the panel it opens above it: a box for
 * the viewer's note, Submit and Cancel, and a reminder that it's posted publicly. Sent, the panel
 * thanks the viewer with a link to the issue and stays open until closed; if sending fails, the text
 * stays and a short error shows.
 */
export function Feedback({ hidden, context }: FeedbackProps) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  // The honeypot, which only a bot fills in.
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issueUrl, setIssueUrl] = useState<string | null>(null)
  const counter = lengthCounter(text)

  const close = () => {
    setOpen(false)
    setText('')
    setError(null)
    setIssueUrl(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit(text) || sending) return
    setSending(true)
    setError(null)
    const result = await sendFeedback({ text, website, context: context() })
    setSending(false)
    if ('issueUrl' in result) {
      setIssueUrl(result.issueUrl)
      setText('')
    } else setError(result.error)
  }

  return (
    <div className="feedback" hidden={hidden}>
      {open && (
        <div id="feedback-panel" className="feedback__panel" role="dialog" aria-label="Feedback">
          {issueUrl ? (
            <>
              <p className="feedback__thanks" role="status">
                Thanks for your feedback!{' '}
                <a href={issueUrl} target="_blank" rel="noreferrer">
                  See it on GitHub
                </a>
              </p>
              <div className="feedback__actions">
                <button type="button" className="feedback__action" onClick={close}>
                  Close
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={submit}>
              <label className="feedback__title" htmlFor="feedback-text">
                Feedback
              </label>
              <textarea
                id="feedback-text"
                className="feedback__text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={6}
                autoFocus
                placeholder="What’s working, what isn’t, what you’d like…"
              />
              {counter && <p className={counter.over ? 'feedback__counter feedback__counter--over' : 'feedback__counter'}>{counter.text}</p>}
              <p className="feedback__note">
                Your feedback will be posted publicly on GitHub, with your screen size, browser and what you have open.
              </p>
              {/* Off the page rather than display: none, which some bots skip. */}
              <input
                className="feedback__honeypot"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
              {error && (
                <p className="feedback__error" role="alert">
                  {error}
                </p>
              )}
              <div className="feedback__actions">
                <button type="button" className="feedback__action" onClick={close}>
                  Cancel
                </button>
                <button type="submit" className="feedback__action feedback__action--submit" disabled={!canSubmit(text) || sending}>
                  {sending ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      <button
        type="button"
        className="feedback__button"
        aria-expanded={open}
        aria-controls={open ? 'feedback-panel' : undefined}
        // Closing keeps a draft, but not a thank-you.
        onClick={() => (open && issueUrl ? close() : setOpen(!open))}
      >
        Feedback
      </button>
    </div>
  )
}
