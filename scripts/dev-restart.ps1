# Stop broken dev server, clear .next cache, start MySQL + Next.js
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$Web = Join-Path $Root "apps\web"

Write-Host "Stopping process on port 3000..."
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

$NextDir = Join-Path $Web ".next"
if (Test-Path $NextDir) {
  Write-Host "Removing corrupted .next cache..."
  Remove-Item -Recurse -Force $NextDir -ErrorAction SilentlyContinue
  if (Test-Path $NextDir) {
    Write-Host "Could not delete .next — close Cursor/terminal using the dev server and run again."
    exit 1
  }
}

Write-Host "Starting local MySQL..."
& (Join-Path $Root "scripts\start-local-mysql.ps1")

$env:DATABASE_URL = "mysql://root@localhost:3306/dior_billing"
$env:SKIP_REDIS = "true"

Write-Host "Starting Next.js at http://localhost:3000 ..."
Set-Location $Web
npx next dev --port 3000
