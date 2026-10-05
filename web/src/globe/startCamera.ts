import type { Camera } from './camera'

/** What the browser says about where the viewer is, without asking for their location. */
export interface ViewerPlace {
  /** IANA time zone, such as "America/New_York". */
  timeZone: string
  /** BCP 47 language tag, such as "en-GB". */
  locale: string
}

/** Where the globe opens: where the viewer left it, otherwise centred on their region. */
export function startCamera(saved: Camera | null, place: ViewerPlace): Camera {
  return saved ?? regionCamera(place)
}

/** Close enough to show the viewer's part of the world while still looking like a globe. */
const regionZoom = 2

/** [longitude, latitude] roughly at the middle of the region each common time zone covers. */
const zoneCentres: Record<string, [number, number]> = {
  'America/New_York': [-78, 39],
  'America/Detroit': [-78, 39],
  'America/Toronto': [-78, 43],
  'America/Chicago': [-92, 37],
  'America/Denver': [-106, 40],
  'America/Phoenix': [-112, 34],
  'America/Los_Angeles': [-119, 37],
  'America/Vancouver': [-121, 47],
  'America/Anchorage': [-150, 61],
  'Pacific/Honolulu': [-157, 21],
  'America/Mexico_City': [-100, 21],
  'America/Sao_Paulo': [-47, -18],
  'America/Argentina/Buenos_Aires': [-62, -32],
  'America/Bogota': [-74, 5],
  'America/Lima': [-76, -10],
  'America/Santiago': [-71, -33],
  'Europe/London': [-2, 53],
  'Europe/Dublin': [-7, 53],
  'Europe/Lisbon': [-8, 40],
  'Europe/Moscow': [38, 55],
  'Europe/Istanbul': [32, 39],
  'Africa/Cairo': [31, 28],
  'Africa/Lagos': [6, 8],
  'Africa/Nairobi': [37, 0],
  'Africa/Johannesburg': [25, -28],
  'Asia/Dubai': [55, 25],
  'Asia/Kolkata': [79, 22],
  'Asia/Shanghai': [114, 33],
  'Asia/Hong_Kong': [114, 22],
  'Asia/Singapore': [104, 3],
  'Asia/Seoul': [128, 36],
  'Asia/Tokyo': [138, 36],
  'Australia/Perth': [118, -28],
  'Australia/Sydney': [148, -32],
  'Australia/Melbourne': [145, -36],
  'Australia/Brisbane': [150, -25],
  'Pacific/Auckland': [174, -40],
}

/** For time zones not listed above: the middle of the continent or ocean the zone is named after. */
const areaCentres: Record<string, [number, number]> = {
  America: [-90, 30],
  Europe: [12, 50],
  Africa: [20, 5],
  Asia: [100, 30],
  Australia: [135, -27],
  Pacific: [170, -15],
  Atlantic: [-30, 35],
  Indian: [75, -10],
}

/** For time zones that say nothing about place (such as UTC): the country in the browser's locale. */
const countryCentres: Record<string, [number, number]> = {
  US: [-96, 38],
  CA: [-95, 50],
  MX: [-100, 21],
  BR: [-48, -15],
  AR: [-62, -32],
  GB: [-2, 53],
  IE: [-7, 53],
  FR: [2, 46],
  DE: [10, 51],
  ES: [-3, 40],
  IT: [12, 42],
  NL: [5, 52],
  IN: [79, 22],
  CN: [110, 33],
  JP: [138, 36],
  KR: [128, 36],
  AU: [135, -27],
  NZ: [174, -40],
  ZA: [25, -28],
  NG: [8, 9],
}

/** The whole-world view used when nothing hints at the viewer's region. */
const worldView: Camera = { longitude: -40, latitude: 30, zoom: 1.5 }

function regionCamera({ timeZone, locale }: ViewerPlace): Camera {
  const centre =
    zoneCentres[timeZone] ?? areaCentres[timeZone.split('/')[0]] ?? countryCentres[countryOf(locale) ?? '']
  return centre ? { longitude: centre[0], latitude: centre[1], zoom: regionZoom } : worldView
}

/** The country (region subtag) in a language tag such as "en-GB", if it has one. */
function countryOf(locale: string): string | undefined {
  try {
    return new Intl.Locale(locale).region
  } catch {
    return undefined
  }
}
