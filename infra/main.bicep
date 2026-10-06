// ScoreMap on Azure App Service (Linux): the plan and the web app that scripts/deploy.ps1 and the
// GitHub Actions workflow deploy to. Deploy into an existing resource group, see docs/deploy.md.
// Running it again changes nothing. Settings changed in the portal are put back to what's here.

@description('Name of the web app. Must be unique across Azure; the app is served at https://<appName>.azurewebsites.net.')
param appName string

@description('Region for the plan and the app. Defaults to the resource group\'s region.')
param location string = resourceGroup().location

@description('App Service plan size. F1 is free; B1 is the paid step up when F1\'s daily CPU or WebSocket limits are hit.')
param sku string = 'F1'

@description('Name of the App Service plan.')
param planName string = 'scoremap-plan'

resource plan 'Microsoft.Web/serverfarms@2024-11-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: sku
  }
  properties: {
    reserved: true // Linux
  }
}

resource app 'Microsoft.Web/sites@2024-11-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    // SignalR: keep a browser's requests on the instance that holds its connection if the app
    // ever runs on more than one.
    clientAffinityEnabled: true
    siteConfig: {
      linuxFxVersion: 'DOTNETCORE|10.0'
      appCommandLine: 'dotnet ScoreMap.Server.dll'
      webSocketsEnabled: true
      // Always On isn't available on F1. ScoreMap is fine sleeping when idle (ADR-0007).
      alwaysOn: false
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      // These replace all app settings on every run, so list every setting the app needs here.
      appSettings: [
        {
          // The deploy uploads an already-built app, so App Service must not build it again.
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          // Keeps container logs (see logs below) for 3 days.
          name: 'WEBSITE_HTTPLOGGING_RETENTION_DAYS'
          value: '3'
        }
      ]
    }
  }
}

// Container logs to the filesystem, for `az webapp log tail`.
resource logs 'Microsoft.Web/sites/config@2024-11-01' = {
  parent: app
  name: 'logs'
  properties: {
    httpLogs: {
      fileSystem: {
        enabled: true
        retentionInDays: 3
        retentionInMb: 100
      }
    }
  }
}

output url string = 'https://${app.properties.defaultHostName}'
