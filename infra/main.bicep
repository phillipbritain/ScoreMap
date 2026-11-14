// ScoreMap on Azure Container Apps (ADR-0024): a Log Analytics workspace, a consumption Container Apps
// environment, a file share for the saved venue lookups, the container app itself (exactly one replica,
// always running), and the identity GitHub Actions deploys a new image as. Deploy into an existing
// resource group, see docs/deploy.md.
// Running it again changes nothing. Settings changed in the portal are put back to what's here.

@description('Name of the container app. The app is served at https://<appName>.<random>.<region>.azurecontainerapps.io until the custom domain is bound.')
param appName string = 'scoremap'

@description('Region for every resource. Defaults to the resource group\'s region.')
param location string = resourceGroup().location

@description('The image to run, as ghcr.io/<owner>/scoremap:<commit>. Required, so a run of the template never swaps the running image for a default; docs/deploy.md shows how to pass the running one.')
param image string

@description('vCPUs for the one replica. 0.25 goes with 0.5Gi of memory; 0.5 with 1Gi.')
param cpu string = '0.25'

@description('Memory for the one replica, matching cpu (0.25 with 0.5Gi, 0.5 with 1Gi).')
param memory string = '0.5Gi'

@description('The custom domain, such as scoremap.example.com, or empty for none. See docs/deploy.md for the DNS records it needs.')
param customDomain string = ''

@description('False on the first run with a new custom domain: the domain is added to the app unbound, so its managed certificate can be issued on the next run, which binds it.')
param bindCustomDomain bool = true

@description('How Azure proves the custom domain is ours before issuing its certificate: CNAME for a subdomain (www.example.com), HTTP for an apex domain (example.com).')
@allowed([
  'CNAME'
  'HTTP'
])
param customDomainValidation string = 'CNAME'

@description('Name of the managed identity GitHub Actions signs in to Azure as.')
param githubIdentityName string = 'scoremap-github'

@description('Subject of the GitHub token Azure trusts, naming the repo and branch. See docs/deploy.md.')
param githubSubject string

@secure()
@description('Fine-grained GitHub token that can only write this repo\'s issues, for filing feedback (docs/configuration.md). Left empty, feedback is only logged; main.bicepparam refuses that unless it\'s meant.')
param feedbackGitHubToken string = ''

// The app's logs, and Container Apps' own, for `az containerapp logs show`. The daily cap keeps it
// inside Log Analytics' free 5 GB a month; past it, logs stop until the next day (UTC).
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${appName}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: json('0.15')
    }
  }
}

// Consumption only: billed per second for what the replica uses, with nothing for the environment itself.
resource environment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: '${appName}-env'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

// The saved venue lookups, photos and event venues, on an Azure Files share so they survive a new
// revision. The name must be unique across Azure, so it ends in a hash of the resource group.
resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: take('${appName}${uniqueString(resourceGroup().id)}', 24)
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    // Container Apps mounts an SMB share with the account key.
    allowSharedKeyAccess: true
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2024-01-01' = {
  parent: storage
  name: 'default'
}

resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2024-01-01' = {
  parent: fileService
  name: 'data'
  properties: {
    shareQuota: 1 // GiB; the files are a few hundred KB
  }
}

resource environmentStorage 'Microsoft.App/managedEnvironments/storages@2025-01-01' = {
  parent: environment
  name: 'data'
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: share.name
      accessMode: 'ReadWrite'
    }
  }
}

var hasCustomDomain = !empty(customDomain)
var hasFeedbackToken = !empty(feedbackGitHubToken)

// Container Apps' free certificate for the custom domain, renewed by Azure. Issued only once the
// domain's DNS records point here and the domain is on the app (see bindCustomDomain).
resource certificate 'Microsoft.App/managedEnvironments/managedCertificates@2025-01-01' = if (hasCustomDomain && bindCustomDomain) {
  parent: environment
  name: replace(customDomain, '.', '-')
  location: location
  properties: {
    subjectName: customDomain
    domainControlValidation: customDomainValidation
  }
}

