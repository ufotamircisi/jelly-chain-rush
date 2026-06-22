$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$expected = @(
  'seker_tezgahi',
  'jelibon_standi',
  'lollipop_arabasi',
  'dondurma_bufesi',
  'seker_dukkani',
  'marshmallow_evi',
  'karamel_atolyesi',
  'jelibon_atolyesi',
  'renk_karistirma_laboratuvari',
  'enerji_yildizi_jeneratoru',
  'seker_fabrikasi',
  'paketleme_merkezi',
  'seker_treni_duragi',
  'cikolata_koprusu',
  'seker_limani',
  'buyuk_seker_meydani',
  'x1000_carpan_kulesi',
  'mega_seker_sarayi'
)

Add-Type -AssemblyName System.Drawing

function Test-PngSignature {
  param([string]$Path)

  $expectedSignature = [byte[]](137, 80, 78, 71, 13, 10, 26, 10)
  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -lt $expectedSignature.Length) {
    return $false
  }

  for ($index = 0; $index -lt $expectedSignature.Length; $index += 1) {
    if ($bytes[$index] -ne $expectedSignature[$index]) {
      return $false
    }
  }

  return $true
}

function Test-NearWhite {
  param([System.Drawing.Color]$Color)

  $spread = [Math]::Max($Color.R, [Math]::Max($Color.G, $Color.B)) - [Math]::Min($Color.R, [Math]::Min($Color.G, $Color.B))
  return $Color.A -gt 245 -and $Color.R -gt 245 -and $Color.G -gt 245 -and $Color.B -gt 245 -and $spread -lt 12
}

function Get-ImageReport {
  param(
    [string]$State,
    [string]$Slug,
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return [pscustomobject]@{
      State = $State
      Slug = $Slug
      Status = 'MISSING'
      Dimensions = ''
      Bytes = 0
      HasAlpha = ''
      TransparentCorners = ''
      Warnings = 'missing file'
    }
  }

  $item = Get-Item -LiteralPath $Path
  $warnings = New-Object System.Collections.Generic.List[string]

  if ($item.Length -lt 1024) {
    $warnings.Add('suspiciously tiny file')
  }

  if (-not (Test-PngSignature $Path)) {
    $warnings.Add('not a PNG signature')
  }

  $bitmap = [System.Drawing.Bitmap]::FromFile($Path)
  try {
    $width = $bitmap.Width
    $height = $bitmap.Height
    if ($width -lt 64 -or $height -lt 64) {
      $warnings.Add('suspiciously small dimensions')
    }

    $corners = @(
      $bitmap.GetPixel(0, 0),
      $bitmap.GetPixel($width - 1, 0),
      $bitmap.GetPixel(0, $height - 1),
      $bitmap.GetPixel($width - 1, $height - 1)
    )
    $transparentCornerCount = ($corners | Where-Object { $_.A -lt 16 }).Count
    $whiteCornerCount = ($corners | Where-Object { Test-NearWhite $_ }).Count
    if ($transparentCornerCount -lt 4) {
      $warnings.Add('corners are not fully transparent')
    }
    if ($whiteCornerCount -ge 3) {
      $warnings.Add('possible white background')
    }

    $hasAlpha = $false
    $checkerLike = 0
    $samples = 0
    $stepX = [Math]::Max(1, [int]($width / 12))
    $stepY = [Math]::Max(1, [int]($height / 12))
    for ($y = 0; $y -lt $height; $y += $stepY) {
      for ($x = 0; $x -lt $width; $x += $stepX) {
        $pixel = $bitmap.GetPixel($x, $y)
        if ($pixel.A -lt 255) {
          $hasAlpha = $true
        }
        $isLightChecker = $pixel.R -ge 210 -and $pixel.G -ge 210 -and $pixel.B -ge 210
        $isMidChecker = [Math]::Abs($pixel.R - 185) -lt 30 -and [Math]::Abs($pixel.G - 185) -lt 30 -and [Math]::Abs($pixel.B - 185) -lt 30
        if ($pixel.A -gt 245 -and ($isLightChecker -or $isMidChecker)) {
          $checkerLike += 1
        }
        $samples += 1
      }
    }

    if ($checkerLike -gt ($samples * 0.55) -and -not $hasAlpha) {
      $warnings.Add('possible fake checkerboard background')
    }

    $aspect = [Math]::Max($width, $height) / [Math]::Max(1, [Math]::Min($width, $height))
    if ($width -gt 1800 -or $height -gt 1800 -or $aspect -gt 2.3) {
      $warnings.Add('possible multi-building sheet')
    }

    return [pscustomobject]@{
      State = $State
      Slug = $Slug
      Status = 'OK'
      Dimensions = "${width}x${height}"
      Bytes = $item.Length
      HasAlpha = $hasAlpha
      TransparentCorners = "$transparentCornerCount/4"
      Warnings = if ($warnings.Count -gt 0) { $warnings -join '; ' } else { '' }
    }
  } finally {
    $bitmap.Dispose()
  }
}

$reports = foreach ($state in @('ruined', 'renovated')) {
  foreach ($slug in $expected) {
    $path = Join-Path $repoRoot "src/assets/buildings/$state/$slug.png"
    Get-ImageReport -State $state -Slug $slug -Path $path
  }
}

$reports | Format-Table -AutoSize

$missing = @($reports | Where-Object { $_.Status -ne 'OK' })
if ($missing.Count -gt 0) {
  throw "Building asset validation failed: $($missing.Count) missing or invalid file(s)."
}

$warnings = @($reports | Where-Object { $_.Warnings })
if ($warnings.Count -gt 0) {
  Write-Warning "Building asset validation completed with $($warnings.Count) warning(s)."
} else {
  Write-Output 'Building asset validation completed with no warnings.'
}
