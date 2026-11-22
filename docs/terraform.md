# ScoreMap infrastructure with Terraform

[The Terraform root](../infra/terraform/) manages the existing Azure resources in `scoremap-rg`. The resource group, state account, Azure Files contents, and Key Vault secret versions have their own lifecycles. [GitHub Actions deploys the image](deploy.md#deploy-from-github-actions) using its existing federated identity. The workflow has no access to Terraform state.

## Planning from either computer

Install Terraform 1.13.5, Azure CLI and, for imports, Bash and jq. Sign in to the ScoreMap Entra tenant and select the production subscription. Use a principal with Reader on the workload group and Storage Blob Data Contributor on the state container for adoption and planning. Routine infrastructure writes also need Azure permissions for the specific changes.

```sh
cd infra/terraform
az login
az account set --subscription <production-subscription>
export TF_VAR_subscription_id="$(az account show --query id -o tsv)"
export TF_VAR_tenant_id="$(az account show --query tenantId -o tsv)"
terraform init -reconfigure -lockfile=readonly -backend-config=production.azurerm.tfbackend

az containerapp show -g scoremap-rg -n scoremap \
  --query 'properties.{configured:latestRevisionName,ready:latestReadyRevisionName}' -o table
# After configured and ready match, read the revision's image and confirm its health.
ready=$(az containerapp show -g scoremap-rg -n scoremap --query properties.latestReadyRevisionName -o tsv)
az containerapp revision show -g scoremap-rg -n scoremap --revision "$ready" \
  --query 'properties.{running:runningState,health:healthState}' -o table
export TF_VAR_image="$(az containerapp revision show -g scoremap-rg -n scoremap \
  --revision "$ready" --query 'properties.template.containers[?name==`scoremap`].image | [0]' -o tsv)"

terraform plan -input=false -lock-timeout=60s -var-file=production.tfvars -detailed-exitcode
```

Exit 0 is a clean plan, exit 2 means Terraform proposes changes, and exit 1 means the plan could not run. The default workspace uses the state key in the backend configuration. Both computers must use the same state key and provider lock file. Azure Blob leases serialize operations on the state. Keep state, plan files and provider debug logs out of Git and shared folders.

In PowerShell, after signing in and selecting the production subscription, use these equivalent commands from `infra/terraform`. Check the configured and ready revision names and the revision's health as above before planning.

```powershell
$env:TF_VAR_subscription_id = az account show --query id -o tsv
$env:TF_VAR_tenant_id = az account show --query tenantId -o tsv
terraform init -reconfigure '-lockfile=readonly' '-backend-config=production.azurerm.tfbackend'
$ready = az containerapp show -g scoremap-rg -n scoremap --query properties.latestReadyRevisionName -o tsv
$env:TF_VAR_image = az containerapp revision show -g scoremap-rg -n scoremap --revision $ready --query 'properties.template.containers[0].image' -o tsv
terraform plan -input=false '-lock-timeout=60s' '-var-file=production.tfvars' -detailed-exitcode
$LASTEXITCODE
```

## Adopting the existing deployment

1. Agree on the handoff window with the owner. Wait for the latest `main` deploy to complete and check that the live revision is healthy. Record its image and revision, identity IDs and role scopes, Key Vault reference, mounted share and log settings using only the needed fields from the Azure API. Check the state backend and that the production state is empty or contains only verified bindings from an interrupted adoption.
2. In the initialized Terraform root, with the same Azure account and environment variables as for a plan, import the existing objects. This reads the Azure resources and writes their bindings to the backend.

   ```sh
   ./import-existing.sh production.tfvars scoremap-rg scoremap scoremap5p5jgzyrw6mo6 kv-d5myowpdmim4s
   ```

   The script validates existing bindings and resumes at the first missing address. The Azure resource group remains an existing parent. The script imports 13 objects, including the Files share, the environment's mount definition, both identities and their three scoped role assignments.
3. Run the full refreshed plan from the previous section. Require exit 0, with all 13 bindings and no additions, changes, or deletions. A nonzero result stops adoption. There is no production apply in this procedure.
4. Repeat the init and plan on the second computer. Check the live app and compare the before and after Azure revision, image, identities, Files settings and logging. See [deployment checks](deploy.md#checking-it-works). Run another full plan after a normal image rollout. Get the owner's approval before submitting Feedback, which creates a public issue.

## Changing infrastructure

For a change that writes the Container App, coordinate a quiet window for image deploys and wait for any running workflow to complete. Fetch the healthy revision and image before planning. If you save a reviewed plan, set `umask 077` and keep it in private scratch space. Recheck the latest configured revision, ready revision and image immediately before applying. Abort and regenerate the plan if any changed. A state lock covers Terraform operations, while the workflow serializes image deploys separately.

The app definition uses a versionless Key Vault reference with the feedback managed identity. [Rotate the token in Key Vault](deploy.md#feedback-vault). The Azure Files and Log Analytics credential inputs are ephemeral and used only through the provider's write-only request body. The operator needs the corresponding Azure key access for any change that requires these inputs.

## State bootstrap

Run once as an Azure operator with rights to create the backend and its role assignments. Keep the backend in its own resource group. Follow the backend name and container in `production.azurerm.tfbackend`. Both machines need network access to its blob endpoint.

```sh
state_rg=scoremap-tfstate-rg
account=<storage-account-from-backend-config>
container=tfstate
operator_id=$(az ad signed-in-user show --query id -o tsv)
az group create -n "$state_rg" -l eastus2
az storage account create -g "$state_rg" -n "$account" -l eastus2 \
  --sku Standard_LRS --kind StorageV2 --https-only true --min-tls-version TLS1_2 \
  --allow-blob-public-access false --allow-shared-key-access false
az storage account blob-service-properties update -g "$state_rg" --account-name "$account" \
  --enable-versioning true --enable-delete-retention true --delete-retention-days 30 \
  --enable-container-delete-retention true --container-delete-retention-days 30
account_id=$(az storage account show -g "$state_rg" -n "$account" --query id -o tsv)
scope="$account_id/blobServices/default/containers/$container"
az rest --method put --url "https://management.azure.com$scope?api-version=2024-01-01" \
  --body '{"properties":{"publicAccess":"None"}}'
az role assignment create --assignee-object-id "$operator_id" --assignee-principal-type User \
  --role "Storage Blob Data Contributor" --scope "$scope"
az lock create -g "$state_rg" --resource-name "$account" --resource-type Microsoft.Storage/storageAccounts \
  -n terraform-state-delete-protection --lock-type CanNotDelete
```

The backend uses the standard public Azure blob endpoint so both computers can reach it, with Entra authentication, a private container, and shared key access disabled. Give each operator their own sign-in and container-scoped role. Check that initialization and a locked plan work on both computers.

## Recovery and rollback

Pause infrastructure writes and image deploys while investigating. For state recovery, identify the last good version of the production blob in Azure Storage Browser under **Versions**. Download it to private temporary storage and upload it over the current blob using Entra authorization. Under versioning, the previous current blob remains available. Compare the 13 IDs and run a fully refreshed plan before resuming changes. Restoring a blob restores Terraform's records only. If a blob lease remains, confirm its owner and that the Terraform process has stopped before releasing it.

If adoption fails, keep the live deployment in place and pause Terraform changes. If ownership must return to Bicep, the [Key Vault-compatible rollback revision](https://github.com/phillipbritain/ScoreMap/tree/0372fa1aee882aef74f02b78baa618489284733d) contains the templates and their deployment instructions. In a checkout of that revision, set `SCOREMAP_IMAGE` to the current healthy image and review the Bicep what-if before any write. Preserve the Key Vault, identities, role assignments and Files share. Terraform destroy is unsafe for rollback. If the image itself needs rollback, deploy the last known-good image using the same image-only update and check the new revision's health.
