import type { GameVenue } from '../games/game'

/**
 * Where a venue is, for the game panel: its city within its region where it has one
 * ("Glendale, Arizona"), else within its country ("London, England"), leaving out whatever is missing.
 */
export function venuePlace({ city, region, country }: Pick<GameVenue, 'city' | 'region' | 'country'>): string {
  return [city, region ?? country].filter(Boolean).join(', ')
}
