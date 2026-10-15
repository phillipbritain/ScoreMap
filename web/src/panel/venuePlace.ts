import type { GameVenue } from '../games/game'

/**
 * Where a venue is, for the game panel: its city within its region where it has one
 * ("Glendale, Arizona"), else within its country ("London, England"), leaving out whatever is missing.
 */
export function venuePlace({ city, region, country }: Pick<GameVenue, 'city' | 'region' | 'country'>): string {
  return [city, region ?? country].filter(Boolean).join(', ')
}

/** A Google Maps search for a place, such as a venue ("Wembley Stadium, London, England") or a city. */
export function mapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
