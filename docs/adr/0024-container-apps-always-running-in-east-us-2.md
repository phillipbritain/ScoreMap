# Container Apps with one replica always running, in East US 2

ScoreMap moves from Azure App Service to Azure Container Apps (consumption plan) because it is the cheapest Azure host that never makes a visitor wait for a cold start. The app keeps exactly one replica running (minimum and maximum 1), at about $4–5 a month at 0.25 vCPU and 0.5 GiB, against $13 for App Service B1 with Always On. The reason is now cost and cold starts, not learning containers, so this supersedes ADR-0007. Shipping our own image also frees the app from App Service's runtime images, which in November 2026 still had .NET 11 RC 3 after .NET 11 had shipped, so the app couldn't start. The resources live in East US 2: the same price as Central US and East US, close to the owner, and less often short of capacity than East US.

## Considered Options

- **Container Apps scaling to zero**: nearly free, but the first visitor after a quiet spell waits for the image to pull and start.
- **App Service B1 with Always On**: least work, but about three times the price, each deploy restarts the app, and its runtime images can lag a new .NET release.
- **App Service F1 with a keep-alive ping**: free, but its 60 CPU-minutes a day ran out and took the site down for the rest of the day.
- **A small VM or Container Instances**: no cheaper once a disk, a public IP or HTTPS are added, and more to run by hand.

## Consequences

- Still one replica at most: the poller and game cache live in memory, so a second replica would poll ESPN again.
