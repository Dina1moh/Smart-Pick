# SmartPick - Run locally without Docker (Windows PowerShell)
# Creates venv, installs Python + Node deps, then starts backend and frontend.
#
# Usage:
#   .\run-local.ps1
#
# If blocked by execution policy (first time):
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
Set-Location $Root

$script:BackendProc = $null
$script:FrontendProc = $null

function Stop-SmartPick {
    Write-Host ""
    Write-Host "Shutting down..."

    foreach ($proc in @($script:BackendProc, $script:FrontendProc)) {
        if ($null -ne $proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
    }

    foreach ($port in 8000, 3000) {
        try {
            Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
                ForEach-Object {
                    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
                }
        }
        catch {
            # Get-NetTCPConnection may be unavailable; tracked PIDs above are enough.
        }
    }
}

function Get-PythonExecutable {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $versioned = & py -3.13 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $versioned) {
            return $versioned.Trim()
        }
        $default = & py -3 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $default) {
            return $default.Trim()
        }
    }

    if (Get-Command python -ErrorAction SilentlyContinue) {
        return (Get-Command python).Source
    }

    return $null
}

function Test-NeedNpmInstall {
    $nodeModules = Join-Path $Root "frontend\node_modules"
    $lockFile = Join-Path $Root "frontend\package-lock.json"

    if (-not (Test-Path $nodeModules)) {
        return $true
    }

    if ((Test-Path $lockFile) -and (Get-Item $lockFile).LastWriteTime -gt (Get-Item $nodeModules).LastWriteTime) {
        Write-Host "package-lock.json changed — refreshing frontend dependencies..."
        return $true
    }

    return $false
}

try {
    Write-Host "=== SmartPick local setup ==="
    Write-Host ""

    $pythonExe = Get-PythonExecutable
    if (-not $pythonExe) {
        Write-Host "Error: Python 3.13+ is required (CrewAI needs Python < 3.14)."
        Write-Host "       Install from https://www.python.org/downloads/ and enable 'Add to PATH'."
        exit 1
    }

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "Error: Node.js is required for the frontend."
        Write-Host "       Install from https://nodejs.org/"
        exit 1
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "Error: npm is required for the frontend."
        exit 1
    }

    Write-Host "Python: $(& $pythonExe --version)"
    Write-Host "Node:   $(node --version)"
    Write-Host "npm:    $(npm --version)"
    Write-Host ""

    $envFile = Join-Path $Root ".env"
    if (-not (Test-Path $envFile)) {
        Write-Host "Warning: .env not found at $envFile"
        Write-Host "         Create it with your API keys (OPENROUTER_API_KEY, APIFY_API_KEY, etc.)"
        Write-Host ""
    }

    # --- Backend: venv + pip packages ---
    $venvDir = Join-Path $Root "backend\venv"
    $venvPython = Join-Path $venvDir "Scripts\python.exe"

    if (-not (Test-Path $venvPython)) {
        Write-Host "Creating Python virtual environment..."
        & $pythonExe -m venv $venvDir
    }

    Write-Host "Installing/updating Python dependencies..."
    & $venvPython -m pip install -q --upgrade pip
    & $venvPython -m pip install -q -r (Join-Path $Root "backend\requirements.txt")
    Write-Host "Backend dependencies ready."
    Write-Host ""

    # --- Frontend: node_modules ---
    if (Test-NeedNpmInstall) {
        Write-Host "Installing frontend dependencies..."
        Push-Location (Join-Path $Root "frontend")
        try {
            npm ci 2>$null
            if ($LASTEXITCODE -ne 0) {
                npm install
            }
        }
        finally {
            Pop-Location
        }
    }
    Write-Host "Frontend dependencies ready."
    Write-Host ""

    $env:PYTHONUNBUFFERED = "1"
    $env:NEXT_PUBLIC_API_URL = if ($env:NEXT_PUBLIC_API_URL) { $env:NEXT_PUBLIC_API_URL } else { "http://localhost:8000" }

    Write-Host "Starting SmartPick..."
    Write-Host ""

    $npmCmd = (Get-Command npm).Source

    $script:BackendProc = Start-Process `
        -FilePath $venvPython `
        -ArgumentList "main.py" `
        -WorkingDirectory (Join-Path $Root "backend") `
        -PassThru `
        -WindowStyle Normal

    $script:FrontendProc = Start-Process `
        -FilePath $npmCmd `
        -ArgumentList "run", "dev" `
        -WorkingDirectory (Join-Path $Root "frontend") `
        -PassThru `
        -WindowStyle Normal

    Start-Sleep -Seconds 2

    Write-Host "=================================="
    Write-Host "  SmartPick is running!"
    Write-Host "  Frontend: http://localhost:3000"
    Write-Host "  Backend:  http://localhost:8000"
    Write-Host "  API Docs: http://localhost:8000/docs"
    Write-Host "=================================="
    Write-Host "  Press Ctrl+C to stop both services"
    Write-Host ""

    Wait-Process -Id @($script:BackendProc.Id, $script:FrontendProc.Id)
}
finally {
    Stop-SmartPick
}
