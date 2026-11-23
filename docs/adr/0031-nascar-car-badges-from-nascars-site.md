# Bundle official NASCAR Cup Series car badges

ScoreMap shows NASCAR Cup drivers with their car numbers in the team lettering. The badges originally loaded from NASCAR’s image server. With redistribution permission, ScoreMap now bundles the official PNGs and serves them with the browser app. This keeps the badges available during a NASCAR CDN outage and lets ScoreMap deliver them over the same connection as the rest of the app.

ESPN supplies car numbers for live races, and scenarios carry them in the `car` field. The browser selects the bundled badge by number and uses the driver’s flag when there is no matching badge. Other racing series continue to show flags.

The initial bundle covers the numbers in NASCAR’s [2026 Cup schedule](https://cf.nascar.com/cacher/2026/1/race_list_basic.json) weekend feeds and ScoreMap’s scenarios. To refresh it, replace the PNGs in [the bundled badge directory](../../web/src/games/nascarCupBadges/) from NASCAR’s `https://cf.nascar.com/data/images/carbadges/1/{number}.png` source. Keep the official digits in each filename, including any leading zero.
