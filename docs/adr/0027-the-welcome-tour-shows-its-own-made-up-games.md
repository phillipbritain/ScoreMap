# The welcome tour shows its own made-up games

A first visit started the welcome tour over whatever real games were on: on a busy evening, dozens of score cards in card clusters across the US, before the viewer knew what a card was. With nothing on, Click a score card had no card to point at and drew a made-up example card in its panel instead. The owner wanted a first visit to start on a few cards, the same every time, so a new viewer gets their bearings before real games load in.

The tour uses six fixed games, chosen in a prototype to start on a few recognizable cards, grouped around the eastern North American opening camera. It starts with an empty globe; once the viewer makes a choice on Welcome, whatever it is, it shows all six, simulated Live. Click a score card always points at the same one, Ravens v Steelers in Pittsburgh.

For a while (#439) the tour's games matched the choice instead: the featured six for Top Events, and for My leagues or Everything a made-up game for each picked league or conference at a real venue, the camera flying to one when it was far away. The owner reverted it on 20 November 2026: it added a good deal to the tour, and meant the tour couldn't be the same, and fully under control, for everyone.

## Considered options

- **The worldwide scenario's games, from the server**, as a demo shows (ADR-0019), would have tested the feed's code, but they move and differ by when the demo board started, so the tour wouldn't be the same every time. The tour simulates scoring and event progress in the browser and does not depend on the game feed.
- **Games matching the viewer's choice on Welcome**, tried and reverted (above).
- **Games near the viewer**, placed by their time zone, were turned down for a fixed place, so the featured selection opens in a familiar place.
- **An "Example" tag on each card** was turned down: the cards look as real ones do, which is what the tour is teaching.

## Consequences

- The live site shows made-up scores to every first visitor and to anyone who asks for the tour again. The Demo Mode label identified them while the welcome tour was visible, until the owner hid it during the tour on 20 November 2026: the tour's own panels, over the games throughout, make plain they're there to show ScoreMap off. The tour's games go once the tour is finished.
- Click a score card points to Ravens v Steelers when it's clear of the panel, whatever else is on screen. The tour opens on a camera of its own on a phone, further south and out, to give the cards room, with the step's panel at the screen's foot. When the card isn't clear of the panel, the step describes what a card opens.
- Asking for the tour again flies the camera to the tour's games; it stays there after the tour.
- The tour's games link to ESPN's team logos, so they need the network as real games do.
- The browser asks the server for photos of the selected venues (`GET /api/venue-photo`, by league, venue, city and the venue's ESPN id, so a tour game gets the photo a real game there would). A venue without a photo uses the panel's fallback glow.
