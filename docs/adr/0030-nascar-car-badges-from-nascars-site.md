# NASCAR car badges from NASCAR's site

A NASCAR driver showed as their country's flag, nearly always the US's, where viewers know them by their car's number in its team's lettering. ESPN has no such image, but NASCAR's own site does: `https://cf.nascar.com/data/images/carbadges/1/{number}.png`, the Cup Series being series 1, a small transparent image of the number as the team letters it (78×70). So a NASCAR driver's logo is that badge, shown in place of their flag in the game panel and on the score card. The car number comes from ESPN's core API event, which the server already asks for each race's venue (ADR-0020): one request per race once its field is listed, kept in memory, not one a driver.

We weighed ESPN's driver headshots (`a.espncdn.com/i/headshots/rpm/players/full/{id}.png`, no request at all), which are faces, not what NASCAR's viewers know a car by, and drawing the number ourselves on a plate, which loses the team's lettering, the reason for the change. We also looked at gaps to the leader for racing's score chips, which the core API gives only one driver a request (about 40 a poll in NASCAR), and left them out.

## Consequences

- NASCAR's image server is a second unofficial source beside ESPN's, used under ADR-0001's terms: it could move or stop without notice, and a badge that fails to load leaves the plate empty, as a missing flag does.
- A badge is by car number, so it shows the car's current lettering.
- Only the Cup Series has badges; F1 and IndyCar keep flags.
- Scenarios give a NASCAR driver's car number as `car`, so their races show badges too.
