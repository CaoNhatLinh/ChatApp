param(
    [string]$JdkPath = $env:JAVA_HOME,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $repoRoot 'chat-service'
$frontendPath = Join-Path $repoRoot 'chatapp_frontend'
$schemaPath = Join-Path $repoRoot 'chat_app_complete.cql'
. (Join-Path $PSScriptRoot 'local-schema.ps1')
$jobs = @()

function Invoke-Docker {
    param([string[]]$Arguments)
    # Windows PowerShell 5.1 treats successful native stderr as ErrorRecords.
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = @(& $script:dockerPath @Arguments 2>&1 | ForEach-Object { "$_" })
        $nativeExitCode = $LASTEXITCODE
    } finally { $ErrorActionPreference = $previousPreference }
    if ($nativeExitCode -ne 0) { throw "Docker command failed: $($output -join [Environment]::NewLine)" }
    return $output
}

function Wait-LocalHttp {
    param([string]$Url, [int]$TimeoutSeconds, [object]$Job)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if ($Job.State -notin @('Running', 'NotStarted')) {
            Receive-Job $Job | Out-Host
            throw "Server stopped before becoming ready: $($Job.Name)"
        }
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -eq 200) { return }
        } catch { }
        Start-Sleep -Seconds 2
    }
    Receive-Job $Job | Out-Host
    throw "Timed out waiting for $Url"
}

