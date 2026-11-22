resource "azapi_resource" "logs" {
  type      = "Microsoft.OperationalInsights/workspaces@2023-09-01"
  name      = "${var.app_name}-logs"
  parent_id = data.azurerm_resource_group.app.id
  location  = data.azurerm_resource_group.app.location

  body = {
    properties = {
      sku = {
        name = "PerGB2018"
      }
      retentionInDays = 30
      workspaceCapping = {
        dailyQuotaGb = 0.15
      }
    }
  }

  response_export_values = {
    customer_id = "properties.customerId"
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azapi_resource" "environment" {
  type      = "Microsoft.App/managedEnvironments@2025-01-01"
  name      = "${var.app_name}-env"
  parent_id = data.azurerm_resource_group.app.id
  location  = data.azurerm_resource_group.app.location

  body = {
    properties = {
      appLogsConfiguration = {
        destination = "log-analytics"
        logAnalyticsConfiguration = {
          customerId = azapi_resource.logs.output.customer_id
        }
      }
    }
  }

  sensitive_body = var.log_analytics_key == null ? null : {
    properties = {
      appLogsConfiguration = {
        logAnalyticsConfiguration = {
          sharedKey = var.log_analytics_key
        }
      }
    }
  }

  sensitive_body_version = var.log_analytics_key_version == null ? null : {
    "properties.appLogsConfiguration.logAnalyticsConfiguration.sharedKey" = var.log_analytics_key_version
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azapi_resource" "storage" {
  type      = "Microsoft.Storage/storageAccounts@2024-01-01"
  name      = var.storage_account_name
  parent_id = data.azurerm_resource_group.app.id
  location  = data.azurerm_resource_group.app.location

  body = {
    kind = "StorageV2"
    sku = {
      name = "Standard_LRS"
    }
    properties = {
      minimumTlsVersion        = "TLS1_2"
      supportsHttpsTrafficOnly = true
      allowBlobPublicAccess    = false
      allowSharedKeyAccess     = true
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_storage_share" "data" {
  name               = "data"
  storage_account_id = azapi_resource.storage.id
  quota              = 1

  lifecycle {
    prevent_destroy = true
  }
}

resource "azapi_resource" "mount" {
  type      = "Microsoft.App/managedEnvironments/storages@2025-01-01"
  name      = "data"
  parent_id = azapi_resource.environment.id

  body = {
    properties = {
      azureFile = {
        accountName = azapi_resource.storage.name
        shareName   = azurerm_storage_share.data.name
        accessMode  = "ReadWrite"
      }
    }
  }

  sensitive_body = var.files_account_key == null ? null : {
    properties = {
      azureFile = {
        accountKey = var.files_account_key
      }
    }
  }

  sensitive_body_version = var.files_account_key_version == null ? null : {
    "properties.azureFile.accountKey" = var.files_account_key_version
  }

  lifecycle {
    prevent_destroy = true
  }
}

variable "log_analytics_key" {
  type      = string
  default   = null
  sensitive = true
  ephemeral = true
}

variable "log_analytics_key_version" {
  type    = string
  default = null
}

variable "files_account_key" {
  type      = string
  default   = null
  sensitive = true
  ephemeral = true
}

variable "files_account_key_version" {
  type    = string
  default = null
}
