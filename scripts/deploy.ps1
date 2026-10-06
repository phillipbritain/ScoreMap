<#
.SYNOPSIS
    Publishes ScoreMap (server + browser app) and deploys it to an existing Azure App Service app.

.DESCRIPTION
    Runs `dotnet publish` (which also builds the browser app into wwwroot), zips the result with
    forward-slash paths (App Service on Linux needs them; Compress-Archive in Windows PowerShell
    writes backslashes), and zip-deploys it with the Azure CLI. Needs `az login` first, and the
    app created as described in docs/deploy.md.

.EXAMPLE
    ./scripts/deploy.ps1 -ResourceGroup scoremap-rg -AppName scoremap-phillip
#>
param(
    [Parameter(Mandatory)] [string] $ResourceGroup,
    [Parameter(Mandatory)] [string] $AppName
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$publish = Join-Path $repo 'publish'
$zip = Join-Path $repo 'publish.zip'

if (Test-Path $publish) { Remove-Item -Recurse -Force $publish }
if (Test-Path $zip) { Remove-Item -Force $zip }

dotnet publish (Join-Path $repo 'server/src/ScoreMap.Server') -c Release -o $publish
if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }
if (-not (Test-Path (Join-Path $publish 'wwwroot/index.html'))) { throw 'The publish output has no browser app (wwwroot/index.html)' }

$items = Get-ChildItem $publish | ForEach-Object Name
& "$env:SystemRoot\System32\tar.exe" -a -c -f $zip -C $publish @items
if ($LASTEXITCODE -ne 0) { throw 'Zipping the publish output failed' }

az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path $zip --type zip
if ($LASTEXITCODE -ne 0) { throw 'az webapp deploy failed' }

Write-Host "Deployed: https://$AppName.azurewebsites.net"