resource app 'Microsoft.App/containerApps@2025-01-01' = {
  name: appName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      // One revision at a time: a new one takes the traffic once it's ready, then the old one stops.
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080 // the aspnet image's default
        transport: 'auto' // HTTP/1.1 and HTTP/2, with WebSockets for SignalR
        allowInsecure: false // http:// is redirected to https://
        // SignalR: keep a browser's requests on the replica that holds its connection.
        stickySessions: {
          affinity: 'sticky'
        }
        customDomains: hasCustomDomain
          ? [
              {
                name: customDomain
                bindingType: bindCustomDomain ? 'SniEnabled' : 'Disabled'
                certificateId: bindCustomDomain ? certificate.id : null
              }
            ]
          : []
      }
      secrets: hasFeedbackToken
        ? [
            {
              name: 'feedback-github-token'
              value: feedbackGitHubToken
            }
          ]
        : []
    }
    template: {
      containers: [
        {
          name: 'scoremap'
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          // These replace all the app's settings on every run, so list every setting the app needs here.
          env: concat(
            [
              {
                // Each visitor's own address from the ingress's X-Forwarded-For, for feedback's per-visitor limit.
                name: 'ASPNETCORE_FORWARDEDHEADERS_ENABLED'
                value: 'true'
              }
              {
                name: 'Venues__SavedLocationsPath'
                value: '/data/venue-locations.json'
              }
              {
                name: 'Venues__SavedPhotosPath'
                value: '/data/venue-photos.json'
              }
              {
                name: 'Venues__SavedEventVenuesPath'
                value: '/data/event-venues.json'
              }
            ],
            hasFeedbackToken
              ? [
                  {
                    // Files feedback as issues in the repo (docs/configuration.md); passed in on each run.
                    name: 'Feedback__GitHubToken'
                    secretRef: 'feedback-github-token'
                  }
                ]
              : []
          )
          volumeMounts: [
            {
              volumeName: 'data'
              mountPath: '/data'
            }
          ]
          // No probes listed: Container Apps checks that the app accepts connections on targetPort
          // before a new revision takes the traffic, and restarts a replica that stops accepting them.
        }
      ]
      // Exactly one replica (ADR-0024): never zero, so a visitor never waits for a cold start; never two,
      // because the poller and game cache live in memory and a second replica would poll ESPN again.
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
      volumes: [
        {
          name: 'data'
          storageType: 'AzureFile'
          storageName: environmentStorage.name
          // The share is mounted as root unless told otherwise; the app runs as the image's user, 1654.
          mountOptions: 'uid=1654,gid=1654,dir_mode=0700,file_mode=0600'
        }
      ]
    }
  }
}

// GitHub Actions signs in as this identity, with no password stored anywhere: the federated
// credential tells Azure to trust GitHub's tokens for runs matching githubSubject.
resource githubIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: githubIdentityName
  location: location
}

resource githubMain 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: githubIdentity
  name: 'github-main'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: githubSubject
    audiences: [
      'api://AzureADTokenExchange'
    ]
  }
}

// Container Apps Contributor, on this one app only: enough to deploy a new revision of it.
var containerAppsContributor = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '358470bc-b998-42bd-ab17-a7e34c199c0f')

resource githubCanDeploy 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(app.id, githubIdentity.id, containerAppsContributor)
  scope: app
  properties: {
    roleDefinitionId: containerAppsContributor
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// Container Apps Operator on the environment: read it, and place the app's revision in it (join),
// which an update to the app needs. Grants nothing on the environment's settings.
var containerAppsOperator = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'f3bd1b5c-91fa-40e7-afe7-0c11d331232c')

resource githubCanJoin 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(environment.id, githubIdentity.id, containerAppsOperator)
  scope: environment
  properties: {
    roleDefinitionId: containerAppsOperator
    principalId: githubIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output url string = 'https://${app.properties.configuration.ingress.fqdn}'

// For the custom domain's DNS records (docs/deploy.md): the CNAME's target, the TXT record's value,
// and for an apex domain the A record's address.
output fqdn string = app.properties.configuration.ingress.fqdn
output customDomainVerificationId string = environment.properties.customDomainConfiguration.customDomainVerificationId
output staticIp string = environment.properties.staticIp

// For the GitHub secret AZURE_CLIENT_ID.
output githubClientId string = githubIdentity.properties.clientId
