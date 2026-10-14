# Pin clusters by MapLibre, venue clusters by the card layout

Small pins form pin clusters through MapLibre's own clustering of the pin source, with a cluster radius that fits the widest pin cluster (`pinClusterSpacing` in `web/src/globe/pinLayers.ts`), not just a small pin, so pins and pin clusters stay apart. We tried clustering on screen instead, in the browser app, as the globe moves: the two pins or clusters that overlap most merge, again until none do, which keeps anything from overlapping. It ran on the main thread every frame, at about 0.3 ms for 100 games, 2 ms for 300 and 35 ms for 1000, where MapLibre's runs in its worker and only when the radius changes. Performance won over an exact guarantee.

Venue clusters, where score cards' trails meet, are worked out by the card layout in the browser app (`venueMarks` in `web/src/globe/cardLayoutLayers.ts`): the layout already places every card on screen each frame, and a venue cluster counts only the cards on screen, a few dozen at most.

## Consequences

- MapLibre measures on a flat map, not the globe, and a cluster can settle a little closer to its neighbour than the radius, so small pins and pin clusters may still overlap slightly far from the equator or near the globe's rim.
- Pins cluster from further apart than two small pins alone would need (35 pixels in the built-in theme, not 18).
- Overlap among venue dots and venue clusters is exact, as they're laid out on screen.
