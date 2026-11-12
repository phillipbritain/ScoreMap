import { Marker, type Map as MapLibreMap } from 'maplibre-gl'
import { focusGameNavigation } from '../games/gameFocus'
import type { Game } from '../games/game'
import type { Scorer } from '../games/scorers'
import type { Theme } from '../theme/theme'
import { cardComingDuration } from './cardComings'
import type { ScreenOffset } from './cardLayout'
import type { PinAnimation } from './pinAnimation'
import type { TrailOnGlobe } from './trailLayer'

/** What a viewer does to a placed card, for whoever placed it. */
export interface PlacedCardEvents {
  /** The card was selected: clicked, or its button pressed. */
  select: () => void
  /** A mouse or pen came onto the card (true) or left it (false); a touch has no hover. */
  hover: (on: boolean) => void
}

/**
 * One game's score card on the globe, from being placed at its venue until it's disposed: its marker
 * and element, the pulse playing on it (kept as it's redrawn), its coming in and going out, the trail
 * it keeps while going out, and letting go of keyboard focus as it leaves or joins a card cluster.
 * Whichever way it leaves the globe (no longer wanted, gone out, or the globe cleared), it's through
 * dispose, which does it all once.
 *
 * What it's drawn with, and where the card layout puts it, are kept on it for its owner (see
 * ScoreCardMarkers), which draws it and lays it out.
 */
export class PlacedCard {
  readonly gameId: string
  /** The card last drawn into the element, so an unchanged card isn't redrawn every frame. */
  drawn = ''
  /** What the card was last drawn from, so it's worked out afresh only when one of them changes. */
  drawnFrom: { game: Game; color: string; flames: boolean; selected: boolean; theme: Theme; scorer: Scorer | undefined } | null = null
  /** The card's two rows as last drawn, top first. */
  rows: Element[] = []
  /** The card's size on screen, as last measured. */
  width = 0
  height = 0
  /**
   * Where the card sits from its venue: just above it, or moved aside to make room for others (see
   * cardLayout). Null until it's first laid out.
   */
  offset: ScreenOffset | null = null
  /** True while there's no room for the card: its game is counted in a card cluster, or shows as its small pin. */
  inCardCluster = false

  private readonly map: MapLibreMap
  /** MapLibre owns the marker element's classes and transform, so the card goes inside it. */
  private readonly marker: Marker
  /** The pulse playing on the card, so redrawing it (say, with its new score) doesn't cut the pulse short. */
  private playing: PinAnimation | undefined
  /** The trail the card had when it started going out, drawn until it's gone. */
  private trailGoingOut: TrailOnGlobe | undefined
  private disposed = false

