# ============================================================
#  ProteinStore - demarrage sur ce PC.
#  Par defaut : LOCAL uniquement (http://localhost:8000)
#  Avec -Public : ouvre aussi un tunnel Internet public
#  (la tache planifiee au login utilise le mode local)
# ============================================================
param([switch]$Public)
$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot   # dossier proteinstore-demo
$data = Join-Path $root 'data'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$desktop = [Environment]::GetFolderPath('Desktop')
$desktopFile = Join-Path $desktop 'ProteinStore-URL.txt'
$urlFile = Join-Path $data 'public_url.txt'

# --- 1. Serveur Python (cache) -------------------------------
$listening = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  $py = (Get-Command python -ErrorAction SilentlyContinue).Source
  if ($py) { Start-Process -FilePath $py -ArgumentList 'server.py' -WorkingDirectory $root -WindowStyle Hidden }
  else { Start-Process -FilePath 'py' -ArgumentList '-3','server.py' -WorkingDirectory $root -WindowStyle Hidden }
  Start-Sleep -Seconds 2
}

if (-not $Public) {
  # --- Mode LOCAL : URL fixe, aucun tunnel -------------------
  Set-Content -Path $urlFile -Encoding ASCII -Value @"
Boutique ProteinStore - TEST LOCAL
URL locale : http://localhost:8000
Admin      : http://localhost:8000/admin
(token admin : data\admin_token.txt)

Pas de tunnel public. Pour partager sur Internet temporairement :
  powershell -ExecutionPolicy Bypass -File windows\start-proteinstore.ps1 -Public
"@
  Copy-Item $urlFile $desktopFile -Force
  exit 0
}

# --- 2. Mode PUBLIC : tunnel Cloudflare ----------------------
$tunnelRunning = Get-Process -Name 'cloudflared' -ErrorAction SilentlyContinue
if (-not $tunnelRunning) {
  $cloudflared = Join-Path (Split-Path -Parent $root) 'tools\cloudflared.exe'
  $logErr = Join-Path $data 'tunnel.err.log'
  $logOut = Join-Path $data 'tunnel.out.log'
  Remove-Item $logErr, $logOut -ErrorAction SilentlyContinue
  Start-Process -FilePath $cloudflared `
    -ArgumentList 'tunnel','--url','http://127.0.0.1:8000' `
    -WindowStyle Hidden -RedirectStandardError $logErr -RedirectStandardOutput $logOut

  $url = $null
  for ($i = 0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $logErr) {
      $m = Select-String -Path $logErr -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($m) { $url = $m.Matches[0].Value; break }
    }
  }
  if ($url) {
    Set-Content -Path $urlFile -Encoding ASCII -Value @"
Boutique ProteinStore - TEST PUBLIC
URL     : $url
Admin   : $url/admin
(Valide tant que ce PC est allume. Nouvelle URL a chaque lancement du tunnel.)
"@
    Copy-Item $urlFile $desktopFile -Force
  }
}
