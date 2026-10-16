# Trails and card clusters drawn in the map, beneath the place names

Score cards' trails, the trails' venue dots and card clusters are drawn by MapLibre, in layers beneath the place names, so every city, state and country name draws over them; the score cards themselves stay page elements above the map. They used to be an SVG layer and markers above the map canvas, which nothing the map draws can go over, so a name under a trail or venue dot was simply covered. We tried keeping them above the map and moving names aside instead, but around a busy city every side of its dot was taken, so the names viewers most need vanished; moving names where there's room and drawing over where there isn't kept them, but had names jumping about as cards moved, for little gain over always drawing on top.

## Consequences

- Card clusters, venue clusters and the cards' footprints are given to the map as places on the globe, each time the cards are laid out, and only when they've changed (or have drifted off where the layout puts them on screen).
- Trails and their venue dots are drawn by a custom WebGL layer of the map's (`web/src/globe/trailLayer.ts`), in screen pixels each frame, where the cards are then. A trail's end at its card is a fixed way from its venue on screen, which no place on the globe stays as it turns (its perspective carries it off), so given to the map as places they had to be given again nearly every frame of a pan, which the map's worker couldn't keep up with. The layer draws them as MapLibre's line and circle layers did, in the theme's trail and hover looks.
- Card clusters' glow, pulse and click are made in the map rather than with CSS and page events.
- Browser tests (ADR-0008) have no glyphs, so card clusters' counts aren't drawn there, as with pin clusters.
