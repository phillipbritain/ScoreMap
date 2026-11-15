# US and Canadian state lines zoomed out from Natural Earth

The globe's state and province lines came only from the map's tiles (ADR-0004). Their coarsest tiles, zoom 0, carry country borders but no state or province lines, and MapLibre draws the globe from them zoomed all the way out (below zoom 1, as on a phone) and toward the globe's edge, where it picks coarser tiles. So state lines went missing in places as the globe turned, more noticeably once they were drawn brighter (November 2026).

Below zoom 3 the globe now draws the United States' and Canada's state and province lines of its own instead, where most games are: Natural Earth's admin-1 lines (public domain), simplified to about 2 km, in a file built with the app (`web/src/globe/stateLines.json`, made by `npm --prefix web run state-lines`). From zoom 3, where no tile is that coarse, the tiles' lines are drawn instead, so the two never show together. The file is fetched only once the globe is Ready, so it never holds up the first view.

The owner chose this to keep load light: every country's lines were a 367 KB file (99 KB gzipped), loaded with the map style, which could hold up Ready on a slow connection; the US and Canada alone are 49 KB (13 KB gzipped). Hiding state lines below zoom 1 instead would have left the globe's edge as it was on a desktop.

## Consequences

- Zoomed out, other countries' state and province lines still go missing where the tiles are coarsest.
- Their lines appear a moment after the globe is Ready, the first time it's drawn zoomed out.
- Natural Earth's lines cross lakes (Lake Michigan's state lines, say), where the tiles' don't, so those show zoomed out and go at zoom 3.
- The lines are the theme's state lines (`components.Globe.stateLines`), on the plain and satellite maps alike.
