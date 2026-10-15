/**
 * The lens the larger panes of glass bend the globe through (ADR-0018): a slow, smooth warp, so the
 * globe behind the game panel, the rail and the scenario controls looks seen through thick glass. The
 * page's CSS names it as `url(#glass-lens)` in their backdrop filter, which Chromium draws.
 */
export function GlassLens() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter id="glass-lens" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="28" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  )
}
