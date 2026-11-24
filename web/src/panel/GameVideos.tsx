import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type Hls from 'hls.js'
import { RailIcon } from '../rail/railIcons'
import type { GameVideo, VideoPlayback } from './gameDetails'
import './gameVideos.css'

function timestamp(value: string | null | undefined) {
  const parsed = Date.parse(value ?? '')
  return Number.isFinite(parsed) ? parsed : Number.MIN_SAFE_INTEGER
}

export function GameVideos({ videos }: { videos: GameVideo[] }) {
  const newestFirst = videos.toSorted((a, b) => timestamp(b.publishedAt) - timestamp(a.publishedAt) || a.url.localeCompare(b.url))
  return <ul className="game-details-list" aria-label="ESPN videos">
    {newestFirst.map((video) => <li key={video.url}>
      {video.playback
        ? <PlayableVideo video={video} playback={video.playback} />
        : <a className="game-details-video game-details-video-reveal" href={video.url} target="_blank" rel="noopener noreferrer">
          <VideoThumbnail key={video.thumbnailUrl} url={video.thumbnailUrl} />
          <strong>{video.title}</strong>
          <span className="game-videos__row-meta"><Duration seconds={video.duration} />
            <span className="game-videos__publisher-link">Watch on ESPN</span>
          </span>
        </a>}
    </li>)}
  </ul>
}

function VideoThumbnail({ url }: { url?: string | null }) {
  const [image, setImage] = useState<'loading' | 'loaded' | 'failed'>(url ? 'loading' : 'failed')
  return <span className="game-details-video-thumb game-videos__thumb" aria-hidden="true">
    <span className="game-videos__artwork" data-ready={image !== 'loading'}>
      {image !== 'failed' && url && <img src={url} alt="" decoding="async"
        onLoad={() => setImage('loaded')} onError={() => setImage('failed')} />}
      <RailIcon className="game-details-video-play"><path d="m9 7 8 5-8 5z" /></RailIcon>
    </span>
  </span>
}

function Duration({ seconds }: { seconds?: number | null }) {
  return seconds != null && <span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>
}

