# Viewers pick the colors games show in

ADR-0012 kept color to stand for a game's league, with status shown by brightness and glow, but left open how the colors would be chosen: by sport or by league, from a fixed set, and how to keep them apart for color-blind viewers (#101). We give the choice to the viewer instead. In the settings menu a viewer can give a sport one of a set of twenty colors, and any league its own from the same set, which wins over its sport's; every game shows in its league's color, else its sport's: its small pin's ring and glow, its score card, its trail and its pulses, and the game panel. Several sports may share a color. With none picked, a game takes the theme's color for its status, as before, so a first visit looks as the theme has it. A Disrupted game always grays out in the theme's Disrupted color, whatever was picked.

A game's color comes from one function of the viewer's picked colors, the game and the theme (`gameColor` in `web/src/settings/gameColor.ts`), which everything that draws a game reads, so league colors that win over their sport's (#176) are one more lookup in it.

## Consequences

- The colors are viewer settings, saved in the browser with the rest (`sportColors` and `leagueColors`), not theme settings: a theme still gives each status its palette color, which stands for the game whenever the viewer has picked none.
- A fixed set of twenty, not the browser's full color picker, which offered far more than anyone needs: ten hues round the wheel, light and deeper, worked out to sit with the dark theme's gold and stand out on its globe (`pickableColors` in `web/src/settings/gameColor.ts`). No color-blind-safe preset: which of them the viewer picks is theirs.
- Color still says nothing about status: a picked color is the same for a Live, Upcoming or Final game, which glow and fade as before.
- Text written on a game's color (the game panel's progress line) is the theme's light text or its dark surface, whichever stands out from the color more, and on a score card's header, tinted with it, the card's text or its fill, rather than the palette's `contrastText`, so it reads on any color. A status's color has no `contrastText`.
- Small pins carry their color in the pin source, rather than the layers working it out from status, so a change of color or theme reloads the pins.
- Pin clusters, card clusters and venue clusters show the color their games share, or the theme's accent (Live's color) when their colors differ (#177).
