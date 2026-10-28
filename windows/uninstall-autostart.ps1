# Supprime le demarrage automatique de ProteinStore
Unregister-ScheduledTask -TaskName 'ProteinStore' -Confirm:$false -ErrorAction SilentlyContinue
Write-Host 'Tache planifiee "ProteinStore" supprimee (le site ne demarrera plus au login).'
Write-Host 'Pour arreter la boutique maintenant : .\stop-proteinstore.ps1'
