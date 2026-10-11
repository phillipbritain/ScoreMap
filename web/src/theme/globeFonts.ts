/**
 * The free map font server the globe writes its text from (ADR-0006). For a font it lacks, it answers
 * with a web page rather than an error, and the text falls back to a browser font, so a theme may
 * give globe text only one of globeFonts.
 */
export const glyphsUrl = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf'

/** A font for text on the globe, from the map's font server. */
export interface GlobeFont {
  /** The name the font server knows it by, such as "Open Sans Semibold". */
  name: string
  /** Its CSS family, weight and style, for measuring its text on the page the same. */
  family: string
  weight: number
  style: 'normal' | 'italic'
}

const font = (family: string, variant: string, weight: number, style: GlobeFont['style'] = 'normal'): GlobeFont => ({
  name: `${family} ${variant}`,
  family,
  weight,
  style,
})

/**
 * The fonts fonts.openmaptiles.org has, by name (checked against it in October 2026). Its Noto Sans
 * is "Klokantech Noto Sans"; it has no plain "Noto Sans", nor Roboto, PT Sans or Nunito, though
 * openmaptiles/fonts lists them.
 */
export const globeFonts: ReadonlyMap<string, GlobeFont> = new Map(
  [
    font('Open Sans', 'Light', 300),
    font('Open Sans', 'Light Italic', 300, 'italic'),
    font('Open Sans', 'Regular', 400),
    font('Open Sans', 'Italic', 400, 'italic'),
    font('Open Sans', 'Semibold', 600),
    font('Open Sans', 'Semibold Italic', 600, 'italic'),
    font('Open Sans', 'Bold', 700),
    font('Open Sans', 'Bold Italic', 700, 'italic'),
    font('Open Sans', 'Extra Bold', 800),
    font('Klokantech Noto Sans', 'Regular', 400),
    font('Klokantech Noto Sans', 'Italic', 400, 'italic'),
    font('Klokantech Noto Sans', 'Bold', 700),
    ...(
      [
        ['Thin', 100],
        ['Extra Light', 200],
        ['Light', 300],
        ['Regular', 400],
        ['Medium', 500],
        ['Semi Bold', 600],
        ['Bold', 700],
        ['Extra Bold', 800],
        ['Black', 900],
      ] as const
    ).flatMap(([variant, weight]) => [
      font('Metropolis', variant, weight),
      font('Metropolis', `${variant} Italic`, weight, 'italic'),
    ]),
  ].map((f) => [f.name, f]),
)
