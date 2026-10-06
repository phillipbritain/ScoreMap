# App Service first, then Azure Container Apps, with infrastructure in Bicep

ScoreMap first goes live on Azure App Service, because one .NET app with SignalR and a small file cache runs there with the fewest moving parts, and the Free F1 plan sleeps when idle, which suits a server that only polls while a browser is connected. ScoreMap is also a way for the owner to learn architecture and infrastructure, and App Service hides most of the hosting, so the infrastructure is written in Bicep and the app later moves to Azure Container Apps on purpose. That move teaches containers, scale-to-zero, revisions and keeping files on a mounted share, which carry over to other platforms. Running the same app on both is a deliberate comparison, and it checks that the app really is portable.

## Considered Options

- **Static Web Apps + Functions + Azure SignalR Service**: the poller and the game cache live in one long-running process, so this would mean a redesign for no gain at ScoreMap's size.
- **Render, Fly.io or Railway**: easy Docker deploys, but free tiers often lose files on restart, and the learning goal is Azure.
- **The owner's PC behind Cloudflare Tunnel, or a small VPS**: free or cheap with no limits, but the app is down whenever the PC is off, and a VPS means patching the server yourself.

## Consequences

- F1 allows 60 CPU-minutes a day and 5 WebSocket connections. Going past either means moving to B1 (paid) or doing the Container Apps move sooner.
- The app runs as a single instance on both platforms. The poller and game cache live in memory, so a second instance would poll ESPN again and would need sticky sessions.
