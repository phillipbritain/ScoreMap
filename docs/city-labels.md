# City labels

The globe names cities from a city list included with the app, not from the map's tiles (ADR-0015). Only city names follow these rules; states, countries and everything else are named as the base map names them, in the theme's look.

## The rules

1. **Big and Small cities.** Every city in the list is Big or Small, by its metro population. A city is Big if its metro population is at least the Big city population (4 million), or if it's on the Big list. Every other city in the list is Small. Places not in the list (towns, villages, suburbs) never get a label.
2. **Big cities are always eligible** for a label. Small cities are hidden unless a game needs one.
3. **Labelling games' places.** After the Big cities, go down the Small cities from most populous to least. Label a Small city if some game within the game city reach (50 km) of it has no city label, Big or Small, within that reach yet. So each game gets the most populous Small city within reach, unless a label is already that close; a game with no listed city within reach gets none. The labels depend only on which games are shown, not the order they arrived in. The games are those shown, after the viewer's league filters.
4. **Drawing.** A city labelled for a game is always drawn, below its dot, and score cards keep clear of it. That includes a Big city with a game within reach. Big cities with no game within reach are drawn where they have room, most populous first, giving way to cards and other names. City labels show from zoom 3, each just the name with no dot, in the theme's city look, national capitals included.
5. **Names** are the city's English name from the list, on one line.

Some venues' towns aren't in the list (Foxborough, Inglewood, East Rutherford, Clemson): their games are named by the most populous listed city within reach.

## Settings

All in `web/src/globe/cityLabelSettings.json`:

| Setting | What it does |
| --- | --- |
| `bigCityPopulation` | The metro population at which a city is Big: 4,000,000. |
| `gameCityKm` | How far a game's city label may be from it, in kilometres: 50. |
| `bigList` | Cities that are Big whatever their population, each by its `name` and `country` exactly as the city list has them (`"United States of America"`, say). |

On a local run, the Behaviour tuner (top right, beside Theme) changes `gameCityKm` on the running app, to try values by eye; its switch rings each game at that reach. Its draft is kept in that browser; "Copy changes" gives the value to put in the file.

A test fails when a Big list entry matches no city in the list. Where a name and country match more than one city (there are five Springfields in the US), all of them are Big.

## The city list

`web/src/globe/cityList.json` is Natural Earth's populated places (`ne_10m_populated_places_simple`, public domain): 7,342 cities, each with its name, country, position, metro population (`pop_max`) and whether it's a national capital (`adm0cap`), most populous first. `npm --prefix web run city-list` fetches the places again and rewrites it. The populations are a little dated, which is fine for ranking.

The rules are in `web/src/globe/cityLabels.ts`; how the labels are drawn is in `web/src/globe/placeNames.ts`.
