import { useState, type FormEvent } from 'react'
import { lengthCounter, lengthProblem, sendFeedback, type FeedbackContext } from './feedbackForm'

interface FeedbackProps {
  /** Hidden by Shift+S: hidden, not unmounted, so a half-written draft survives. */
  hidden: boolean
  /** What the viewer is looking at as they send, for the issue's Context section. */
  context: () => FeedbackContext
}

/**
 * The Feedback button at the bottom right of the globe (a round icon button, named by its tooltip, hidden while its panel is open), and the panel it opens above it: a box for
 * the viewer's note, Submit and Cancel, and a reminder that it's posted publicly. Sent, the panel
 * thanks the viewer with a link to the issue and stays open until closed. Submitting too little or too
 * much text says so; if sending fails, the text stays and a short error shows.
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

  // After a thank-you: the panel starts afresh next time.
  const close = () => {
    setOpen(false)
    setText('')
    setError(null)
    setIssueUrl(null)
  }

  // Keeps the draft for next time, but not an error about it.
  const cancel = () => {
    setOpen(false)
    setError(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (sending) return
    const problem = lengthProblem(text)
    if (problem) {
      setError(problem)
      return
    }
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
                onChange={(event) => {
                  setText(event.target.value)
                  // A length error goes once the text is a length that can be sent.
                  if (lengthProblem(event.target.value) === null) setError(null)
                }}
                aria-invalid={error !== null && lengthProblem(text) !== null}
                aria-describedby={error ? 'feedback-error' : undefined}
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
                <p id="feedback-error" className="feedback__error" role="alert">
                  {error}
                </p>
              )}
              <div className="feedback__actions">
                <button type="button" className="feedback__action" onClick={cancel}>
                  Cancel
                </button>
                <button type="submit" className="feedback__action feedback__action--submit" disabled={sending}>
                  {sending ? 'Sending…' : 'Submit'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
      {/* Hidden while the panel is open, which takes its corner; the panel's Cancel or Close shuts it. */}
      <button
        type="button"
        className="feedback__button"
        hidden={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        aria-label="Feedback"
        title="Feedback"
      >
        {/* A speech bubble (Feather's "message-square"). */}
        <svg
          className="feedback__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </div>
  )
}
