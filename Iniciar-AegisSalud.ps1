$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $projectRoot 'backend'
$frontend = Join-Path $projectRoot 'aegis-salud'
$backendEnv = Join-Path $backend '.env'

if (-not (Test-Path $backendEnv)) {
    throw "No se encontró backend/.env. Configure primero la base de datos siguiendo backend/README.md."
}

$appEnv = (Get-Content $backendEnv | Where-Object { $_ -match '^APP_ENV=' } | Select-Object -First 1) -replace '^APP_ENV=', ''
if ($appEnv -ne 'local') {
    throw "Este iniciador solo se puede usar con APP_ENV=local; el valor actual es '$appEnv'."
}

function Test-TcpPort {
    param([string]$HostName, [int]$Port)

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $pending = $client.BeginConnect($HostName, $Port, $null, $null)
        if (-not $pending.AsyncWaitHandle.WaitOne(1000, $false)) {
            return $false
        }
        $client.EndConnect($pending)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

$databaseService = Get-Service -Name 'mysql' -ErrorAction SilentlyContinue
if ($databaseService -and $databaseService.Status -ne 'Running') {
    Write-Host 'Iniciando el servicio local MySQL/MariaDB...'
    try {
        Start-Service -Name 'mysql'
    }
    catch {
        throw "No se pudo iniciar el servicio mysql. Inícielo desde Servicios de Windows o el panel de XAMPP y vuelva a ejecutar este archivo. Detalle: $($_.Exception.Message)"
    }
}

$databaseReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-TcpPort -HostName '127.0.0.1' -Port 3306) {
        $databaseReady = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $databaseReady) {
    throw 'MySQL/MariaDB no responde en 127.0.0.1:3306. Revise que el servicio esté iniciado y la configuración DB_* de backend/.env.'
}

Write-Host 'Aplicando migraciones pendientes...'
Push-Location $backend
try {
    & php artisan migrate --force
    if ($LASTEXITCODE -ne 0) {
        throw 'Falló php artisan migrate. Revise las credenciales DB_* de backend/.env.'
    }

    Write-Host 'Asegurando las cuentas de demostración y los datos de muestra...'
    & php artisan db:seed --force
    if ($LASTEXITCODE -ne 0) {
        throw 'Falló php artisan db:seed. Revise AEGIS_DEMO_PASSWORD y la conexión a la base.'
    }
}
finally {
    Pop-Location
}

if (-not (Test-TcpPort -HostName '127.0.0.1' -Port 8000)) {
    Write-Host 'Iniciando la API Laravel...'
    $apiCommand = "Set-Location -LiteralPath '$backend'; php artisan serve --host=127.0.0.1 --port=8000"
    Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoExit -Command `"$apiCommand`""
}

$apiReady = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-TcpPort -HostName '127.0.0.1' -Port 8000) {
        $apiReady = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $apiReady) {
    throw 'La API Laravel no inició en 127.0.0.1:8000. Revise la ventana de Laravel para ver el error.'
}

if (-not (Test-TcpPort -HostName '127.0.0.1' -Port 4200)) {
    Write-Host 'Iniciando Angular...'
    $frontendCommand = "Set-Location -LiteralPath '$frontend'; npm.cmd start -- --host 127.0.0.1"
    Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoExit -Command `"$frontendCommand`""
}

$frontendReady = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (Test-TcpPort -HostName '127.0.0.1' -Port 4200) {
        $frontendReady = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $frontendReady) {
    throw 'Angular no inició en 127.0.0.1:4200. Revise la ventana de Angular y confirme que npm install se haya ejecutado.'
}

Write-Host ''
Write-Host 'Aegis Salud está listo: http://127.0.0.1:4200'
Write-Host 'Cuentas locales de prueba: la contraseña es el valor AEGIS_DEMO_PASSWORD de backend/.env.'
