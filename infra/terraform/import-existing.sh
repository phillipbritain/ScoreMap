#!/usr/bin/env bash
set -euo pipefail

if [[ $# != 5 ]]; then
  echo "Usage: $0 VAR_FILE RESOURCE_GROUP APP STORAGE_ACCOUNT VAULT" >&2
  exit 1
fi

vars=$1
rg=$2
app=$3
storage=$4
vault=$5
subscription=${TF_VAR_subscription_id:?Set TF_VAR_subscription_id before importing}
tenant=${TF_VAR_tenant_id:?Set TF_VAR_tenant_id before importing}
: "${TF_VAR_image:?Set TF_VAR_image to the latest healthy image}"

if [[ $(az account show --query id -o tsv) != "$subscription" ||
      $(az account show --query tenantId -o tsv) != "$tenant" ]]; then
  echo "The active Azure CLI account differs from Terraform's tenant or subscription." >&2
  exit 1
fi

if [[ $(terraform workspace show) != default ]]; then
  echo "Select the default workspace for the configured backend state key." >&2
  exit 1
fi

group_id=$(az group show -n "$rg" --query id -o tsv)
app_id="$group_id/providers/Microsoft.App/containerApps/$app"
env_id="$group_id/providers/Microsoft.App/managedEnvironments/$app-env"
logs_id="$group_id/providers/Microsoft.OperationalInsights/workspaces/$app-logs"
storage_id="$group_id/providers/Microsoft.Storage/storageAccounts/$storage"
share_id="$storage_id/fileServices/default/shares/data"
vault_id="$group_id/providers/Microsoft.KeyVault/vaults/$vault"
github_id="$group_id/providers/Microsoft.ManagedIdentity/userAssignedIdentities/scoremap-github"
feedback_id="$group_id/providers/Microsoft.ManagedIdentity/userAssignedIdentities/$app-feedback"

role_id() {
  az role assignment list --scope "$1" --assignee-object-id "$2" --role "$3" \
    --fill-principal-name false -o json | jq -r --arg scope "$1" '
      .[] | select((.scope | ascii_downcase) == ($scope | ascii_downcase)) | .id
    '
}

github_principal=$(az identity show -g "$rg" -n scoremap-github --query principalId -o tsv)
feedback_principal=$(az identity show -g "$rg" -n "$app-feedback" --query principalId -o tsv)
deploy_role=$(role_id "$app_id" "$github_principal" "Container Apps Contributor")
join_role=$(role_id "$env_id" "$github_principal" "Container Apps Operator")
feedback_role=$(role_id "$vault_id" "$feedback_principal" "Key Vault Secrets User")

for id in "$deploy_role" "$join_role" "$feedback_role"; do
  if [[ $id != /*/roleAssignments/* || $id == *$'\n'* ]]; then
    echo "Expected one existing role assignment per workload role and scope." >&2
    exit 1
  fi
done

addresses=(
  azurerm_key_vault.feedback
  azurerm_user_assigned_identity.feedback
  azurerm_user_assigned_identity.github
  azurerm_federated_identity_credential.github
  azapi_resource.logs
  azapi_resource.storage
  azurerm_storage_share.data
  azapi_resource.environment
  azapi_resource.mount
  azapi_resource.app
  azurerm_role_assignment.feedback
  azurerm_role_assignment.deploy
  azurerm_role_assignment.join
)

ids=(
  "$vault_id"
  "$feedback_id"
  "$github_id"
  "$github_id/federatedIdentityCredentials/github-main"
  "$logs_id?api-version=2023-09-01"
  "$storage_id?api-version=2024-01-01"
  "$share_id"
  "$env_id?api-version=2025-01-01"
  "$env_id/storages/data?api-version=2025-01-01"
  "$app_id?api-version=2025-01-01"
  "$feedback_role"
  "$deploy_role"
  "$join_role"
)

read_state() {
  terraform state pull | jq -r '
    .resources[] | select(.mode == "managed") |
    [.type, .name] as $address |
    .instances[] | [$address | join(".")] + [.attributes.id] | @tsv
  '
}

check_bindings() {
  while IFS=$'\t' read -r address id; do
    [[ -n $address ]] || continue
    found=false
    for i in "${!addresses[@]}"; do
      if [[ $address == "${addresses[i]}" ]]; then
        expected=${ids[i]%%\?*}
        if [[ $(lowercase "${id%%\?*}") == "$(lowercase "$expected")" ]]; then
          found=true
        fi
        break
      fi
    done
    if [[ $found != true ]]; then
      echo "Unexpected state binding for $address. Check the selected backend and state." >&2
      exit 1
    fi
  done < <(printf '%s\n' "$bindings")
}

lowercase() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

bindings=$(read_state)
check_bindings
for i in "${!addresses[@]}"; do
  address=${addresses[i]}
  if ! printf '%s\n' "$bindings" | cut -f1 | grep -Fxq "$address"; then
    terraform import -input=false -lock-timeout=60s -var-file="$vars" "$address" "${ids[i]}"
    bindings=$(read_state)
    check_bindings
  fi
done

if [[ $(printf '%s\n' "$bindings" | wc -l) -ne ${#addresses[@]} ]]; then
  echo "State does not contain exactly ${#addresses[@]} managed bindings." >&2
  exit 1
fi
echo "Confirmed all ${#addresses[@]} resource addresses and Azure IDs. Run a full refreshed plan."
