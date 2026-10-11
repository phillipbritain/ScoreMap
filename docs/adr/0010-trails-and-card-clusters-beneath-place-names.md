# Trails and card clusters drawn in the map, beneath the place names

Score cards' trails, the trails' venue dots and card clusters are drawn by MapLibre, in layers beneath the place names, so every city, state and country name draws over them; the score cards themselves stay page elements above the map. They used to be an SVG layer and markers above the map canvas, which nothing the map draws can go over, so a name under a trail or venue dot was simply covered. We tried keeping them above the map and moving names aside instead, but around a busy city every side of its dot was taken, so the names viewers most need vanished; moving names where there's room and drawing over where there isn't kept them, but had names jumping about as cards moved, for little gain over always drawing on top.

## Consequences

- Trails and card clusters are given to the map as screen positions turned back into places on the globe, each time the cards are laid out, and only when they've changed.
- Card clusters' glow, pulse and click are made in the map rather than with CSS and page events.
- Browser tests (ADR-0008) have no glyphs, so card clusters' counts aren't drawn there, as with pin clusters.
