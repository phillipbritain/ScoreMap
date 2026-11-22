terraform {
  required_version = "~> 1.13.5"

  required_providers {
    azapi = {
      source  = "Azure/azapi"
      version = "2.14.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "5.14.0"
    }
  }

  backend "azurerm" {
    use_azuread_auth = true
    use_cli          = true
  }
}

provider "azapi" {
  subscription_id            = var.subscription_id
  tenant_id                  = var.tenant_id
  skip_provider_registration = true
  enable_preflight           = false
  disable_default_output     = true
}

provider "azurerm" {
  subscription_id                 = var.subscription_id
  tenant_id                       = var.tenant_id
  resource_provider_registrations = "none"

  features {}
}
