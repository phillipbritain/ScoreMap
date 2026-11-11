# No credit shown for venue photos

The game panel shows each venue's photo: ESPN's own where it has one, or else the venue's Wikidata image from Wikimedia Commons (see [configuration](../configuration.md)). Until November 2026 the panel showed a Commons photo's credit, its author and license, over the photo on hover. In November 2026 the game panel's layout changed (the photo now fills the panel behind the venue and its watch links), and the owner chose to show no credit at all, as ScoreMap is a hobby app.

Most Commons photos are under CC BY or CC BY-SA, whose licenses ask for the credit whatever the use, non-commercial included; only public-domain and CC0 photos don't. So with no credit shown, ScoreMap falls short of those licenses' attribution term, as it does EOX's for the satellite map (ADR-0022). The owner made this choice knowing that. The CC 4.0 licenses accept the credit "in any reasonable manner", so a small button that shows it, or a page listing every photo's credit, would also have met them; they were offered and not taken.

## Consequences

- A photographer could ask ScoreMap to credit their photo or take it down. Showing the credit again would put that right: the server still finds and sends each photo's credit (`VenuePhoto.credit` in `web/src/games/game.ts`), so it's a change to the game panel only.
- ESPN's own venue photos come with no license or credit; they come from ESPN's feed, under ADR-0001's terms for it.
- The theme has no credit colors any more (`components.GamePanel.credit` is gone), nor the photo column's width.
- Before any public launch, revisit this with ADR-0001 and ADR-0002: a public site should show the credits its photos' licenses ask for, or use only photos that ask for none.
