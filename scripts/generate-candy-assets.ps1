Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$CandyDir = Join-Path $Root 'src/assets/candies'
$SpecialDir = Join-Path $CandyDir 'special'
New-Item -ItemType Directory -Force -Path $CandyDir, $SpecialDir | Out-Null

function New-Canvas {
  $bitmap = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Save-Canvas($canvas, [string]$path) {
  $canvas.Graphics.Flush()
  Remove-WhiteFringe $canvas.Bitmap
  $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

function Remove-WhiteFringe([System.Drawing.Bitmap]$bitmap) {
  for ($y = 0; $y -lt $bitmap.Height; $y++) {
    for ($x = 0; $x -lt $bitmap.Width; $x++) {
      $pixel = $bitmap.GetPixel($x, $y)
      if ($pixel.A -gt 0 -and $pixel.A -lt 60 -and $pixel.R -gt 245 -and $pixel.G -gt 245 -and $pixel.B -gt 245) {
        $bitmap.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
      }
    }
  }
}

function Color([int]$a, [int]$r, [int]$g, [int]$b) {
  return [System.Drawing.Color]::FromArgb($a, $r, $g, $b)
}

function Solid($color) {
  return New-Object System.Drawing.SolidBrush $color
}

function Pen($color, [float]$width) {
  $pen = New-Object System.Drawing.Pen $color, $width
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  return $pen
}

function EllipseBrush([System.Drawing.RectangleF]$rect, $center, $edge) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddEllipse($rect)
  $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush $path
  $brush.CenterColor = $center
  $brush.SurroundColors = @($edge)
  $path.Dispose()
  return $brush
}

function LinearBrush([System.Drawing.RectangleF]$rect, $from, $to, [float]$angle = 90) {
  return New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $from, $to, $angle
}

function Draw-SoftShadow($g, [float]$x, [float]$y, [float]$w, [float]$h) {
  $brush = Solid (Color 42 72 38 108)
  $g.FillEllipse($brush, $x, $y, $w, $h)
  $brush.Dispose()
}

function Draw-Sparkle($g, [float]$x, [float]$y, [float]$s) {
  $pen = Pen (Color 190 255 255 255) ([Math]::Max(2, $s / 5))
  $g.DrawLine($pen, $x - $s, $y, $x + $s, $y)
  $g.DrawLine($pen, $x, $y - $s, $x, $y + $s)
  $pen.Dispose()
}

function StarPoints([float]$cx, [float]$cy, [float]$outer, [float]$inner, [int]$count) {
  $points = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
  for ($i = 0; $i -lt $count * 2; $i++) {
    $radius = if ($i % 2 -eq 0) { $outer } else { $inner }
    $angle = -[Math]::PI / 2 + $i * [Math]::PI / $count
    $points.Add([System.Drawing.PointF]::new(
      [float]($cx + [Math]::Cos($angle) * $radius),
      [float]($cy + [Math]::Sin($angle) * $radius)
    ))
  }
  return $points.ToArray()
}

function RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-GreenBear([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  Draw-SoftShadow $g 68 203 120 22
  $body = RoundedRectPath 72 68 112 124 42
  $brush = EllipseBrush ([System.Drawing.RectangleF]::new(62, 50, 132, 154)) (Color 255 116 245 72) (Color 255 18 150 47)
  $g.FillPath($brush, $body); $brush.Dispose()
  $earBrush = EllipseBrush ([System.Drawing.RectangleF]::new(58, 44, 48, 48)) (Color 255 129 255 88) (Color 255 24 166 50)
  $g.FillEllipse($earBrush, 61, 45, 45, 45); $g.FillEllipse($earBrush, 150, 45, 45, 45); $earBrush.Dispose()
  $stroke = Pen (Color 220 219 255 195) 8; $g.DrawPath($stroke, $body); $stroke.Dispose()
  $body.Dispose()
  $b = Solid (Color 112 255 255 255); $g.FillEllipse($b, 87, 82, 32, 54); $g.FillEllipse($b, 122, 78, 26, 44); $b.Dispose()
  $b = Solid (Color 150 197 255 130); $g.FillEllipse($b, 79, 141, 24, 24); $g.FillEllipse($b, 153, 140, 24, 24); $b.Dispose()
  Draw-Sparkle $g 89 76 10; Draw-Sparkle $g 163 72 8
  Save-Canvas $c $path
}

function Draw-PurpleJelly([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  Draw-SoftShadow $g 62 201 132 20
  $pathObj = RoundedRectPath 57 62 142 122 45
  $brush = LinearBrush ([System.Drawing.RectangleF]::new(57, 48, 142, 140)) (Color 255 247 54 235) (Color 255 106 22 184) 90
  $g.FillPath($brush, $pathObj); $brush.Dispose()
  $pen = Pen (Color 220 255 177 255) 7; $g.DrawPath($pen, $pathObj); $pen.Dispose()
  $pathObj.Dispose()
  $b = Solid (Color 100 255 255 255); $g.FillEllipse($b, 82, 64, 64, 36); $g.FillEllipse($b, 72, 91, 24, 64); $b.Dispose()
  $pen = Pen (Color 95 91 0 135) 7
  foreach ($x in 91, 128, 164) { $g.DrawLine($pen, $x, 162, $x + 5, 184) }
  $pen.Dispose()
  Save-Canvas $c $path
}

function Draw-RedHeart([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  Draw-SoftShadow $g 63 200 130 22
  $heart = New-Object System.Drawing.Drawing2D.GraphicsPath
  $heart.AddBezier(128, 202, 48, 135, 45, 70, 93, 61)
  $heart.AddBezier(93, 61, 111, 58, 122, 68, 128, 83)
  $heart.AddBezier(128, 83, 134, 68, 145, 58, 163, 61)
  $heart.AddBezier(163, 61, 211, 70, 208, 135, 128, 202)
  $heart.CloseFigure()
  $brush = EllipseBrush ([System.Drawing.RectangleF]::new(45, 52, 166, 156)) (Color 255 255 82 92) (Color 255 181 12 42)
  $g.FillPath($brush, $heart); $brush.Dispose()
  $pen = Pen (Color 225 255 194 203) 8; $g.DrawPath($pen, $heart); $pen.Dispose()
  $heart.Dispose()
  $b = Solid (Color 112 255 255 255); $g.FillEllipse($b, 82, 74, 43, 31); $b.Dispose()
  Draw-Sparkle $g 96 78 9
  Save-Canvas $c $path
}

function Draw-StarCandy([string]$path, [bool]$energy = $false) {
  $c = New-Canvas; $g = $c.Graphics
  Draw-SoftShadow $g 62 202 132 20
  $points = StarPoints 128 124 82 39 5
  if ($energy) {
    $brush = EllipseBrush ([System.Drawing.RectangleF]::new(43, 38, 170, 174)) (Color 255 196 255 255) (Color 255 24 213 233)
    $strokeColor = Color 235 255 255 255
  } else {
    $brush = EllipseBrush ([System.Drawing.RectangleF]::new(45, 38, 168, 174)) (Color 255 255 232 69) (Color 255 236 143 9)
    $strokeColor = Color 225 255 248 183
  }
  $g.FillPolygon($brush, $points); $brush.Dispose()
  $pen = Pen $strokeColor 8; $g.DrawPolygon($pen, $points); $pen.Dispose()
  if ($energy) {
    $pen = Pen (Color 170 255 255 255) 5
    $g.DrawLine($pen, 128, 64, 106, 126)
    $g.DrawLine($pen, 106, 126, 139, 126)
    $g.DrawLine($pen, 139, 126, 120, 186)
    $pen.Dispose()
  }
  $b = Solid (Color 112 255 255 255); $g.FillEllipse($b, 91, 75, 34, 28); $b.Dispose()
  Draw-Sparkle $g 91 88 11
  Save-Canvas $c $path
}

function Draw-BlueCandy([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  Draw-SoftShadow $g 63 204 130 22
  $brush = EllipseBrush ([System.Drawing.RectangleF]::new(47, 45, 162, 162)) (Color 255 99 216 255) (Color 255 0 99 219)
  $g.FillEllipse($brush, 50, 48, 156, 156); $brush.Dispose()
  $pen = Pen (Color 220 213 242 255) 8; $g.DrawEllipse($pen, 50, 48, 156, 156); $pen.Dispose()
  $b = Solid (Color 110 255 255 255); $g.FillEllipse($b, 80, 72, 54, 38); $b.Dispose()
  $b = Solid (Color 60 16 67 190); $g.FillEllipse($b, 107, 124, 72, 50); $b.Dispose()
  Save-Canvas $c $path
}

function Draw-OrangeBean([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  $g.TranslateTransform(128, 128); $g.RotateTransform(-25); $g.TranslateTransform(-128, -128)
  Draw-SoftShadow $g 55 196 146 20
  $brush = EllipseBrush ([System.Drawing.RectangleF]::new(42, 72, 172, 108)) (Color 255 255 190 78) (Color 255 236 91 20)
  $g.FillEllipse($brush, 43, 72, 170, 104); $brush.Dispose()
  $pen = Pen (Color 220 255 225 186) 7; $g.DrawEllipse($pen, 43, 72, 170, 104); $pen.Dispose()
  $b = Solid (Color 100 255 255 255); $g.FillEllipse($b, 79, 89, 69, 25); $b.Dispose()
  $g.ResetTransform()
  Save-Canvas $c $path
}

function Draw-Lollipop([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  $pen = Pen (Color 245 255 255 255) 12; $g.DrawLine($pen, 146, 152, 184, 224); $pen.Dispose()
  $pen = Pen (Color 150 232 159 193) 4; $g.DrawLine($pen, 146, 152, 184, 224); $pen.Dispose()
  $brush = EllipseBrush ([System.Drawing.RectangleF]::new(46, 33, 146, 146)) (Color 255 255 141 214) (Color 255 222 43 157)
  $g.FillEllipse($brush, 48, 34, 144, 144); $brush.Dispose()
  $pen = Pen (Color 230 255 218 243) 8; $g.DrawEllipse($pen, 48, 34, 144, 144); $pen.Dispose()
  $pen = Pen (Color 215 255 255 255) 16
  $g.DrawArc($pen, 77, 64, 86, 86, 210, 265)
  $pen.Dispose()
  $pen = Pen (Color 185 255 83 183) 11
  $g.DrawArc($pen, 81, 69, 76, 76, 218, 250)
  $pen.Dispose()
  $b = Solid (Color 92 255 255 255); $g.FillEllipse($b, 82, 59, 42, 27); $b.Dispose()
  Save-Canvas $c $path
}

function Draw-RainbowCandy([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  Draw-SoftShadow $g 54 203 148 20
  $body = RoundedRectPath 52 70 152 104 45
  $clip = $g.Clip
  $g.SetClip($body)
  $colors = @(
    (Color 255 255 71 84), (Color 255 255 156 42), (Color 255 255 231 66),
    (Color 255 72 213 98), (Color 255 49 166 255), (Color 255 160 72 229)
  )
  for ($i = 0; $i -lt $colors.Count; $i++) {
    $b = Solid $colors[$i]
    $g.FillRectangle($b, 52 + $i * 26, 66, 28, 114)
    $b.Dispose()
  }
  $g.Clip = $clip
  $pen = Pen (Color 230 255 255 255) 8; $g.DrawPath($pen, $body); $pen.Dispose()
  $body.Dispose()
  $b = Solid (Color 95 255 255 255); $g.FillEllipse($b, 75, 79, 82, 24); $b.Dispose()
  Save-Canvas $c $path
}

function Draw-ColorBomb([string]$path) {
  $c = New-Canvas; $g = $c.Graphics
  Draw-SoftShadow $g 58 207 140 22
  $brush = EllipseBrush ([System.Drawing.RectangleF]::new(54, 58, 146, 146)) (Color 255 93 57 133) (Color 255 43 24 84)
  $g.FillEllipse($brush, 55, 59, 144, 144); $brush.Dispose()
  $pen = Pen (Color 225 255 205 92) 7; $g.DrawEllipse($pen, 55, 59, 144, 144); $pen.Dispose()
  $sprinkles = @(
    @(92, 94, 255, 77, 105), @(126, 82, 255, 231, 68), @(155, 110, 75, 210, 255),
    @(101, 144, 255, 130, 210), @(144, 156, 105, 255, 105), @(128, 123, 255, 255, 255)
  )
  foreach ($s in $sprinkles) {
    $b = Solid (Color 255 $s[2] $s[3] $s[4])
    $g.FillEllipse($b, $s[0], $s[1], 13, 13)
    $b.Dispose()
  }
  $pen = Pen (Color 235 255 181 47) 8
  $g.DrawLine($pen, 158, 57, 180, 29)
  $pen.Dispose()
  $b = Solid (Color 255 255 88 31); $g.FillEllipse($b, 173, 20, 28, 28); $b.Dispose()
  $b = Solid (Color 120 255 255 255); $g.FillEllipse($b, 86, 80, 47, 34); $b.Dispose()
  Save-Canvas $c $path
}

Draw-GreenBear (Join-Path $CandyDir 'yesil_jelibon_ayicik.png')
Draw-PurpleJelly (Join-Path $CandyDir 'mor_jelibon.png')
Draw-RedHeart (Join-Path $CandyDir 'kirmizi_kalp.png')
Draw-StarCandy (Join-Path $CandyDir 'sari_yildiz.png') $false
Draw-BlueCandy (Join-Path $CandyDir 'mavi_seker.png')
Draw-OrangeBean (Join-Path $CandyDir 'turuncu_jelly_bean.png')
Draw-Lollipop (Join-Path $CandyDir 'pembe_lollipop.png')
Draw-RainbowCandy (Join-Path $CandyDir 'gokkusagi_seker.png')
Draw-StarCandy (Join-Path $SpecialDir 'enerji_yildizi.png') $true
Draw-ColorBomb (Join-Path $SpecialDir 'renk_bombasi.png')

Write-Host "Generated candy asset pack in $CandyDir"
