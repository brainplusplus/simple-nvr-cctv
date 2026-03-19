$backendEnv = Join-Path $PSScriptRoot "apps\backend\.env"
$frontendEnv = Join-Path $PSScriptRoot "apps\frontend\.env"
$proxyEnv = Join-Path $PSScriptRoot "apps\reverse-proxy\.env"

$backendPort = 3001
$frontendPort = 3002
$proxyPort = 7777

function Get-PortFromEnv($envPath) {
    if (Test-Path $envPath) {
        $content = Get-Content $envPath
        foreach ($line in $content) {
            if ($line -match "^PORT=(\d+)") {
                return $matches[1]
            }
        }
    }
    return $null
}

$bPort = Get-PortFromEnv $backendEnv
if ($bPort) { $backendPort = $bPort }

$fPort = Get-PortFromEnv $frontendEnv
if ($fPort) { $frontendPort = $fPort }

$pPort = Get-PortFromEnv $proxyEnv
if ($pPort) { $proxyPort = $pPort }

Write-Host "Killing processes on ports: Frontend=$frontendPort, Backend=$backendPort, Proxy=$proxyPort"

function Kill-Port($port) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $pidTarget = $conn.OwningProcess
            if ($pidTarget -gt 0) {
                 Write-Host "Killing process $pidTarget on port $port"
                 Stop-Process -Id $pidTarget -Force -ErrorAction SilentlyContinue
            }
        }
    } else {
        Write-Host "No process listening on port $port"
    }
}

Kill-Port $frontendPort
Kill-Port $backendPort
Kill-Port $proxyPort
