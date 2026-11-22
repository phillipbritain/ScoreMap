@description('Name of the Container App that reads the feedback token.')
param appName string = 'scoremap'

param location string = resourceGroup().location

// Deploy this module by itself during setup so the token can be seeded before the app needs it.
resource vault 'Microsoft.KeyVault/vaults@2024-11-01' = {
  name: 'kv-${uniqueString(resourceGroup().id, appName)}'
  location: location
  properties: {
    tenantId: tenant().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enablePurgeProtection: true
  }
}

resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${appName}-feedback'
  location: location
}

// This vault holds only the feedback token. The app can read secrets, and the deployment identity
// GitHub Actions signs in as receives no role on the vault.
var secretsUser = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
resource appCanReadSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, appIdentity.id, secretsUser)
  scope: vault
  properties: {
    roleDefinitionId: secretsUser
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output vaultName string = vault.name
output identityId string = appIdentity.id
output secretUrl string = '${vault.properties.vaultUri}secrets/feedback-github-token'
