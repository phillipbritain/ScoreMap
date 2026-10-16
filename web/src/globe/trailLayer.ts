import type { CustomLayerInterface, Map as MapLibreMap } from 'maplibre-gl'
import type { Theme } from '../theme/theme'

export const trailLayerId = 'trails'

/** A moved card's trail, as the card layout gives it (see cardLayoutLayers' cardLayoutDrawing). */
export interface TrailOnGlobe {
  gameId: string
  /** Its game's colour (see gameColour). */
  color: string
  /** The card's venue, which the card sits a fixed way from on screen. */
  venue: [number, number]
  /** Where the trail leaves the card, in pixels from the venue on screen. */
  start: { dx: number; dy: number }
  /** Where it ends: its venue, or the venue cluster it meets others at. */
  end: [number, number]
  /** Whether it ends at a ringed dot of its own, rather than a venue cluster. */
  dot: boolean
}

/** A trail where it's drawn on screen, in pixels. */
export interface TrailOnScreen {
  gameId: string
  from: { x: number; y: number }
  to: { x: number; y: number }
  dot: boolean
}

/** The moved cards' trails and venue dots, drawn by the map beneath the place names (ADR-0010). */
export interface TrailLayer extends CustomLayerInterface {
  /** Draws these trails from now on. */
  show(trails: readonly TrailOnGlobe[]): void
  /** Draws a game's trail and venue dot bolder, as the pointer is on its card, and the last game's no longer. */
  hover(gameId: string | null): void
  /** Where each trail is drawn on screen now. */
  drawn(): TrailOnScreen[]
}

/**
 * The moved cards' trails, and the ringed dots at the venues they end at, drawn on the map each frame
 * where the cards are then. A trail joins a card, a page element a fixed way from its venue on screen,
 * to a place on the globe: as the globe turns, the trail's end at the card moves on screen just as
 * the card does, which no place on the globe would (the globe's perspective carries it off the card).
 * So they're drawn on screen rather than given to a map source as places, which would need giving
 * again every frame of a pan, too slow for it.
 *
 * Drawn as MapLibre would draw them as lines and circles (see cardLayoutLayers' trail looks, from the
 * theme `theme` gives each frame): a trail is a thin line lit in its game's colour, in a soft glow,
 * to a point ringed in it; while the pointer is on its card, the trail and dot are bolder, the dot lit
 * in a glow of its own.
 */
export function trailLayer(theme: () => Theme): TrailLayer {
  let map: MapLibreMap | null = null
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let vao: WebGLVertexArrayObject | null = null
  let uniforms: { viewport: WebGLUniformLocation | null; pixelRatio: WebGLUniformLocation | null } | null = null
  let trails: readonly TrailOnGlobe[] = []
  let hovered: string | null = null

  const onScreen = (): TrailOnScreen[] => {
    if (!map) return []
    return trails.map(({ gameId, venue, start, end, dot }) => {
      const at = map!.project(venue)
      return { gameId, from: { x: at.x + start.dx, y: at.y + start.dy }, to: map!.project(end), dot }
    })
  }

  return {
    id: trailLayerId,
    type: 'custom',
    renderingMode: '2d',

    onAdd(added, context) {
      map = added
      program = linkProgram(context)
      buffer = context.createBuffer()
      vao = context.createVertexArray()
      context.bindVertexArray(vao)
      context.bindBuffer(context.ARRAY_BUFFER, buffer)
      let offset = 0
      for (const [name, size] of attributes) {
        const location = context.getAttribLocation(program, name)
        context.enableVertexAttribArray(location)
        context.vertexAttribPointer(location, size, context.FLOAT, false, vertexFloats * 4, offset * 4)
        offset += size
      }
      context.bindVertexArray(null)
      uniforms = { viewport: context.getUniformLocation(program, 'u_viewport'), pixelRatio: context.getUniformLocation(program, 'u_pixel_ratio') }
    },

    onRemove(_removed, context) {
      context.deleteProgram(program)
      context.deleteBuffer(buffer)
      context.deleteVertexArray(vao)
      map = program = buffer = vao = uniforms = null
    },

    render(context) {
      if (!map || !program || !uniforms || trails.length === 0) return
      const pixelRatio = map.getPixelRatio()
      const shapes = trailShapes(onScreen(), trails.map(({ color }) => color), hovered, theme().components)
      const triangles = vertices(shapes, pixelRatio)
      context.useProgram(program)
      context.uniform2f(uniforms.viewport, map.getCanvas().width / pixelRatio, map.getCanvas().height / pixelRatio)
      context.uniform1f(uniforms.pixelRatio, pixelRatio)
      context.bindVertexArray(vao)
      context.bindBuffer(context.ARRAY_BUFFER, buffer)
      context.bufferData(context.ARRAY_BUFFER, triangles, context.STREAM_DRAW)
      context.disable(context.DEPTH_TEST)
      context.disable(context.STENCIL_TEST)
      context.drawArrays(context.TRIANGLES, 0, triangles.length / vertexFloats)
      context.bindVertexArray(null)
    },

    show(shown) {
      const changed = JSON.stringify(shown) !== JSON.stringify(trails)
      trails = shown
      // Each frame draws them where the cards are then: a new frame is needed only for new trails.
      if (changed) map?.triggerRepaint()
    },

    hover(gameId) {
      if (gameId === hovered) return
      hovered = gameId
      map?.triggerRepaint()
    },

    drawn: onScreen,
  }
}

