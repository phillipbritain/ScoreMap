# The welcome tour shows its own made-up games

A first visit started the welcome tour over whatever real games were on: on a busy evening, dozens of score cards in card clusters across the US, before the viewer knew what a card was. With nothing on, Click a score card had no card to point at and drew a made-up example card in its panel instead. The owner wanted a first visit to start on a few cards, the same every time, so a new viewer gets their bearings before real games load in.

So while the tour shows, the globe shows its **Tour games** (`web/src/welcomeTour/tourGames.ts`): six made-up games made in the browser, three close together around New York and three spread out at Toronto, Chicago and Pittsburgh, across five sports and every status, with the camera on them. They show from the tour's start until it's finished (at first they stayed after that until a game panel opened from Click a score card closed; from November 2026 they go as soon as the tour finishes, the panel closing with its game, as the owner found the tour seemed not to end). Then real games (or the scenario on a local run) come back, and the camera stays where it is. This was variant D of four the owner compared on a throwaway prototype (November 2026): three games in the northeast, five around Europe, two in one city zoomed right in, and this one.

## Considered options

- **The worldwide scenario's games, from the server**, as a demo shows (ADR-0019), would have tested the feed's code, but they move and differ by when the demo board started, so the tour wouldn't be the same every time. The tour's games don't need the feed: nothing in them changes while the tour shows.
- **Games near the viewer**, placed by their time zone, were turned down for a fixed place, so every first visit sees the same thing.
- **An "Example" tag on each card** was turned down: the cards look as real ones do, which is what the tour is teaching.

## Consequences

- The live site shows made-up scores to every first visitor, and to anyone who asks for the tour again, without a label. ADR-0009 kept made-up games off the live site, and ADR-0019 labeled them; the tour's games are the exception, and go once the tour is finished.
- Click a score card always has one of the tour's cards to point at on a laptop and on a phone held upright (the tour opens on a camera of its own on a phone, further south and out, so the cards clear its panel), so the example card is gone. On a screen where no card is clear of the panel, the step says what a card opens without pointing.
- The tour's games show whatever the viewer chose on Welcome, so a choice there shows on the globe only once the tour is finished.
- Asking for the tour again flies the camera to the tour's games; it stays there after the tour.
- The tour's games link to ESPN's team logos, so they need the network as real games do.
