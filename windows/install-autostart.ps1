# Cree la tache planifiee "ProteinStore" :
# la boutique + le tunnel public demarrent automatiquement
# a chaque ouverture de session Windows (aucune fenetre visible).
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $here 'start-proteinstore.ps1'

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument ("-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`"")
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName 'ProteinStore' -Action $action -Trigger $trigger `
  -Settings $settings -Force -Description 'ProteinStore : serveur + tunnel public au login' | Out-Null

if ($?) {
  Write-Host 'OK : tache planifiee "ProteinStore" creee.'
  Write-Host 'La boutique demarrera automatiquement a chaque ouverture de session.'
  Write-Host "L'URL publique sera sur le Bureau : ProteinStore-URL.txt"
  Write-Host ''
  Write-Host 'Conseil : empechez la mise en veille du PC sinon le site sera hors ligne :'
  Write-Host '  powercfg /change standby-timeout-ac 0'
} else {
  Write-Host 'ECHEC de la creation de la tache (droits administrateur requis ?)'
}