function PlayableVideo({ video, playback }: { video: GameVideo; playback: VideoPlayback }) {
  const [state, setState] = useState<'closed' | 'loading' | 'ready' | 'unavailable'>('closed')
  const dialog = useRef<HTMLDialogElement>(null)
  const mediaElement = useRef<HTMLVideoElement>(null)
  const playButton = useRef<HTMLButtonElement>(null)
  const publisherLink = useRef<HTMLAnchorElement>(null)
  const loading = state === 'loading'
  const viewerOpen = loading || state === 'ready'
  const playlistUrl = playback.kind === 'hls' ? playback.url : null

  useLayoutEffect(() => {
    if (viewerOpen && dialog.current) return anchorHighlightViewer(dialog.current)
  }, [viewerOpen])

  useEffect(() => {
    const player = mediaElement.current
    if (!viewerOpen || !player || !playlistUrl) return
    let disposed = false
    let stream: Hls | undefined
    function fail() {
      if (!disposed) setState((current) => current === 'closed' ? current : 'unavailable')
    }
    void import('hls.js').then(({ default: HlsPlayer }) => {
      if (disposed) return
      if (!HlsPlayer.isSupported()) {
        player.src = playlistUrl
        return
      }
      stream = new HlsPlayer()
      stream.on(HlsPlayer.Events.ERROR, (_, error) => { if (error.fatal) fail() })
      stream.loadSource(playlistUrl)
      stream.attachMedia(player)
    }).catch(fail)
    return () => {
      disposed = true
      stream?.destroy()
    }
  }, [playlistUrl, viewerOpen])

  useEffect(() => {
    if (!loading) return
    const timeout = window.setTimeout(() => setState((current) => current === 'loading' ? 'unavailable' : current), 7000)
    return () => window.clearTimeout(timeout)
  }, [loading])

  const unavailable = state === 'unavailable'
  useEffect(() => {
    if (unavailable) dialog.current?.close()
  }, [unavailable])

  function open() {
    if (!dialog.current) return
    dialog.current.showModal()
    setState('loading')
  }

  return <>
    <div className="game-details-video game-details-video-reveal game-videos__play-row">
      <VideoThumbnail key={video.thumbnailUrl} url={video.thumbnailUrl} />
      <strong>{video.title}</strong>
      <button ref={playButton} className="game-videos__play" type="button" aria-label={`Play ${video.title}`}
        aria-haspopup="dialog" onClick={open} disabled={unavailable} />
      <div className="game-videos__row-meta">
        {unavailable ? <span role="status">Video unavailable.</span> : <Duration seconds={video.duration} />}
        <a ref={publisherLink} className="game-videos__publisher-link" href={video.url} target="_blank" rel="noopener noreferrer">Watch on ESPN</a>
      </div>
    </div>
    <dialog ref={dialog} className="game-videos__viewer" aria-label={video.title}
      onKeyDown={(event) => { if (event.key === 'Escape') event.stopPropagation() }}
      onClose={() => {
        mediaElement.current?.pause()
        setState((current) => current === 'unavailable' ? current : 'closed')
        const focusTarget = unavailable ? publisherLink.current : playButton.current
        focusTarget?.focus({ preventScroll: true })
      }}>
      <div className="game-videos__viewer-content">
        <button type="button" className="game-details-dialog-close" aria-label="Close video" onClick={() => dialog.current?.close()}>×</button>
        <div className="game-videos__viewer-media">
          {viewerOpen && <video ref={mediaElement} controls playsInline preload="auto" poster={video.thumbnailUrl ?? undefined}
            src={playback.kind === 'mp4' ? playback.url : undefined} aria-label={video.title}
            onCanPlay={(event) => {
              if (!loading || !dialog.current?.open) return
              setState('ready')
              void event.currentTarget.play().catch(() => {})
            }}
            onError={() => setState((current) => current === 'closed' ? current : 'unavailable')} />}
          {loading && <div className="game-videos__viewer-loading" role="status" aria-label="Loading video" />}
        </div>
      </div>
    </dialog>
  </>
}

function anchorHighlightViewer(viewer: HTMLDialogElement) {
  const panel = viewer.closest('.event-panel')
  if (!panel) return

  const viewport = window.visualViewport
  const inset = 12
  const update = () => {
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportWidth = viewport?.width ?? window.innerWidth
    const viewportHeight = viewport?.height ?? window.innerHeight
    const event = panel.getBoundingClientRect()
    const maxHeight = Math.min(viewportHeight * 0.82, viewportHeight - 2 * inset)
    viewer.style.setProperty('--highlight-viewer-max-height', `${maxHeight}px`)
    viewer.style.setProperty('--highlight-viewer-max-width', `${viewportWidth - 2 * inset}px`)

    const { width, height } = viewer.getBoundingClientRect()
    const centeredLeft = event.left + (event.width - width) / 2
    const centeredTop = event.top + (event.height - height) / 2
    const left = Math.max(viewportLeft + inset, Math.min(centeredLeft, viewportLeft + viewportWidth - width - inset))
    const top = Math.max(viewportTop + inset, Math.min(centeredTop, viewportTop + viewportHeight - height - inset))
    viewer.style.setProperty('--highlight-viewer-left', `${left}px`)
    viewer.style.setProperty('--highlight-viewer-top', `${top}px`)
  }

  update()
  const observer = new ResizeObserver(update)
  observer.observe(panel)
  window.addEventListener('resize', update)
  viewport?.addEventListener('resize', update)
  viewport?.addEventListener('scroll', update)
  panel.addEventListener('animationend', update)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', update)
    viewport?.removeEventListener('resize', update)
    viewport?.removeEventListener('scroll', update)
    panel.removeEventListener('animationend', update)
  }
}
