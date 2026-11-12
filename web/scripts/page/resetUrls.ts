/**
 * Where `reset` clears storage, and then where it opens the app: storage is cleared from the favicon,
 * a page that isn't the app, at the web URL's origin; the app opens at the URL as given, query and all.
 */
export function resetUrls(webUrl: string): { clear: string; open: string } {
  return { clear: new URL('/favicon.svg', webUrl).href, open: webUrl }
}
