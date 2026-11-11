# ScoreMap in one image: the browser app built with Vite, served by the ASP.NET Core server, which
# also hosts the SignalR hub. Built and pushed to GitHub Container Registry by
# .github/workflows/deploy.yml, and run on Azure Container Apps (docs/deploy.md, ADR-0024).
# Build it locally with: docker build --build-arg COMMIT=$(git rev-parse HEAD) -t scoremap .

FROM node:24-bookworm-slim AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:11.0 AS server
WORKDIR /src
# Project files first, so a change to the code alone doesn't restore the packages again.
COPY global.json ./
COPY server/Directory.Build.props server/
COPY server/src/ScoreMap.Server/ScoreMap.Server.csproj server/src/ScoreMap.Server/
COPY server/src/ScoreMap.ServiceDefaults/ScoreMap.ServiceDefaults.csproj server/src/ScoreMap.ServiceDefaults/
RUN dotnet restore server/src/ScoreMap.Server
COPY server/src/ScoreMap.Server/ server/src/ScoreMap.Server/
COPY server/src/ScoreMap.ServiceDefaults/ server/src/ScoreMap.ServiceDefaults/
# The commit, for the version a feedback issue names; the build context has no .git to read it from.
ARG COMMIT=
RUN dotnet publish server/src/ScoreMap.Server -c Release -o /app --no-restore \
      -p:SkipBrowserApp=true -p:SourceRevisionId=$COMMIT
# A demo shows the worldwide scenario on the live site (ADR-0019), so its file must ship.
RUN test -f /app/Scenarios/Files/worldwide.json \
      || { echo "worldwide.json is missing from the publish; demos would fail on the live site"; exit 1; }

FROM mcr.microsoft.com/dotnet/aspnet:11.0
LABEL org.opencontainers.image.source=https://github.com/phillipbritain/ScoreMap
WORKDIR /app
COPY --from=server /app ./
COPY --from=web /src/web/dist ./wwwroot/
# The image's own non-root user; the app listens on its default port, 8080.
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "ScoreMap.Server.dll"]