try {
    $dockerCommand = Get-Command docker -ErrorAction SilentlyContinue
    if ($dockerCommand) { $script:dockerPath = $dockerCommand.Source }
    else {
        $script:dockerPath = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
        if (-not (Test-Path -LiteralPath $script:dockerPath)) {
            throw 'Install and open Docker Desktop (WSL 2 / Linux containers), then run npm run local again. See docs/LOCAL_WINDOWS_SETUP.md.'
        }
    }
    $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
    if (-not $PSBoundParameters.ContainsKey('JdkPath') -and (Test-Path 'C:\Program Files\Java\jdk-20\bin\java.exe')) {
        $JdkPath = 'C:\Program Files\Java\jdk-20'
    }
    if (-not $JdkPath -or -not (Test-Path (Join-Path $JdkPath 'bin/java.exe'))) {
        $JdkPath = 'C:\Program Files\Java\jdk-20'
    }
    if (-not (Test-Path (Join-Path $JdkPath 'bin/java.exe'))) { throw 'JDK 20+ is required. Pass -JdkPath or set JAVA_HOME.' }
    try {
        $ErrorActionPreference = 'Continue'
        $javaVersion = (& (Join-Path $JdkPath 'bin/java.exe') -version 2>&1 | Out-String)
    } finally { $ErrorActionPreference = 'Stop' }
    if ($javaVersion -notmatch 'version "(\d+)\.' -or [int]$Matches[1] -lt 20) {
        throw 'JAVA_HOME points to Java older than 20. Select the installed JDK 20 with -JdkPath.'
    }
    $backendEnv = Join-Path $backendPath '.env'
    if (-not (Test-Path $backendEnv)) {
        if ($CheckOnly) { throw 'Backend .env is missing; a normal launch will create local defaults with a random JWT key.' }
        $keyBytes = New-Object byte[] 48
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($keyBytes) } finally { $random.Dispose() }
        $configuration = Get-Content (Join-Path $backendPath '.env.example') -Raw
        $configuration = [regex]::Replace($configuration, '(?m)^JWT_SECRET=.*$', "JWT_SECRET=$([Convert]::ToBase64String($keyBytes))")
        [IO.File]::WriteAllText($backendEnv, $configuration, (New-Object Text.UTF8Encoding $false))
        Write-Host 'Created backend local configuration with a random JWT key. Google/Cloudinary remain disabled until configured.'
    }
    $settings = @{}
    foreach ($line in Get-Content -LiteralPath $backendEnv) {
        if ($line -match '^([A-Z_]+)=(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim() }
    }
    $jwt = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { $settings['JWT_SECRET'] }
    if (-not $jwt -or [Convert]::FromBase64String($jwt).Length -lt 32) { throw 'JWT_SECRET must be Base64 of at least 32 random bytes.' }
    $googleEnabled = if ($env:GOOGLE_AUTH_ENABLED) { $env:GOOGLE_AUTH_ENABLED } else { $settings['GOOGLE_AUTH_ENABLED'] }
    $credentialPath = if ($env:GOOGLE_APPLICATION_CREDENTIALS) { $env:GOOGLE_APPLICATION_CREDENTIALS } else { $settings['GOOGLE_APPLICATION_CREDENTIALS'] }
    if ($googleEnabled -eq 'true' -and $credentialPath -and -not (Test-Path -LiteralPath $credentialPath)) {
        throw 'Configured Google credential file does not exist. Fix its local path; do not commit the credential.'
    }
    Invoke-Docker @('info', '--format', '{{.ServerVersion}}') | Out-Null
    Invoke-Docker @('compose', 'version') | Out-Host
    if ($CheckOnly) { Write-Host 'Local prerequisites passed. Nothing was started or changed.'; return }
    $frontendEnv = Join-Path $frontendPath '.env'
    if (-not (Test-Path $frontendEnv)) {
        Copy-Item -LiteralPath (Join-Path $frontendPath '.env.example') -Destination $frontendEnv
        Write-Host 'Created frontend local API/WebSocket defaults. Existing .env.local was preserved.'
    }
    foreach ($port in @(8084, 3000)) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
            throw "Port $port is already in use. Stop its owning app before running this launcher."
        }
    }

    Push-Location $backendPath
    try {
        Write-Host 'Starting Cassandra, Redis, Kafka and Elasticsearch; first image download may take several minutes...'
        Invoke-Docker @('compose', 'up', '-d', '--wait', '--wait-timeout', '300', 'cassandra', 'redis', 'kafka', 'elasticsearch') | Out-Host
        $columns = @(ConvertFrom-CqlJsonRows (Invoke-Docker @('compose', 'exec', '-T', 'cassandra', 'cqlsh', '-e', "SELECT JSON table_name, column_name, type, kind FROM system_schema.columns WHERE keyspace_name = 'chat_app';")))
        $types = @(ConvertFrom-CqlJsonRows (Invoke-Docker @('compose', 'exec', '-T', 'cassandra', 'cqlsh', '-e', "SELECT JSON type_name, field_names, field_types FROM system_schema.types WHERE keyspace_name = 'chat_app';")))
        if ($columns.Count -eq 0 -and $types.Count -eq 0) {
            Write-Host 'Empty database: initializing the current canonical schema (no migrations).'
            Invoke-Docker @('compose', 'run', '--rm', 'cassandra-schema') | Out-Host
            $columns = @(ConvertFrom-CqlJsonRows (Invoke-Docker @('compose', 'exec', '-T', 'cassandra', 'cqlsh', '-e', "SELECT JSON table_name, column_name, type, kind FROM system_schema.columns WHERE keyspace_name = 'chat_app';")))
            $types = @(ConvertFrom-CqlJsonRows (Invoke-Docker @('compose', 'exec', '-T', 'cassandra', 'cqlsh', '-e', "SELECT JSON type_name, field_names, field_types FROM system_schema.types WHERE keyspace_name = 'chat_app';")))
        }
        $typeColumns = @(
            foreach ($type in $types) {
                for ($index = 0; $index -lt $type.field_names.Count; $index++) {
                    [pscustomobject]@{ table_name = $type.type_name; column_name = $type.field_names[$index]; type = $type.field_types[$index]; kind = 'regular' }
                }
            }
        )
        $differences = @(Get-LocalSchemaDifferences @(Get-LocalSchemaColumns $schemaPath) $columns)
        $differences += @(Get-LocalSchemaDifferences @(Get-LocalSchemaColumns $schemaPath -Kind TYPE) $typeColumns)
        if ($differences.Count) {
            throw "Database does not match the current canonical columns/types. No migration or data deletion was performed.`n$($differences -join [Environment]::NewLine)"
        }
        Write-Host 'Canonical tables, columns and UDT fields checked. Existing data was not deleted.'
    } finally { Pop-Location }

    if (-not (Test-Path (Join-Path $frontendPath 'node_modules/next/package.json'))) {
        Push-Location $frontendPath
        try {
            & $npmPath ci
            if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }
        } finally { Pop-Location }
    }
    $backendJob = Start-Job -Name 'Noi-backend' -ArgumentList $backendPath, $JdkPath -ScriptBlock {
        param($directory, $jdk)
        Set-Location -LiteralPath $directory
        $env:JAVA_HOME = $jdk
        $env:PATH = "$jdk\bin;$env:PATH"
        & .\mvnw.cmd spring-boot:run
        if ($LASTEXITCODE -ne 0) { throw 'Backend process failed.' }
    }
    $jobs += $backendJob
    Write-Host 'Waiting for backend health at localhost:8084...'
    Wait-LocalHttp 'http://localhost:8084/actuator/health' 240 $backendJob
    $frontendJob = Start-Job -Name 'Noi-frontend' -ArgumentList $frontendPath, $npmPath -ScriptBlock {
        param($directory, $npm)
        Set-Location -LiteralPath $directory
        & $npm run dev -- --port 3000
        if ($LASTEXITCODE -ne 0) { throw 'Frontend process failed.' }
    }
    $jobs += $frontendJob
    Wait-LocalHttp 'http://localhost:3000' 120 $frontendJob
    Write-Host 'Noi is running: http://localhost:3000 | Ctrl+C stops this launcher and its app jobs. Docker/data remain available.'
    while ($true) {
        foreach ($job in $jobs) {
            Receive-Job $job | Out-Host
            if ($job.State -notin @('Running', 'NotStarted')) { throw "$($job.Name) stopped." }
        }
        Start-Sleep -Seconds 1
    }
} catch {
    Write-Host "Startup stopped: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    foreach ($job in $jobs) { Stop-Job $job; Remove-Job $job -Force }
}
