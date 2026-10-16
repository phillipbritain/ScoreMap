import { useEffect, useState } from 'react'
import { Dimmed } from '../loading/LoadingScreen'
import { cutOffNoteView } from './cutOffNoteView'

/** How often the note looks again at how long ScoreMap has been cut off. */
const tickMs = 250

interface CutOffNoteProps {
  /** When ScoreMap was cut off from the server (performance.now()), or null while it isn't. */
  cutOffSince: number | null
}

/**
 * Once ScoreMap has been cut off from the server for a while, the loading screen's look over the globe
 * (its dim, rocket and message) saying it's still trying, so old scores don't pass as live. Unlike the
 * loading screen, the globe can still be moved under it. It goes when the games come back. What it says
 * comes from cutOffNoteView; this only draws it.
 */
export function CutOffNote({ cutOffSince }: CutOffNoteProps) {
  const [now, setNow] = useState(() => performance.now())

  useEffect(() => {
    if (cutOffSince === null) return
    const timer = setInterval(() => setNow(performance.now()), tickMs)
    return () => clearInterval(timer)
  }, [cutOffSince])

  const message = cutOffNoteView(cutOffSince === null ? null : Math.max(0, now - cutOffSince))
  if (!message) return null
  return <Dimmed message={message} movable label="Reconnecting to ScoreMap" />
}
