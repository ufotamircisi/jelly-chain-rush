Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Required = @(
  'src/assets/candies/yesil_jelibon_ayicik.png',
  'src/assets/candies/mor_jelibon.png',
  'src/assets/candies/kirmizi_kalp.png',
  'src/assets/candies/sari_yildiz.png',
  'src/assets/candies/mavi_seker.png',
  'src/assets/candies/turuncu_jelly_bean.png',
  'src/assets/candies/pembe_lollipop.png',
  'src/assets/candies/gokkusagi_seker.png',
  'src/assets/candies/special/enerji_yildizi.png',
  'src/assets/candies/special/renk_bombasi.png'
)

$Results = foreach ($relative in $Required) {
  $path = Join-Path $Root $relative
  if (-not (Test-Path -LiteralPath $path)) {
    [pscustomobject]@{
      File = $relative
      Exists = $false
      Size = ''
      TransparentCorners = $false
      AlphaPixels = 0
      EdgeHaloPixels = 0
    }
    continue
  }

  $img = [System.Drawing.Bitmap]::new($path)
  $alphaPixels = 0
  $edgeHaloPixels = 0
  $minX = $img.Width
  $minY = $img.Height
  $maxX = -1
  $maxY = -1

  for ($y = 0; $y -lt $img.Height; $y++) {
    for ($x = 0; $x -lt $img.Width; $x++) {
      $pixel = $img.GetPixel($x, $y)
      if ($pixel.A -gt 0) {
        $alphaPixels++
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }

  if ($alphaPixels -gt 0) {
    for ($y = [Math]::Max(0, $minY - 2); $y -le [Math]::Min($img.Height - 1, $maxY + 2); $y++) {
      for ($x = [Math]::Max(0, $minX - 2); $x -le [Math]::Min($img.Width - 1, $maxX + 2); $x++) {
        $pixel = $img.GetPixel($x, $y)
        if ($pixel.A -gt 0 -and $pixel.A -lt 60 -and $pixel.R -gt 245 -and $pixel.G -gt 245 -and $pixel.B -gt 245) {
          $edgeHaloPixels++
        }
      }
    }
  }

  $corners = @(
    $img.GetPixel(0, 0).A,
    $img.GetPixel($img.Width - 1, 0).A,
    $img.GetPixel(0, $img.Height - 1).A,
    $img.GetPixel($img.Width - 1, $img.Height - 1).A
  )

  [pscustomobject]@{
    File = $relative
    Exists = $true
    Size = "$($img.Width)x$($img.Height)"
    TransparentCorners = ($corners | Where-Object { $_ -ne 0 }).Count -eq 0
    AlphaPixels = $alphaPixels
    EdgeHaloPixels = $edgeHaloPixels
  }

  $img.Dispose()
}

$Results | Format-Table -AutoSize

$Failures = $Results | Where-Object {
  -not $_.Exists -or $_.Size -ne '256x256' -or -not $_.TransparentCorners -or $_.AlphaPixels -le 0 -or $_.EdgeHaloPixels -gt 0
}

if ($Failures) {
  throw 'Candy asset validation failed.'
}

Write-Host 'Candy asset validation passed.'
