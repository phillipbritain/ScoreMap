# Viewers pick the colours games show in

ADR-0012 kept colour to stand for a game's league, with status shown by brightness and glow, but left open how the colours would be chosen: by sport or by league, from a fixed set, and how to keep them apart for colour-blind viewers (#101). We give the choice to the viewer instead. In the settings menu a viewer can give a sport any colour from the browser's colour picker, and any league its own colour, which wins over its sport's; every game shows in its league's colour, else its sport's: its small pin's ring and glow, its score card, its trail and its pulses, and the game panel. Several sports may share a colour. With none picked, a game takes the theme's colour for its status, as before, so a first visit looks as the theme has it. A Disrupted game always greys out in the theme's Disrupted colour, whatever was picked.

A game's colour comes from one function of the viewer's picked colours, the game and the theme (`gameColour` in `web/src/settings/gameColour.ts`), which everything that draws a game reads, so league colours that win over their sport's (#176) are one more lookup in it.

## Consequences

- The colours are viewer settings, saved in the browser with the rest (`sportColours` and `leagueColours`), not theme settings: a theme still gives each status its palette colour, which stands for the game whenever the viewer has picked none.
- No fixed set and no colour-blind-safe preset: whatever the viewer picks is theirs. Presets could come later.
- Colour still says nothing about status: a picked colour is the same for a Live, Upcoming or Final game, which glow and fade as before.
- Text written on a game's colour (the game panel's progress line) is the theme's light text or its dark surface, whichever stands out from the colour more, and on a score card's header, tinted with it, the card's text or its fill, rather than the palette's `contrastText`, so it reads on any colour. A status's colour has no `contrastText`.
- Small pins carry their colour in the pin source, rather than the layers working it out from status, so a change of colour or theme reloads the pins.
- Pin clusters, card clusters and venue clusters show the colour their games share, or the theme's accent (Live's colour) when their colours differ, Disrupted games left out (#177).
