import { useState, type FormEvent } from 'react'
import { lengthCounter, lengthProblem, sendFeedback, type FeedbackContext } from './feedbackForm'

interface FeedbackProps {
  /** What the viewer is looking at as they send, for the issue's Context section. */
  context: () => FeedbackContext
  /** The note so far, kept by the rail while the panel is closed, so Cancel keeps it for next time. */
  draft: string
  onDraftChange: (draft: string) => void
  /** Closes the panel: Cancel, or Close after the thanks. */
  onClose: () => void
}

/**
 * The Feedback panel, opened from More on the rail as its popover: a box for the viewer's note,
 * Submit and Cancel, and a reminder that it's posted publicly. Sent, the panel thanks the viewer with
 * a link to the issue and stays open until closed. Submitting too little or too much text says so; if
 * sending fails, the text stays and a short error shows. Cancel keeps the note for next time.
 */
export function Feedback({ context, draft: text, onDraftChange: setText, onClose }: FeedbackProps) {
  // The honeypot, which only a bot fills in.
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issueUrl, setIssueUrl] = useState<string | null>(null)
  const counter = lengthCounter(text)

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
    <div className="feedback">
      {issueUrl ? (
        <>
          <p className="feedback__thanks" role="status">
            Thanks for your feedback!{' '}
            <a href={issueUrl} target="_blank" rel="noreferrer">
              See it on GitHub
            </a>
          </p>
          <div className="feedback__actions">
            <button type="button" className="feedback__action" onClick={onClose}>
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
            <button type="button" className="feedback__action" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="feedback__action feedback__action--submit" disabled={sending}>
              {sending ? 'Sending…' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
