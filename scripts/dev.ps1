<#
.SYNOPSIS
    Starts, stops or reports on ScoreMap running locally: the server on http://localhost:5147 and
    the browser app (Vite) on http://localhost:5173.

.DESCRIPTION
    start   Builds the server, then starts the server exe and Vite's own node process directly, in
            the background, with their output in $env:TEMP\scoremap\. Launching them directly (not
            through `dotnet run` or `npm run dev`) leaves no wrapper process behind whose stopping
            would orphan the real one. Refuses to start while anything from this repo is running.
    stop    Stops every ScoreMap server and Vite process from this repo, including ones started some
            other way (`dotnet run`, `npm run dev`), then confirms nothing still answers.
    status  Lists those processes and whether each port answers. The server is probed at
            /api/leagues, since in development it answers / with 404 (Vite serves the browser app).

.EXAMPLE
    ./scripts/dev.ps1 start
#>
param(
    [Parameter(Mandatory)] [ValidateSet('start', 'stop', 'status')] [string] $Action
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serverProject = Join-Path $repo 'server\src\ScoreMap.Server'
$serverExe = Join-Path $serverProject 'bin\Debug\net10.0\ScoreMap.Server.exe'
$web = Join-Path $repo 'web'
$logs = Join-Path $env:TEMP 'scoremap'
$serverUrl = 'http://localhost:5147/api/leagues'
$webUrl = 'http://localhost:5173/'

# The two processes of a running ScoreMap from this repo: the server exe and Vite's node process.
# Wrappers from other ways of starting it (dotnet run, npm, cmd) exit by themselves once these stop.
function Get-ScoreMapProcesses {
    Get-CimInstance Win32_Process | Where-Object {
        ($_.Name -eq 'ScoreMap.Server.exe' -and $_.ExecutablePath -like "$repo\*") -or
        ($_.Name -eq 'node.exe' -and $_.CommandLine -like "*$web\node_modules*vite\bin\vite.js*")
    }
}

function Test-Answers([string] $url) {
    try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 $url | Out-Null; $true } catch { $false }
}

function Wait-Until-Answers([string] $url, [string] $what, [string] $log, [int] $seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-Answers $url) { Write-Output "$what up at $url"; return }
        Start-Sleep -Milliseconds 500
    }
    Write-Output "$what did not answer at $url within $seconds s. Last lines of $log`:"
    Get-Content $log -Tail 20 -ErrorAction SilentlyContinue
    throw "$what failed to start"
}

function Show-Status {
    $running = @(Get-ScoreMapProcesses)
    if ($running.Count -eq 0) { Write-Output 'processes: none' }
    else { $running | ForEach-Object { Write-Output "process: $($_.ProcessId) $($_.Name) $($_.CommandLine)" } }
    Write-Output "server ($serverUrl): $(if (Test-Answers $serverUrl) { 'answering' } else { 'not answering' })"
    Write-Output "web ($webUrl): $(if (Test-Answers $webUrl) { 'answering' } else { 'not answering' })"
    Write-Output "logs: $logs"
}

switch ($Action) {
    'status' { Show-Status }

    'stop' {
        foreach ($p in Get-ScoreMapProcesses) {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
            Write-Output "stopped $($p.ProcessId) $($p.Name)"
        }
        Start-Sleep -Milliseconds 500
        $left = @(Get-ScoreMapProcesses)
        if ($left.Count -gt 0 -or (Test-Answers $serverUrl) -or (Test-Answers $webUrl)) {
            Show-Status
            throw 'Something is still running; see above'
        }
        Write-Output 'stopped: no ScoreMap processes left, and neither port answers'
    }

    'start' {
        $running = @(Get-ScoreMapProcesses)
        if ($running.Count -gt 0 -or (Test-Answers $serverUrl) -or (Test-Answers $webUrl)) {
            Show-Status
            throw 'ScoreMap is already running; run ./scripts/dev.ps1 stop first'
        }
        New-Item -ItemType Directory -Force $logs | Out-Null

        dotnet build $serverProject -v quiet -nologo
        if ($LASTEXITCODE -ne 0) { throw 'Server build failed' }

        # The server's content root is its working directory, where it finds appsettings.json and data\.
        $env:ASPNETCORE_ENVIRONMENT = 'Development'
        $env:ASPNETCORE_URLS = 'http://localhost:5147'
        $server = Start-Process -FilePath $serverExe -WorkingDirectory $serverProject -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server.err.log')
        Remove-Item Env:ASPNETCORE_URLS

        # By absolute path, so its command line names this repo and Get-ScoreMapProcesses finds it.
        $vite = Start-Process -FilePath 'node' -ArgumentList "`"$web\node_modules\vite\bin\vite.js`"", '--strictPort' `
            -WorkingDirectory $web -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs 'web.log') -RedirectStandardError (Join-Path $logs 'web.err.log')

        Write-Output "started server (pid $($server.Id)) and Vite (pid $($vite.Id)); logs in $logs"
        Wait-Until-Answers $serverUrl 'server' (Join-Path $logs 'server.log') 60
        Wait-Until-Answers $webUrl 'web' (Join-Path $logs 'web.log') 30
    }
}
