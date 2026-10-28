# URL fixe avec un tunnel nommé Cloudflare (gratuit)

Contre l'inconvénient principal du quick tunnel (URL qui change à chaque reboot),
le **tunnel nommé** donne une adresse permanente type `https://test.proteinestore.pro`.

## Prérequis

- Un **domaine** (ex. `proteinestore.pro`) ajouté (gratuit) sur Cloudflare :
  compte sur dash.cloudflare.com → "Add a site" → suivre l'assistant
  (ils donnent 2 serveurs DNS à configurer chez votre registrar).
- `cloudflared.exe` déjà présent dans `..\tools\` (fait).

## Étapes (PowerShell, une seule fois)

```powershell
cd C:\Users\nitro\.zcode\workspace\draft-4a72fee6-090b-4113-854c-dc09179a4706\tools

# 1. Connexion au compte Cloudflare (ouvre le navigateur, choisir le domaine)
.\cloudflared.exe tunnel login

# 2. Créer le tunnel (note l'UUID affiché)
.\cloudflared.exe tunnel create proteinstore

# 3. Fichier de configuration
notepad $env:USERPROFILE\.cloudflared\config.yml
```

Contenu de `config.yml` (remplacez l'UUID et le hostname) :

```yaml
tunnel: UUID_DU_TUNNEL
credentials-file: C:\Users\nitro\.cloudflared\UUID_DU_TUNNEL.json
ingress:
  - hostname: test.proteinestore.pro
    service: http://localhost:8000
  - service: http_status:404
```

```powershell
# 4. Enregistrer le nom DNS (crée l'enregistrement CNAME tout seul)
.\cloudflared.exe tunnel route dns proteinstore test.proteinestore.pro

# 5. Installer cloudflared comme SERVICE WINDOWS :
#    démarre tout seul au boot, avant même l'ouverture de session
.\cloudflared.exe service install
Start-Service cloudflared
```

Le site est ensuite en permanence sur `https://test.proteinestore.pro`.

## Après le passage au tunnel nommé

- La tâche planifiée « ProteinStore » **reste utile** : elle démarre le serveur
  Python au login. Le script `start-proteinstore.ps1` détecte cloudflared déjà
  actif (le service) et ne lance pas de second tunnel.
- Pour arrêter le service : `Stop-Service cloudflared`
  Pour le désinstaller : `.\cloudflared.exe service uninstall`
