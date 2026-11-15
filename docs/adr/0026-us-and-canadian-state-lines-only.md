# US and Canadian state lines only, from Natural Earth

The globe drew every country's state and province lines, from the map's tiles (ADR-0004). Their coarsest tiles, zoom 0, carry country borders but no state or province lines, and MapLibre draws the globe from them zoomed all the way out (below zoom 1, as on a phone) and toward the globe's edge, where it picks coarser tiles; so state lines went missing in places as the globe turned, more noticeably once they were drawn brighter (November 2026). The owner cares about other countries' borders, but of state and province lines only the United States' and Canada's, where most games are.

The tiles don't say which country a state line is in, so the globe now draws state and province lines of its own, at every zoom, and none of the tiles': Natural Earth's admin-1 lines (public domain) for the United States and Canada, simplified to about 200 m, in a file built with the app (`web/src/globe/stateLines.json`, made by `npm --prefix web run state-lines`). The file is fetched only once the globe is Ready, so it never holds up the first view. Every country's lines were first tried, but that file was 367 KB (99 KB gzipped) and loaded with the map style, so could hold up Ready on a slow connection; the United States' and Canada's are 137 KB (40 KB gzipped).

## Consequences

- Other countries show only their country borders, at every zoom. The tiles' state and province names still show for every country (zoom 5 to 8), as they say nothing of their country either.
- State lines appear a moment after the globe is Ready.
- Natural Earth's lines run out across bays and lakes, where the tiles' didn't. On the plain map they're drawn under the sea, which hides those stretches; on the satellite map they're drawn over its imagery, water and all.
- At the globe's closest zoom the lines are Natural Earth's detail, not the tiles': a state line may meet the coast a little way from where the tiles' coastline does.
- The lines are the theme's state lines (`components.Globe.stateLines`).
