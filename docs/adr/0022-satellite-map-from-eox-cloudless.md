# A satellite map from EOX's cloudless imagery

Viewers can now switch the globe from its plain navy map to a satellite map, which ADR-0004 left for later. MapLibre ships no map data of its own, so the imagery has to come from a third party, and ScoreMap is a hobby site with no budget, no sign-in and nowhere safe to keep a key. We compared four sources in November 2026:

- **EOX's Sentinel-2 cloudless** (EOxCloudless, `tiles.maps.eox.at`): a cloud-free natural-colour mosaic of the Copernicus Sentinel-2 satellites at 10 m. Its yearly maps from 2018 on are under [CC BY-NC-SA 4.0](https://cloudless.eox.at/license-non-commercial): "free to use for non-commercial purposes, provided appropriate attribution is given", and EOX's [pricing page](https://cloudless.eox.at/pricing) says to "use the provided service endpoints (WMS or WMTS) directly in your application". No key or account, and no stated request limit. Its tiles go to zoom 21, and the imagery stays sharp to about 14, past the globe's closest zoom (11).
- **Esri World Imagery**: the sharpest imagery, but under the Esri Master License Agreement, and we couldn't confirm from Esri's own terms that a public site may use it with no account or key; Esri steers developers to a keyed account.
- **MapTiler's satellite map**: a free account and a key shipped to the browser, its logo on the map, non-commercial only, and a monthly request cap after which the map stops.
- **NASA GIBS Blue Marble**: public and keyless, but at about 500 m a pixel it blurs well before the globe's closest zoom.

We chose EOX's 2024 map. ScoreMap is non-commercial (no ads, no charges), which the licence needs; while the satellite map shows, or Map Type on the rail with its picture of it is open, its credit, with its links, sits at the bottom left of the globe: "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024)" (`MapCredit`). The browser fetches the tiles straight from EOX; the server neither proxies nor caches them.

## Consequences

- The satellite map is a viewer setting (`mapType`, saved with the rest, the plain map unless switched), picked in Map Type on the rail (Plain or Satellite) or with the "Satellite map" switch in Display Settings, not a theme: the theme still colours the borders, place names, halo and everything over the globe on either map.
- On the satellite map the imagery takes the place of the plain map's surface; the borders, state lines and place names stay, and the coastlines go, as the imagery shows the coast. The halo and starry background stay; MapLibre's own atmosphere and any night side stay off, as on the plain map. Pins, score cards, trails and clusters look as on the plain map.
- The satellite map zooms further in than the plain map (`satelliteMaxZoom` in `web/src/globe/zoomSettings.json`, 13 to the plain map's 11, set by eye), as its imagery has more to see close in; past about 14 its 10 m pixels only grow. Switching back to the plain map zoomed in past its limit eases out to it.
- Both map types' layers are always in the globe's style (`globeStyle`), the other type's hidden, so switching is a restyle in place, as a theme change is, and the plain map fetches no imagery. A newer year's mosaic is a change of the year in the tile address and the credit.
- If ScoreMap ever earns money, the imagery needs EOX's commercial licence or another source. If EOX's service goes away or changes its terms, only the satellite map is lost; the plain map doesn't depend on it.
