data "azurerm_resource_group" "app" {
  name = var.resource_group_name
}

resource "azapi_resource" "app" {
  type      = "Microsoft.App/containerApps@2025-01-01"
  name      = var.app_name
  parent_id = data.azurerm_resource_group.app.id
  location  = data.azurerm_resource_group.app.location

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.feedback.id]
  }

  body = {
    properties = {
      managedEnvironmentId = azapi_resource.environment.id
      configuration = {
        activeRevisionsMode = "Single"
        ingress = {
          external      = true
          targetPort    = 8080
          transport     = "Auto"
          allowInsecure = false
          stickySessions = {
            affinity = "sticky"
          }
          traffic = [{ latestRevision = true, weight = 100 }]
        }
        secrets = [{
          name        = "feedback-github-token-kv"
          keyVaultUrl = "${azurerm_key_vault.feedback.vault_uri}secrets/feedback-github-token"
          identity    = azurerm_user_assigned_identity.feedback.id
        }]
      }
      template = {
        containers = [{
          name  = "scoremap"
          image = var.image
          resources = {
            cpu    = 0.25
            memory = "0.5Gi"
          }
          env = [
            { name = "ASPNETCORE_FORWARDEDHEADERS_ENABLED", value = "true" },
            { name = "Venues__SavedLocationsPath", value = "/data/venue-locations.json" },
            { name = "Venues__SavedPhotosPath", value = "/data/venue-photos.json" },
            { name = "Venues__SavedEventVenuesPath", value = "/data/event-venues.json" },
            { name = "Feedback__GitHubToken", secretRef = "feedback-github-token-kv" },
          ]
          volumeMounts = [{ volumeName = "data", mountPath = "/data" }]
        }]
        scale = {
          minReplicas = 1
          maxReplicas = 1
        }
        volumes = [{
          name         = "data"
          storageType  = "AzureFile"
          storageName  = azapi_resource.mount.name
          mountOptions = "uid=1654,gid=1654,dir_mode=0700,file_mode=0600"
        }]
      }
    }
  }

  depends_on = [azurerm_role_assignment.feedback]

  lifecycle {
    prevent_destroy = true
    # GitHub Actions updates the one ScoreMap container's image.
    ignore_changes = [body.properties.template.containers[0].image]
  }
}
