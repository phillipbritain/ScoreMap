# The welcome tour shows its own made-up games

A first visit started the welcome tour over whatever real games were on: on a busy evening, dozens of score cards in card clusters across the US, before the viewer knew what a card was. With nothing on, Click a score card had no card to point at and drew a made-up example card in its panel instead. The owner wanted a first visit to start on a few cards, the same every time, so a new viewer gets their bearings before real games load in.

The original tour used six fixed example games, chosen in a prototype to start on a few recognizable cards before the live board appears. The tour now starts with an empty globe. Once a choice is confirmed, it shows simulated Live games matching that choice. The featured games are still grouped around the eastern North American opening camera. Other picks use real teams or competitors and real venues, with the camera moving when needed to show a selected game.

## Considered options

- **The worldwide scenario's games, from the server**, as a demo shows (ADR-0019), would have tested the feed's code, but they move and differ by when the demo board started, so the tour wouldn't be the same every time. The tour simulates scoring and event progress in the browser and does not depend on the game feed.
- **Games near the viewer**, placed by their time zone, were turned down for a fixed place, so the featured selection opens in a familiar place.
- **An "Example" tag on each card** was turned down: the cards look as real ones do, which is what the tour is teaching.

## Consequences

- The live site shows made-up scores to every first visitor and to anyone who asks for the tour again. The Demo Mode label identifies them while the welcome tour is visible. The tour's games go once the tour is finished.
- Click a score card points to a matching card when one is clear of the panel. The tour opens on a camera of its own on a phone, further south and out, to give the cards room. When no card is clear of the panel, the step describes what a card opens.
- Asking for the tour again flies the camera to the tour's games; it stays there after the tour.
- The tour's games link to ESPN's team logos, so they need the network as real games do.
- The browser asks the server for photos of the selected venues (`GET /api/venue-photo`, by league, venue and city). A venue without a photo uses the panel's fallback glow.