// Each vertex: where it is on screen (2), where it is in its shape (2), its fill colour (4, premultiplied),
// its stroke colour (4, premultiplied), and its shape (4: kind, then the kind's sizes).
const attributes: [string, number][] = [
  ['a_pos', 2],
  ['a_local', 2],
  ['a_fill', 4],
  ['a_stroke', 4],
  ['a_shape', 4],
]
const vertexFloats = attributes.reduce((sum, [, size]) => sum + size, 0)

const lineKind = 0
const circleKind = 1

type Point = { x: number; y: number }
type Rgba = [number, number, number, number]

/** A line or a circle of a trail, as MapLibre would draw it in a line or circle layer. */
export type TrailShape =
  | { kind: 'line'; from: Point; to: Point; width: number; blur: number; color: string; opacity: number }
  | { kind: 'circle'; at: Point; radius: number; strokeWidth: number; blur: number; color: string; opacity: number; stroke: string }

/**
 * What's drawn of the trails, from the bottom up as the map's trail layers were stacked: every glow,
 * then every line, then each venue's dot, its glow (while hovered) and ring beneath it, in the
 * theme's sizes and opacities, the hovered game's from its hover settings.
 */
export function trailShapes(
  screen: readonly TrailOnScreen[],
  colors: readonly string[],
  hovered: string | null,
  { Trail: trail, Hover: hover }: Theme['components'],
): TrailShape[] {
  const shapes: TrailShape[] = []
  const isHovered = (i: number) => screen[i].gameId === hovered
  screen.forEach(({ from, to }, i) =>
    shapes.push({ kind: 'line', from, to, width: trail.glow.width, blur: trail.glow.blur, color: colors[i], opacity: trail.glow.opacity }),
  )
  screen.forEach(({ from, to }, i) => {
    const look = isHovered(i) ? hover.trail : trail
    shapes.push({ kind: 'line', from, to, width: look.width, blur: 0, color: colors[i], opacity: look.opacity })
  })
  const circle = (at: Point, radius: number, look: Partial<Extract<TrailShape, { kind: 'circle' }>>): TrailShape => ({
    kind: 'circle',
    at,
    radius,
    strokeWidth: 0,
    blur: 0,
    color: 'transparent',
    opacity: 1,
    stroke: 'transparent',
    ...look,
  })
  screen.forEach(({ to, dot }, i) => {
    if (!dot) return
    const color = colors[i]
    if (isHovered(i)) shapes.push(circle(to, hover.venue.glow.radius, { color, blur: 1, opacity: hover.venue.glow.opacity }))
    shapes.push(circle(to, trail.venue.ring.radius, { strokeWidth: isHovered(i) ? hover.trail.width : trail.venue.ring.width, stroke: color }))
    shapes.push(circle(to, isHovered(i) ? hover.venue.radius : trail.venue.radius, { color }))
  })
  return shapes
}

/** The triangles for these shapes, for the trail shader. */
function vertices(shapes: readonly TrailShape[], pixelRatio: number): Float32Array {
  const out: number[] = []
  for (const shape of shapes) {
    if (shape.kind === 'line') line(out, shape, pixelRatio)
    else circle(out, shape, pixelRatio)
  }
  return new Float32Array(out)
}

/** A line `width` pixels wide with butt ends, its edges blurred over `blur` pixels, as MapLibre draws a line layer's. */
function line(out: number[], { from, to, width, blur, color, opacity }: Extract<TrailShape, { kind: 'line' }>, pixelRatio: number): void {
  const halfWidth = width / 2
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (halfWidth === 0 || length === 0) return
  // MapLibre's line: half its width out each side, and a little more to smooth its edges.
  const outset = halfWidth + 1 / pixelRatio / 2
  const nx = (-(to.y - from.y) / length) * outset
  const ny = ((to.x - from.x) / length) * outset
  const fill = premultiplied(rgba(color), opacity)
  const shape = [lineKind, outset, blur, 0]
  const corner = (p: Point, side: number) => [p.x + nx * side, p.y + ny * side, 0, outset * side, ...fill, 0, 0, 0, 0, ...shape]
  const [a, b, c, d] = [corner(from, 1), corner(from, -1), corner(to, 1), corner(to, -1)]
  out.push(...a, ...b, ...c, ...c, ...b, ...d)
}

