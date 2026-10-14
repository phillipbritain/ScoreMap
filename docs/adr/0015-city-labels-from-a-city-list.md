# City labels from a city list included with the app

The globe's city names come from a city list included with the app (Natural Earth's populated places), chosen by plain rules of Big and Small cities (`docs/city-labels.md`), rather than from the places in the map's tiles. The tiles' places give a city a rank, not a population, so which cities were named was hard to reason about, and a game's place could be named only once the tile holding it had loaded. Finding each game's place meant reading every place in every loaded tile, and checking whether state names fit meant reading them all again; that reading was the main cost when dragging the globe, enough to make it stutter.

## Consequences

- Cities are ranked by real metro populations, and every label is known as soon as the games are, before any tile loads.
- Nothing reads the tiles' places as the globe moves.
- The base style's city, town and village names are dropped: city names are all ours. States, countries and the rest stay as the base style has them, in the theme's look.
- State names show as the base style shows them, from zoom 5 to 8, giving way where there's no room, rather than all or none.
- The list adds about 170 KB (gzipped) to the browser app, and its populations date from when Natural Earth gathered them.
- A town not in the list, such as Foxborough, is never named: its games are named by the most populous listed city near.
