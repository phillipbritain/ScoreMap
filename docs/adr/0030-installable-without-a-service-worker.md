# Installable without a service worker

The owner wanted visitors to install ScoreMap as an app, to come back to it more easily. So it has a web app manifest (`web/public/manifest.webmanifest`: standalone, opening at `/`, in the theme's `background.default`, with icons drawn from the favicon's art) and the iOS tags for a Home Screen launch, and no service worker. A browser that can be asked (Chromium, by its `beforeinstallprompt`) gets an Install app item in the rail's More, which opens the browser's own install dialog. Elsewhere, such as iOS, where no browser can be asked, installing is left to the browser's own way (Share, then Add to Home Screen): ScoreMap shows nothing for it. Nothing shows in the installed app.

## Considered options

- **A service worker**, for offline use and the older Chromium installability rule: ScoreMap is live scores, of no use offline, and a cached app risks a visitor running an old version after a deploy. Chromium no longer needs one to install.
- **The Install app button on the rail itself**, or a banner: easier to find, but a rail button or banner for something done once. Chromium offers installing in its address bar too.
- **An iOS hint** saying to tap Share, then Add to Home Screen: first in the welcome tour, or on a first visit at once, turned down as the tour has enough to say; then at the bottom of the globe once the tour was done, until closed, and again from More. The owner dropped it on 20 November 2026 for More's Install app alone, using the browser's own install dialog: a pop-up for something done once.

## Consequences

- The server serves `manifest.webmanifest` with ASP.NET Core's static files, as `application/manifest+json`.
- The manifest's colors and icons are written out by hand, not read from the theme: a theme change of the background means changing them too.
- On iOS, and in any browser that doesn't offer to install, More has no Install app; the viewer installs by the browser's own menu, if they know it.
