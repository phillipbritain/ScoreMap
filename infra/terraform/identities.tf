resource "azurerm_key_vault" "feedback" {
  name                       = var.vault_name
  resource_group_name        = data.azurerm_resource_group.app.name
  location                   = data.azurerm_resource_group.app.location
  tenant_id                  = var.tenant_id
  sku_name                   = "standard"
  rbac_authorization_enabled = true
  purge_protection_enabled   = var.vault_purge_protection
  soft_delete_retention_days = var.vault_retention_days

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_user_assigned_identity" "feedback" {
  name                = "${var.app_name}-feedback"
  resource_group_name = data.azurerm_resource_group.app.name
  location            = data.azurerm_resource_group.app.location

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_user_assigned_identity" "github" {
  name                = "scoremap-github"
  resource_group_name = data.azurerm_resource_group.app.name
  location            = data.azurerm_resource_group.app.location

  lifecycle {
    prevent_destroy = true
  }
}

resource "azurerm_federated_identity_credential" "github" {
  name                      = "github-main"
  user_assigned_identity_id = azurerm_user_assigned_identity.github.id
  issuer                    = "https://token.actions.githubusercontent.com"
  audience                  = ["api://AzureADTokenExchange"]
  subject                   = var.github_subject
}

locals {
  role_definitions = "/subscriptions/${var.subscription_id}/providers/Microsoft.Authorization/roleDefinitions"
}

# Azure returns role scopes with lowercase "resourcegroups". AzureRM compares that segment exactly.
resource "azurerm_role_assignment" "feedback" {
  name               = var.role_assignment_names.feedback
  scope              = replace(azurerm_key_vault.feedback.id, "resourceGroups/", "resourcegroups/")
  role_definition_id = "${local.role_definitions}/4633458b-17de-408a-b874-0445c86b69e6"
  principal_id       = azurerm_user_assigned_identity.feedback.principal_id
  principal_type     = "ServicePrincipal"
}

resource "azurerm_role_assignment" "deploy" {
  name               = var.role_assignment_names.deploy
  scope              = replace(azapi_resource.app.id, "resourceGroups/", "resourcegroups/")
  role_definition_id = "${local.role_definitions}/358470bc-b998-42bd-ab17-a7e34c199c0f"
  principal_id       = azurerm_user_assigned_identity.github.principal_id
  principal_type     = "ServicePrincipal"
}

resource "azurerm_role_assignment" "join" {
  name               = var.role_assignment_names.join
  scope              = replace(azapi_resource.environment.id, "resourceGroups/", "resourcegroups/")
  role_definition_id = "${local.role_definitions}/f3bd1b5c-91fa-40e7-afe7-0c11d331232c"
  principal_id       = azurerm_user_assigned_identity.github.principal_id
  principal_type     = "ServicePrincipal"
}