/**
 * A circle `radius` pixels across with a stroke `strokeWidth` wide outside it, blurred by `blur` (a
 * share of its radius), as MapLibre draws a circle layer's.
 */
function circle(out: number[], { at, radius, strokeWidth, blur, color, opacity, stroke }: Extract<TrailShape, { kind: 'circle' }>, pixelRatio: number): void {
  const reach = radius + strokeWidth
  if (reach <= 0) return
  const fill = premultiplied(rgba(color), opacity)
  const strokeColor = premultiplied(rgba(stroke), 1)
  // MapLibre's circle smooths its edge over a pixel, or blurs it further.
  const antialiasBlur = -Math.max(1 / pixelRatio / reach, blur)
  const shape = [circleKind, radius / reach, antialiasBlur, strokeWidth]
  const corner = (ex: number, ey: number) => [at.x + ex * reach, at.y + ey * reach, ex, ey, ...fill, ...strokeColor, ...shape]
  const [a, b, c, d] = [corner(-1, -1), corner(1, -1), corner(-1, 1), corner(1, 1)]
  out.push(...a, ...b, ...c, ...c, ...b, ...d)
}

const premultiplied = ([r, g, b, a]: Rgba, opacity: number): Rgba => {
  const alpha = a * opacity
  return [r * alpha, g * alpha, b * alpha, alpha]
}

/** A CSS colour as red, green, blue and alpha from 0 to 1, read back from a canvas, which knows every CSS colour. */
function rgba(color: string): Rgba {
  const known = parsed.get(color)
  if (known) return known
  parsing ??= new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })
  let value: Rgba = [0, 0, 0, 0]
  if (parsing) {
    parsing.clearRect(0, 0, 1, 1)
    parsing.fillStyle = color
    parsing.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = parsing.getImageData(0, 0, 1, 1).data
    // Read back premultiplied by the canvas and rounded: undone, near enough for a trail.
    value = a === 0 ? [0, 0, 0, 0] : [r / a, g / a, b / a, a / 255]
  }
  parsed.set(color, value)
  return value
}
const parsed = new Map<string, Rgba>()
let parsing: OffscreenCanvasRenderingContext2D | null | undefined

const vertexShader = `#version 300 es
in vec2 a_pos;
in vec2 a_local;
in vec4 a_fill;
in vec4 a_stroke;
in vec4 a_shape;
uniform vec2 u_viewport;
out vec2 v_local;
out vec4 v_fill;
out vec4 v_stroke;
out vec4 v_shape;
void main() {
  v_local = a_local;
  v_fill = a_fill;
  v_stroke = a_stroke;
  v_shape = a_shape;
  gl_Position = vec4(a_pos.x / u_viewport.x * 2.0 - 1.0, 1.0 - a_pos.y / u_viewport.y * 2.0, 0.0, 1.0);
}`

// A line's edges and a circle's as MapLibre's own line and circle shaders work them out.
const fragmentShader = `#version 300 es
precision highp float;
in vec2 v_local;
in vec4 v_fill;
in vec4 v_stroke;
in vec4 v_shape;
uniform float u_pixel_ratio;
out vec4 fragColor;
void main() {
  if (v_shape.x < 0.5) {
    float outset = v_shape.y;
    float dist = abs(v_local.y);
    float blur2 = v_shape.z + 1.0 / u_pixel_ratio;
    float alpha = clamp(min(dist + blur2, outset - dist) / blur2, 0.0, 1.0);
    fragColor = v_fill * alpha;
  } else {
    float extrudeLength = length(v_local);
    float antialiasedBlur = v_shape.z;
    float opacityT = smoothstep(0.0, antialiasedBlur, extrudeLength - 1.0);
    float colorT = v_shape.w < 0.01 ? 0.0 : smoothstep(antialiasedBlur, 0.0, extrudeLength - v_shape.y);
    fragColor = opacityT * mix(v_fill, v_stroke, colorT);
  }
  if (fragColor.a < 0.5 / 255.0) discard;
}`

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const shader = (type: number, source: string) => {
    const made = gl.createShader(type)!
    gl.shaderSource(made, source)
    gl.compileShader(made)
    if (!gl.getShaderParameter(made, gl.COMPILE_STATUS)) throw new Error(`Trail shader: ${gl.getShaderInfoLog(made)}`)
    return made
  }
  const program = gl.createProgram()
  gl.attachShader(program, shader(gl.VERTEX_SHADER, vertexShader))
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragmentShader))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Trail program: ${gl.getProgramInfoLog(program)}`)
  return program
}
