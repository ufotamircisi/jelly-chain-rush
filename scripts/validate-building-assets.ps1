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

$inspectorCode = @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public sealed class BuildingAssetReport
{
    public string State { get; set; }
    public string Slug { get; set; }
    public string Status { get; set; }
    public string Dimensions { get; set; }
    public long Bytes { get; set; }
    public bool HasAlpha { get; set; }
    public string TransparentCorners { get; set; }
    public string AlphaBounds { get; set; }
    public double ObjectFillPct { get; set; }
    public double CenterOffsetPct { get; set; }
    public bool PossibleMatteRectangle { get; set; }
    public bool ObjectTooSmall { get; set; }
    public bool NonTransparentBackground { get; set; }
    public string Warnings { get; set; }
}

public static class BuildingAssetInspector
{
    public static BuildingAssetReport Missing(string state, string slug)
    {
        return new BuildingAssetReport {
            State = state,
            Slug = slug,
            Status = "MISSING",
            Dimensions = "",
            Bytes = 0,
            HasAlpha = false,
            TransparentCorners = "",
            AlphaBounds = "",
            ObjectFillPct = 0,
            CenterOffsetPct = 100,
            PossibleMatteRectangle = false,
            ObjectTooSmall = true,
            NonTransparentBackground = true,
            Warnings = "missing file"
        };
    }

    public static BuildingAssetReport Analyze(string state, string slug, string path)
    {
        List<string> warnings = new List<string>();
        FileInfo file = new FileInfo(path);
        if (file.Length < 1024) warnings.Add("suspiciously tiny file");
        if (!HasPngSignature(path)) warnings.Add("not a PNG signature");

        using (MemoryStream stream = new MemoryStream(File.ReadAllBytes(path)))
        using (Bitmap source = new Bitmap(stream))
        using (Bitmap bitmap = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb))
        {
            using (Graphics graphics = Graphics.FromImage(bitmap))
            {
                graphics.Clear(Color.Transparent);
                graphics.DrawImage(source, 0, 0, source.Width, source.Height);
            }

            int width = bitmap.Width;
            int height = bitmap.Height;
            int[] pixels = ReadPixels(bitmap);
            bool hasAlpha = false;
            int transparentCorners = 0;
            int minX = width;
            int minY = height;
            int maxX = -1;
            int maxY = -1;
            int visiblePixels = 0;
            int mattePixels = 0;
            int edgePixels = 0;
            int opaqueEdgePixels = 0;

            int[] cornerIndexes = new int[] { 0, width - 1, (height - 1) * width, (height * width) - 1 };
            foreach (int index in cornerIndexes)
            {
                if (Alpha(pixels[index]) < 16) transparentCorners++;
            }

            for (int y = 0; y < height; y++)
            {
                for (int x = 0; x < width; x++)
                {
                    int index = y * width + x;
                    int pixel = pixels[index];
                    int alpha = Alpha(pixel);
                    if (alpha < 255) hasAlpha = true;
                    if (alpha > 16)
                    {
                        visiblePixels++;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        if (IsMatteLike(pixel)) mattePixels++;
                    }
                    if (x == 0 || y == 0 || x == width - 1 || y == height - 1)
                    {
                        edgePixels++;
                        if (alpha > 16) opaqueEdgePixels++;
                    }
                }
            }

            string alphaBounds = "none";
            double objectFillPct = 0;
            double centerOffsetPct = 100;
            if (visiblePixels > 0)
            {
                int boundsWidth = maxX - minX + 1;
                int boundsHeight = maxY - minY + 1;
                alphaBounds = string.Format("{0}x{1}+{2}+{3}", boundsWidth, boundsHeight, minX, minY);
                objectFillPct = Math.Round((Math.Max(boundsWidth, boundsHeight) / (double)Math.Max(width, height)) * 100, 1);
                double objectCenterX = minX + (boundsWidth / 2.0);
                double objectCenterY = minY + (boundsHeight / 2.0);
                double centerOffset = Math.Sqrt(Math.Pow(objectCenterX - (width / 2.0), 2) + Math.Pow(objectCenterY - (height / 2.0), 2));
                centerOffsetPct = Math.Round((centerOffset / Math.Max(width, height)) * 100, 1);
            }
            else
            {
                warnings.Add("no visible object");
            }

            double matteCoveragePct = visiblePixels > 0 ? Math.Round((mattePixels / (double)visiblePixels) * 100, 1) : 0;
            bool possibleMatteRectangle = matteCoveragePct > 35 && objectFillPct > 92;
            bool objectTooSmall = objectFillPct < 72;
            bool objectOffCenter = centerOffsetPct > 7;
            bool nonTransparentBackground = transparentCorners < 4 || opaqueEdgePixels > 0;

            if (!hasAlpha) warnings.Add("alpha channel not present");
            if (transparentCorners < 4) warnings.Add("corners are not fully transparent");
            if (objectTooSmall) warnings.Add("object appears too small for canvas");
            if (objectOffCenter) warnings.Add("object appears off-center");
            if (possibleMatteRectangle) warnings.Add("possible matte rectangle");
            if (nonTransparentBackground) warnings.Add("possible non-transparent background edge");

            return new BuildingAssetReport {
                State = state,
                Slug = slug,
                Status = "OK",
                Dimensions = width + "x" + height,
                Bytes = file.Length,
                HasAlpha = hasAlpha,
                TransparentCorners = transparentCorners + "/4",
                AlphaBounds = alphaBounds,
                ObjectFillPct = objectFillPct,
                CenterOffsetPct = centerOffsetPct,
                PossibleMatteRectangle = possibleMatteRectangle,
                ObjectTooSmall = objectTooSmall,
                NonTransparentBackground = nonTransparentBackground,
                Warnings = string.Join("; ", warnings.ToArray())
            };
        }
    }

    private static bool HasPngSignature(string path)
    {
        byte[] expected = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 };
        byte[] actual = File.ReadAllBytes(path);
        if (actual.Length < expected.Length) return false;
        for (int index = 0; index < expected.Length; index++)
        {
            if (actual[index] != expected[index]) return false;
        }
        return true;
    }

    private static int[] ReadPixels(Bitmap bitmap)
    {
        Rectangle rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            int[] pixels = new int[bitmap.Width * bitmap.Height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            return pixels;
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }

    private static int Alpha(int pixel)
    {
        return (pixel >> 24) & 255;
    }

    private static bool IsMatteLike(int pixel)
    {
        int alpha = Alpha(pixel);
        if (alpha <= 180) return false;
        int red = (pixel >> 16) & 255;
        int green = (pixel >> 8) & 255;
        int blue = pixel & 255;
        int max = Math.Max(red, Math.Max(green, blue));
        int min = Math.Min(red, Math.Min(green, blue));
        return red > 220 && green > 220 && blue > 220 && (max - min) < 36;
    }
}
'@

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition $inspectorCode

$reports = foreach ($state in @('ruined', 'renovated')) {
  foreach ($slug in $expected) {
    $path = Join-Path $repoRoot "src/assets/buildings/$state/$slug.png"
    if (Test-Path -LiteralPath $path) {
      [BuildingAssetInspector]::Analyze($state, $slug, $path)
    } else {
      [BuildingAssetInspector]::Missing($state, $slug)
    }
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
