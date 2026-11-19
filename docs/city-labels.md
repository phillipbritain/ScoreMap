# City labels

The globe names cities from a city list included with the app, not from the map's tiles (ADR-0015). Only city names follow these rules; states and countries are named by the base map, once each in English (its English name, else its Latin spelling, else its own), in the theme's look. Zoomed out, before the base map names states (zoom 5), US states and Canadian provinces and territories are named by their 2-letter postal codes (WA, ON), from Natural Earth (`web/src/globe/stateNames.json`, made by `npm --prefix web run state-names`). Every name reads as on an American map.

## The rules

1. **Big and Small cities.** Every city in the list is Big or Small, by its metro population. A city is Big if its metro population is at least the Big city population (4 million), or if it's on the Big list. Every other city in the list is Small. Places not in the list (towns, villages, suburbs) never get a label.
2. **Big cities are always eligible** for a label. Small cities are hidden unless a game needs one.
3. **Labeling games' places.** After the Big cities, go down the Small cities from most populous to least. Label a Small city if some game within the game city reach (50 km) of it has no city label, Big or Small, within that reach yet. So each game gets the most populous Small city within reach, unless a label is already that close; a game with no listed city within reach gets none. The labels depend only on which games are shown, not the order they arrived in. The games are those shown, after the viewer's league filters.
4. **Drawing.** Every city label has one spot, right of a small dot where the city is, level with it, and never moves from it: a label with no room there isn't drawn rather than moved. The games' cities' labels are placed first, whether their games show as score cards, in card clusters or as small pins: each is always drawn, unless the label of a more populous game's city is in its spot. That's sticky by 4 pixels, so a small pan never flips one: a label drawn stays until a more populous one overlaps it by more than 4 pixels, and one left out comes back only once it's more than 4 pixels clear (`web/src/globe/writtenNames.ts`). Score cards are laid out around them, moving rather than the labels. Big cities with no game within reach come next, after country names, drawn where nothing is in their spot, most populous first. State names come last, giving way to everything. A city's dot is drawn with its label, as one, and shows while no game's venue is near enough for its pin to touch the dot: a venue's pin comes first, so the dot is hidden whole rather than peeking out beside it, while the label stays. Near the globe's horizon, city labels fade out, except a game's city's. City labels show at every zoom, in the theme's city look, national capitals included.
5. **Names** are the city's English name from the list, on one line.

Some venues' towns aren't in the list (Foxborough, Inglewood, East Rutherford, Clemson): their games are named by the most populous listed city within reach.

## Settings

All in `web/src/globe/cityLabelSettings.json`:

| Setting | What it does |
| --- | --- |
| `bigCityPopulation` | The metro population at which a city is Big: 4,000,000. |
| `gameCityKm` | How far a game's city label may be from it, in kilometers: 50. |
| `bigList` | Cities that are Big whatever their population, each by its `name` and `country` exactly as the city list has them (`"United States of America"`, say). |

A test fails when a Big list entry matches no city in the list. Where a name and country match more than one city (there are five Springfields in the US), all of them are Big.

## The city list

`web/src/globe/cityList.json` is Natural Earth's populated places (`ne_10m_populated_places_simple`, public domain): 7,342 cities, each with its name, country, position, metro population (`pop_max`) and whether it's a national capital (`adm0cap`), most populous first. Its names are Natural Earth's, which are mostly English already, except for about 140 places it names in another spelling (København, Makkah, Shenyeng). The script that makes the list gives these their English names (Copenhagen, Mecca, Shenyang) from a hand-picked table, `englishNames`. Natural Earth's own English names are too often wrong to use. Names English writes in their own spelling, accents and all (São Paulo, Kraków), stay as they are. `npm --prefix web run city-list` fetches the places again and rewrites it. The populations are a little dated, which is fine for ranking.

The rules are in `web/src/globe/cityLabels.ts`; how the labels are drawn is in `web/src/globe/placeNames.ts`.
