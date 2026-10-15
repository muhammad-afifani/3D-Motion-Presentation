# start.ps1 - server presentasi untuk Windows TANPA Node dan TANPA Python (hanya PowerShell bawaan).
# BELUM DIUJI DI LINGKUNGAN PENGEMBANGAN (dibuat di Linux tanpa PowerShell). Uji di laptop presentasi sebelum hari-H.
# Jalankan:  powershell -ExecutionPolicy Bypass -File start.ps1
# Menyajikan folder app\ di http://localhost:<port>/ dengan MIME type eksplisit (.js -> text/javascript).
# File yang tidak ada -> 404 (bukan index.html palsu).
param([int]$Port = 8080, [switch]$NoOpen)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.svg' = 'image/svg+xml'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.ico' = 'image/x-icon'; '.woff2' = 'font/woff2'
  '.txt' = 'text/plain; charset=utf-8'; '.map' = 'application/json; charset=utf-8'
}
$listener = $null
for ($p = $Port; $p -lt $Port + 20; $p++) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host 'Tidak menemukan port kosong.'; exit 1 }
$url = "http://localhost:$p/"
Write-Host "Server presentasi berjalan: $url"
Write-Host 'Biarkan jendela ini terbuka selama presentasi. Tutup jendela atau tekan Ctrl+C untuk berhenti.'
if (-not $NoOpen) { Start-Process $url }
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $path = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      $file = [System.IO.Path]::GetFullPath((Join-Path $root ($path.TrimStart('/'))))
      if (-not ($file -eq $root -or $file.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase))) { $res.StatusCode = 403; $res.Close(); continue }
      if (Test-Path -LiteralPath $file -PathType Container) { $file = Join-Path $file 'index.html' }
      if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        $res.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("Not found: $path")
        $res.ContentType = 'text/plain; charset=utf-8'
        $res.OutputStream.Write($msg, 0, $msg.Length)
        $res.Close(); continue
      }
      $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.Headers.Add('Cache-Control', 'no-store')
      $bytes = [System.IO.File]::ReadAllBytes($file)
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
    } catch { try { $res.StatusCode = 500; $res.Close() } catch {} }
  }
} finally { $listener.Stop() }
