Add-Type -AssemblyName System.Drawing

function Make-PokeballPng([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

    # Solid dark background
    $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 8, 22))

    $pad  = [int]($size * 0.08)
    $diam = $size - $pad * 2
    $cx   = [float]($size / 2)
    $cy   = [float]($size / 2)

    # Top half - electric blue
    $topBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(255, 26, 107, 255))
    $g.FillPie($topBrush, $pad, $pad, $diam, $diam, 180, 180)

    # Bottom half - light lavender
    $botBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(255, 225, 220, 255))
    $g.FillPie($botBrush, $pad, $pad, $diam, $diam, 0, 180)

    # Middle band
    $bandH    = [int]($size * 0.09)
    $darkBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(255, 11, 8, 22))
    $g.FillRectangle($darkBrush, $pad, $cy - $bandH/2, $diam, $bandH)

    # Outline
    $penW = [float]([Math]::Max(2.0, $size * 0.025))
    $outlinePen = New-Object System.Drawing.Pen(
        [System.Drawing.Color]::FromArgb(255, 11, 8, 22), $penW)
    $g.DrawEllipse($outlinePen, $pad, $pad, $diam, $diam)

    # Center button - dark ring
    $btnR  = [float]($size * 0.13)
    $g.FillEllipse($darkBrush, $cx - $btnR, $cy - $btnR, $btnR * 2, $btnR * 2)

    # Center button - light fill
    $innerR = [float]($size * 0.085)
    $wBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(255, 235, 232, 255))
    $g.FillEllipse($wBrush, $cx - $innerR, $cy - $innerR, $innerR * 2, $innerR * 2)

    # Highlight dot
    $hlR = [float]($size * 0.03)
    $hlBrush = New-Object System.Drawing.SolidBrush(
        [System.Drawing.Color]::FromArgb(200, 255, 255, 255))
    $g.FillEllipse($hlBrush, $cx - $hlR * 1.8, $cy - $hlR * 1.9, $hlR * 1.5, $hlR * 1.2)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $sz = (Get-Item $path).Length
    Write-Host "Saved $([System.IO.Path]::GetFileName($path)) ($sz bytes)"
}

$dir = "C:\Users\wm01188\Privat\PCPT\app\public\icons"
Make-PokeballPng 180 "$dir\apple-touch-icon.png"
Make-PokeballPng 192 "$dir\icon-192.png"
Make-PokeballPng 512 "$dir\icon-512.png"

Copy-Item "$dir\apple-touch-icon.png" "C:\Users\wm01188\Privat\PCPT\app\public\apple-touch-icon.png" -Force
Write-Host "All done"
