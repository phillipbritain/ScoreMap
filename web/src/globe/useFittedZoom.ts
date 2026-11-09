import { useEffect, useMemo, useState } from 'react'
import { fittedZoomSettings, type FittedZoom, type ZoomSettings } from './zoomLevels'

/** The window's size now. */
function windowSize() {
  return { width: window.innerWidth, height: window.innerHeight }
}

/**
 * These zoom settings fitted to the window (see fittedZoomSettings), refitted as it's resized or a
 * phone is turned.
 */
export function useFittedZoom(settings: ZoomSettings): FittedZoom {
  const [size, setSize] = useState(windowSize)
  useEffect(() => {
    const resized = () => setSize(windowSize())
    window.addEventListener('resize', resized)
    return () => window.removeEventListener('resize', resized)
  }, [])
  const { width, height } = size
  return useMemo(() => fittedZoomSettings(settings, { width, height }), [settings, width, height])
}
