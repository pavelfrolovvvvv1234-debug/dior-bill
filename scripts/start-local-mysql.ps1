# Local MySQL without Docker — run once per Windows session
$Root = Split-Path -Parent $PSScriptRoot
$MysqlBin = "C:\Program Files\MySQL\MySQL Server 8.4\bin"
$DataDir = Join-Path $Root ".local-mysql\data"
$Ini = Join-Path $Root ".local-mysql\my.ini"

if (-not (Test-Path "$MysqlBin\mysqld.exe")) {
  Write-Host "Install MySQL first: winget install Oracle.MySQL"
  exit 1
}

if (-not (Test-Path "$DataDir\mysql")) {
  Write-Host "Initializing database..."
  & "$MysqlBin\mysqld.exe" --defaults-file="$Ini" --initialize-insecure --datadir="$DataDir"
}

$running = Get-NetTCPConnection -LocalPort 3306 -ErrorAction SilentlyContinue
if (-not $running) {
  Write-Host "Starting MySQL on port 3306..."
  Start-Process -FilePath "$MysqlBin\mysqld.exe" -ArgumentList "--defaults-file=`"$Ini`"" -WindowStyle Hidden
  Start-Sleep -Seconds 6
}

& "$MysqlBin\mysql.exe" -uroot -e "CREATE DATABASE IF NOT EXISTS dior_billing; SELECT 'MySQL OK' AS status;"
Write-Host "Done. DATABASE_URL=mysql://root@localhost:3306/dior_billing"
