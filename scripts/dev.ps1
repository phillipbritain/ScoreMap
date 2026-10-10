<#
.SYNOPSIS
    Starts, stops or reports on ScoreMap running locally: the server on http://localhost:5147 and
    the browser app (Vite) on http://localhost:5173.

.DESCRIPTION
    start   Builds the server into its bin\DevRun\, then starts the server exe and Vite's own node
            process directly, in the background, with their output in $env:TEMP\scoremap\. Its own
            build folder keeps the running exe from locking the one `dotnet test` builds into.
            Launching them directly (not
            through `dotnet run` or `npm run dev`) leaves no wrapper process behind whose stopping
            would orphan the real one. Refuses to start while anything from this repo is running.
            Runs the scenario set in appsettings.Development.json ("Scenario"), unless -Scenario
            names another, or "real" for real games (ADR-0009), with the scenario clock at the speed set
            there ("ScenarioSpeed"), unless -Speed sets another.
    stop    Stops every ScoreMap server and Vite process from this repo, including ones started some
            other way (`dotnet run`, `npm run dev`), then confirms nothing still answers.
    status  Lists those processes, when each started, and whether each port answers. For a run this
            script started, it names the branch and commit it was built from, and flags it STALE when
            another commit is checked out now. The server is probed at /api/leagues, since in
            development it answers / with 404 (Vite serves the browser app).

.PARAMETER Scenario
    With start: the scenario to run (a file name in server\src\ScoreMap.Server\Scenarios\Files,
    without .json), or "real" for real games. Unset, the default scenario from
    appsettings.Development.json runs.

.PARAMETER Speed
    With start: the speed the scenario clock starts at, by name: Paused, Normal, Fast or Faster (the
    speeds in Speed.All), in any case. Unset, the speed from appsettings.Development.json. The server
    refuses to start on any other, and its error (which lists the speeds) is shown.

.EXAMPLE
    ./scripts/dev.ps1 start

.EXAMPLE
    ./scripts/dev.ps1 start -Scenario busy -Speed Faster

.EXAMPLE
    ./scripts/dev.ps1 start -Scenario real
#>
param(
    [Parameter(Mandatory)] [ValidateSet('start', 'stop', 'status')] [string] $Action,
    [string] $Scenario,
    [string] $Speed
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$serverProject = Join-Path $repo 'server\src\ScoreMap.Server'
$serverOut = Join-Path $serverProject 'bin\DevRun'
$serverExe = Join-Path $serverOut 'ScoreMap.Server.exe'
$web = Join-Path $repo 'web'
$logs = Join-Path $env:TEMP 'scoremap'
# What start started, and from which commit, so status can tell how stale a run is.
$runFile = Join-Path $logs 'run.json'
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

# Waits for the process to answer at the URL. If it exits first (as the server does on a bad setting,
# such as a -Speed that isn't a speed), stops waiting and shows its error log too.
function Wait-Until-Answers([string] $url, [string] $what, [System.Diagnostics.Process] $process, [string] $log, [int] $seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline -and -not $process.HasExited) {
        if (Test-Answers $url) { Write-Output "$what up at $url"; return }
        Start-Sleep -Milliseconds 500
    }
    $why = if ($process.HasExited) { 'exited' } else { "did not answer at $url within $seconds s" }
    Write-Output "$what $why. Last lines of $log`:"
    Get-Content $log -Tail 20 -ErrorAction SilentlyContinue
    $errorLog = $log -replace '\.log$', '.err.log'
    if ((Test-Path $errorLog) -and (Get-Item $errorLog).Length -gt 0) {
        Write-Output "Last lines of $errorLog`:"
        Get-Content $errorLog -Tail 20
    }
    throw "$what failed to start"
}

function Get-Commit { git -C $repo rev-parse --short HEAD 2>$null }

function Show-Status {
    $running = @(Get-ScoreMapProcesses)
    if ($running.Count -eq 0) { Write-Output 'processes: none' }
    else {
        foreach ($p in $running) {
            $age = (Get-Date) - $p.CreationDate
            Write-Output ("process: $($p.ProcessId) $($p.Name), started $($p.CreationDate.ToString('g')) " +
                "($([int][math]::Floor($age.TotalHours))h $($age.Minutes)m ago): $($p.CommandLine)")
        }
        $run = if (Test-Path $runFile) { Get-Content $runFile -Raw | ConvertFrom-Json }
        if ($run -and ($running.ProcessId -contains $run.serverPid)) {
            Write-Output "run: started by dev.ps1 from $($run.branch) at $($run.commit)"
            $now = Get-Commit
            if ($run.commit -ne $now) {
                Write-Output "STALE: built from $($run.commit), but $now is checked out now; stop and start again to run it"
            }
        } else {
            Write-Output 'run: not started by dev.ps1, so what it was built from is unknown; stop and start again to be sure'
        }
    }
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
        Remove-Item $runFile -ErrorAction SilentlyContinue
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

        dotnet build $serverProject -v quiet -nologo -o $serverOut
        if ($LASTEXITCODE -ne 0) { throw 'Server build failed' }

        # The server's content root is its working directory, where it finds appsettings.json and data\.
        $env:ASPNETCORE_ENVIRONMENT = 'Development'
        $env:ASPNETCORE_URLS = 'http://localhost:5147'
        # Overrides the "Scenario" setting from appsettings.Development.json.
        if ($Scenario) { $env:Scenario = $Scenario }
        # Overrides the "ScenarioSpeed" setting, which the server checks against its speeds.
        if ($PSBoundParameters.ContainsKey('Speed')) { $env:ScenarioSpeed = $Speed }
        $server = Start-Process -FilePath $serverExe -WorkingDirectory $serverProject -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs 'server.log') -RedirectStandardError (Join-Path $logs 'server.err.log')
        Remove-Item Env:ASPNETCORE_URLS
        if ($Scenario) { Remove-Item Env:Scenario }
        if ($PSBoundParameters.ContainsKey('Speed')) { Remove-Item Env:ScenarioSpeed }

        # By absolute path, so its command line names this repo and Get-ScoreMapProcesses finds it.
        $vite = Start-Process -FilePath 'node' -ArgumentList "`"$web\node_modules\vite\bin\vite.js`"", '--strictPort' `
            -WorkingDirectory $web -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logs 'web.log') -RedirectStandardError (Join-Path $logs 'web.err.log')

        Write-Output "started server (pid $($server.Id)) and Vite (pid $($vite.Id)); logs in $logs"
        @{ serverPid = $server.Id; vitePid = $vite.Id; branch = (git -C $repo branch --show-current); commit = (Get-Commit) } |
            ConvertTo-Json | Set-Content $runFile -Encoding utf8
        try {
            Wait-Until-Answers $serverUrl 'server' $server (Join-Path $logs 'server.log') 60
            Wait-Until-Answers $webUrl 'web' $vite (Join-Path $logs 'web.log') 30
        } catch {
            # A failed start leaves nothing running, so the next start isn't refused.
            foreach ($p in @($server, $vite)) {
                if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
            }
            Remove-Item $runFile -ErrorAction SilentlyContinue
            Write-Output 'stopped what this start had started'
            throw
        }
    }
}
