# Arrete la boutique et le tunnel public sur ce PC
$root = Split-Path -Parent $PSScriptRoot
Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='py.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match 'server\.py' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Remove-Item (Join-Path $root 'data\public_url.txt') -ErrorAction SilentlyContinue
Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'ProteinStore-URL.txt') -ErrorAction SilentlyContinue
Write-Host 'ProteinStore arrete (serveur + tunnel).'
