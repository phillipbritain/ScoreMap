variable "subscription_id" {
  type        = string
  description = "Azure subscription for the application resources."
}

variable "tenant_id" {
  type        = string
  description = "Entra tenant for the application resources."
}

variable "resource_group_name" {
  type        = string
  description = "Existing resource group containing the application resources."
}

variable "app_name" {
  type = string
}

variable "storage_account_name" {
  type = string
}

variable "vault_name" {
  type = string
}

variable "vault_purge_protection" {
  type    = bool
  default = true
}

variable "vault_retention_days" {
  type    = number
  default = 90
}

variable "github_subject" {
  type = string
}

variable "role_assignment_names" {
  type = object({
    deploy   = string
    join     = string
    feedback = string
  })
}

variable "image" {
  type        = string
  description = "Image of the latest healthy revision, or an existing GHCR image for a new app."
}
