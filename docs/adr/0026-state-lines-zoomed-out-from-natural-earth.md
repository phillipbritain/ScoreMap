# State lines zoomed out from Natural Earth

The globe's state and province lines came only from the map's tiles (ADR-0004). Their coarsest tiles, zoom 0, carry country borders but no state or province lines, and MapLibre draws the globe from them zoomed all the way out (below zoom 1, as on a phone) and toward the globe's edge, where it picks coarser tiles. So state lines went missing in places as the globe turned, more noticeably once they were drawn brighter (November 2026).

Below zoom 3 the globe now draws state and province lines of its own instead: Natural Earth's admin-1 lines (public domain), those it shows by its zoom 5, simplified to about 2 km, in a file built with the app (`web/src/globe/stateLines.json`, made by `npm --prefix web run state-lines`). From zoom 3, where no tile is that coarse, the tiles' lines are drawn instead, so the two never show together. Alternatives were hiding state lines below zoom 1, which left the globe's edge as it was on a desktop, and leaving it.

## Consequences

- The file is about 370 KB (96 KB gzipped), fetched with the map style as a file of its own, not built into the page's script.
- Zoomed out, which states and provinces have lines is Natural Earth's choice, not the tiles': it has fewer small subdivisions (France's regions, not its departments). The change at zoom 3 is hard to see.
- The lines are the theme's state lines (`components.Globe.stateLines`), on the plain and satellite maps alike.
