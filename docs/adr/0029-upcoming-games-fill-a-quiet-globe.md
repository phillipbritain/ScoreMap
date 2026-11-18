# Upcoming games fill a quiet globe

ADR-0021 made ScoreMap about games happening now, showing an Upcoming game only from 30 minutes before its start. Then on a quiet morning (a Sunday before the NFL's 1:00 PM kickoffs) the globe was nearly empty, and the owner wanted it never to look so, within reason. So when fewer than 12 games are on now (Live, Final, or Upcoming and starting within 30 minutes) under the viewer's league, conference and Top Events settings, across the whole globe, Upcoming games fill in, soonest first, to make 12: each one starting within 6 hours and on the same day as now in the viewer's time zone. Display Settings' "Only show live games" hides every Upcoming game, those starting within 30 minutes too, for a viewer who never wants them; Final games still show. Its default is off, and it's saved with the other settings. This supersedes ADR-0021's 30-minute Upcoming window; its Final window and Disrupted rule stand.

## Considered options

- **Counting only the games in view**: it follows where the viewer looks, but cards would come and go as they pan. Counting the whole globe keeps them still.
- **All or nothing**: filling in with every Upcoming game in reach once the globe is quiet. Topping up to a count fills a quiet globe gradually, and a busy evening gets none.
- **Keeping the time rules on the server**, which knows its clock: "same day" would then have to be the venue's day, where the owner wanted the viewer's.
- **A countdown ("in 2h 15m") or a blank line** on an Upcoming card, in place of its start time.

## Consequences

- The server sends an Upcoming game from 6 hours before its start (it was 30 minutes), and each browser decides which show, as it depends on the viewer's settings and time zone. Every browser sees the Games list as its globe: only the games it shows.
- The browser needs the game board's time, which in a scenario or a demo is the scenario clock's (ADR-0009), not the real time. So the server sends each browser its board's clock (what it reads at a real time, and its speed) after the snapshot on every connect, and after a scenario switch or a change of speed; the browser runs it forward and looks again each second.
- An Upcoming game's progress line, on its score card and in its game panel, is its start time in the viewer's time ("1:00 PM"), as a fight card's card line was already; its look is Upcoming's, dimmer than Live, and where cards are crowded it comes after Live games, as before.
- "Only show live games" is saved as `onlyLiveGames`. The rail's old "Live games only" switch (gone since ADR-0021) was saved as `liveOnly`, which is still ignored, so a returning viewer's old choice doesn't turn the new switch on.
- The `sunday-morning` scenario shows a quiet globe filled in, and the fill-in games going as the NFL's kick off.