  /** Places a card for a game at its venue, empty until it's drawn. */
  constructor(map: MapLibreMap, gameId: string, lngLat: [number, number], events: PlacedCardEvents) {
    this.map = map
    this.gameId = gameId
    const element = document.createElement('div')
    const button = document.createElement('button')
    button.type = 'button'
    element.append(button)
    element.addEventListener('click', (event) => {
      event.stopPropagation()
      events.select()
    })
    // A mouse or pen on the card picks out its trail and venue dot; a touch has no hover (the
    // card's own hover look is CSS, for devices that hover). The card stays where it is.
    element.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'touch') events.hover(true)
    })
    element.addEventListener('pointerleave', () => events.hover(false))
    // Above the venue, its trail down to it (see cardLayout); the city's name sits below its dot.
    this.marker = new Marker({ element, anchor: 'bottom' }).setLngLat(lngLat).addTo(map)
  }

  /** The marker's element, which MapLibre moves with the camera, holding the card. */
  get markerElement(): HTMLElement {
    return this.marker.getElement()
  }

  /** The card itself, drawn into (see drawScoreCard). */
  get element(): HTMLElement {
    return this.marker.getElement().firstElementChild as HTMLElement
  }

  /** The card's venue. */
  get lngLat(): [number, number] {
    return this.marker.getLngLat().toArray()
  }

  /** The pulse playing on the card, to draw it with (see drawScoreCard), if any. */
  get animation(): PinAnimation | undefined {
    return this.playing
  }

  /** The trail the card had when it started going out, while it's going out. */
  get trail(): TrailOnGlobe | undefined {
    return this.trailGoingOut
  }

  /** Moves the card to its venue, if it has moved. MapLibre moves it with the camera itself: setting it again only moves it again. */
  moveTo([longitude, latitude]: [number, number]): void {
    const at = this.marker.getLngLat()
    if (at.lng !== longitude || at.lat !== latitude) this.marker.setLngLat([longitude, latitude])
  }

  /** Measures the card's size on screen afresh, after it's drawn or restyled. */
  measure(): void {
    this.width = this.element.offsetWidth
    this.height = this.element.offsetHeight
  }

  /** Puts the card where the card layout has it from its venue, moved aside for its neighbors or not. */
  placeAt(offset: ScreenOffset, moved: boolean): void {
    if (offset.dx === this.offset?.dx && offset.dy === this.offset?.dy) return
    this.offset = offset
    this.marker.setOffset([offset.dx, offset.dy])
    this.markerElement.toggleAttribute('data-moved', moved)
  }

  /**
   * Hides the card while there's no room for it (its game counted in a card cluster, or shown as its
   * small pin), or shows it again. Hidden rather than removed, so it keeps its size for laying out the
   * next frame; its focus goes back to the Games list as it hides.
   */
  setInCardCluster(inCardCluster: boolean): void {
    if (inCardCluster === this.inCardCluster) return
    this.inCardCluster = inCardCluster
    if (inCardCluster) this.releaseFocus()
    this.markerElement.toggleAttribute('data-in-card-cluster', inCardCluster)
  }

  /** Plays a pulse on the card, from the start even if one is playing; it's kept as the card is redrawn until it's over. */
  pulse(animation: PinAnimation): void {
    const element = this.element
    if (this.playing) element.classList.remove(animationClass(this.playing))
    // Reading layout between removing and adding the class restarts an animation already playing.
    void element.offsetWidth
    this.playing = animation
    element.classList.add(animationClass(animation))
    const ended = (event: AnimationEvent) => {
      // The score inside flashes too, and its end bubbles up here.
      if (event.target !== element) return
      element.removeEventListener('animationend', ended)
      if (this.playing !== animation) return
      this.playing = undefined
      element.classList.remove(animationClass(animation))
    }
    element.addEventListener('animationend', ended)
  }

  /**
   * Starts the card coming in, its game having just arrived on the board (see cardComings). `over` is
   * called once it's had time to, which is the board's to check (see CardComings.over).
   */
  comeIn(over: () => void): void {
    this.transition('score-card-coming', 0, over)
  }

  /** Leaves the card as it is, now it's come in. */
  cameIn(): void {
    if (!this.disposed) this.markerElement.classList.remove('score-card-coming')
  }

  /**
   * Starts the card going out, its game gone from the board, `since` milliseconds in (going out from
   * partway in), drawn with the trail it had until it's disposed. It can't be selected or focused
   * meanwhile. `over` is called once it's had time to go (see CardComings.over).
   */
  goOut(since: number, trail: TrailOnGlobe | undefined, over: () => void): void {
    const element = this.markerElement
    this.releaseFocus()
    this.playing = undefined
    this.trailGoingOut = trail
    element.inert = true
    element.setAttribute('aria-hidden', 'true')
    this.transition('score-card-going', since, over)
  }

  /** Sends keyboard focus on the card back to the Games list, or failing that the globe. */
  releaseFocus(): void {
    if (this.markerElement.contains(document.activeElement)) focusGameNavigation(this.map.getCanvas())
  }

  /**
   * Takes the card off the globe: focus goes back to the Games list, and the marker, its pulse and its
   * trail going out go with it. Once only: disposing it again does nothing.
   */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseFocus()
    this.marker.remove()
    this.playing = undefined
    this.trailGoingOut = undefined
  }

  /**
   * Plays a coming in or going out: the look is the CSS's class, played over cardComingDuration,
   * `delay` milliseconds in. `over` is called once it's over, even if the card has been disposed by
   * then, as which cards came in and went out is the board's to forget (see CardComings.over).
   */
  private transition(className: 'score-card-coming' | 'score-card-going', delay: number, over: () => void): void {
    const element = this.markerElement
    element.classList.remove('score-card-coming')
    element.style.animationDuration = `${cardComingDuration}ms`
    element.style.animationDelay = `${-delay}ms`
    element.classList.add(className)
    setTimeout(over, cardComingDuration - delay + 20)
  }
}

export const animationClass = (animation: PinAnimation) => `score-card--animate-${animation}`
