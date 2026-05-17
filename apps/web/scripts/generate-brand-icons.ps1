# Regenerate all brand / favicon assets from a single source PNG.
param(
  [string]$Source = "",
  [string]$OutDir = "$PSScriptRoot\..\public"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

if (-not $Source) {
  $candidates = @(
    "$PSScriptRoot\..\..\..\assets\*favicon*.png",
    "$env:USERPROFILE\.cursor\projects\c-Users-xd-user-Desktop-dior-web-billing\assets\*favicon*.png"
  )
  foreach ($pattern in $candidates) {
    $found = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($found) { $Source = $found.FullName; break }
  }
}

if (-not (Test-Path $Source)) {
  Write-Error "Source PNG not found. Pass -Source path to the blue DIOR mark."
}

$OutDir = (Resolve-Path $OutDir).Path
$shellBg = [System.Drawing.Color]::FromArgb(255, 7, 11, 20)

function Save-BrandPng {
  param([int]$Size, [string]$Name, [double]$PaddingRatio = 0.12)

  $srcImg = [System.Drawing.Image]::FromFile($Source)
  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear($shellBg)

  $pad = [int][Math]::Round($Size * $PaddingRatio)
  $inner = $Size - (2 * $pad)
  $g.DrawImage($srcImg, $pad, $pad, $inner, $inner)

  $path = Join-Path $OutDir $Name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $g.Dispose()
  $bmp.Dispose()
  $srcImg.Dispose()
  Write-Host "  $Name ($Size px)"
}

Write-Host "Source: $Source"
Write-Host "Output: $OutDir"

foreach ($s in @(16, 32, 48)) {
  Save-BrandPng -Size $s -Name "favicon-$s.png" -PaddingRatio 0.1
  Save-BrandPng -Size $s -Name "icon-$s.png" -PaddingRatio 0.1
}

Save-BrandPng -Size 128 -Name "logo-icon.png" -PaddingRatio 0.08
Save-BrandPng -Size 128 -Name "logo-mark.png" -PaddingRatio 0.08
Save-BrandPng -Size 180 -Name "apple-touch-icon.png" -PaddingRatio 0.1
Save-BrandPng -Size 180 -Name "icon-180.png" -PaddingRatio 0.1
Save-BrandPng -Size 192 -Name "icon-192.png" -PaddingRatio 0.1
Save-BrandPng -Size 512 -Name "icon-512.png" -PaddingRatio 0.08
Save-BrandPng -Size 256 -Name "logo-brand.png" -PaddingRatio 0.08

# favicon.ico from 32px asset
$icoPath = Join-Path $OutDir "favicon.ico"
$icon32 = [System.Drawing.Bitmap]::FromFile((Join-Path $OutDir "icon-32.png"))
$iconHandle = $icon32.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$fs = [System.IO.File]::Create($icoPath)
$icon.Save($fs)
$fs.Close()
$icon.Dispose()
$icon32.Dispose()
Write-Host "  favicon.ico"

# Next.js app directory file-based icons
$appDir = Join-Path $PSScriptRoot "..\src\app"
Copy-Item (Join-Path $OutDir "icon-32.png") (Join-Path $appDir "icon.png") -Force
Copy-Item (Join-Path $OutDir "apple-touch-icon.png") (Join-Path $appDir "apple-icon.png") -Force
Write-Host "  src/app/icon.png + apple-icon.png"

Write-Host "Done."
