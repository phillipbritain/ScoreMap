/** A font for text on the globe, from the map's font server. */
export interface GlobeFont {
  /** The name the font server knows it by, such as "Noto Sans Regular". */
  name: string
  /** Its CSS family, weight and style, for measuring its text on the page the same. */
  family: string
  weight: number
  style: 'normal' | 'italic'
}

const font = (variant: string, weight: number, style: GlobeFont['style'] = 'normal'): GlobeFont => ({
  name: `Noto Sans ${variant}`,
  family: 'Noto Sans',
  weight,
  style,
})

/** The faces shipped by OpenFreeMap’s Liberty style. */
export const globeFonts: ReadonlyMap<string, GlobeFont> = new Map([
  font('Regular', 400),
  font('Bold', 700),
  font('Italic', 400, 'italic'),
].map((face) => [face.name, face]))
