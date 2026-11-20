# Installable without a service worker

The owner wanted visitors to install ScoreMap as an app, to come back to it more easily. So it has a web app manifest (`web/public/manifest.webmanifest`: standalone, opening at `/`, in the theme's `background.default`, with icons drawn from the favicon's art) and the iOS tags for a Home Screen launch, and no service worker. A browser that can be asked (Chromium, by its `beforeinstallprompt`) gets an Install app item in the rail's More; on iOS, where no browser can be asked, a hint at the bottom of the globe says to tap Share, then Add to Home Screen, once the welcome tour is finished or skipped. It shows once, until it's closed (remembered in the browser), and comes back from More's Install app. Neither shows in the installed app.

## Considered options

- **A service worker**, for offline use and the older Chromium installability rule: ScoreMap is live scores, of no use offline, and a cached app risks a visitor running an old version after a deploy. Chromium no longer needs one to install.
- **The Install app button on the rail itself**, or a banner: easier to find, but a rail button or banner for something done once. Chromium offers installing in its address bar too.
- **The iOS hint in the welcome tour**, or on a first visit at once: the tour has enough to say, and the hint would compete with it.

## Consequences

- The server serves `manifest.webmanifest` with ASP.NET Core's static files, as `application/manifest+json`.
- The manifest's colors and icons are written out by hand, not read from the theme: a theme change of the background means changing them too.
- The hint shows on any iOS browser (all add to the Home Screen by Share since iOS 16.4), and in a demo too: it's about the browser, not the viewer's settings.
