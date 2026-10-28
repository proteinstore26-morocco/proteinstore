# Déploiement sur ce PC Windows 11 (hébergement maison)

La boutique tourne **sur votre PC** et reste accessible sur Internet via un tunnel
Cloudflare (chiffré, aucun port ouvert sur votre box).

## Ce qui est installé

Une tâche planifiée Windows **« ProteinStore »** démarre automatiquement à chaque
ouverture de votre session :

1. le serveur Python (port 8000, fenêtre cachée),
2. le tunnel public `cloudflared`,
3. l'URL publique est écrite dans **`ProteinStore-URL.txt` sur le Bureau** (et dans `data\public_url.txt`).

Vérification : `schtasks /query /tn ProteinStore`

## Commandes utiles (dans le dossier `windows\`)

```powershell
# Démarrer maintenant (aussi fait automatiquement au login)
powershell -ExecutionPolicy Bypass -File .\start-proteinstore.ps1

# Tout arrêter (serveur + tunnel)
powershell -ExecutionPolicy Bypass -File .\stop-proteinstore.ps1

# Désactiver le démarrage automatique
powershell -ExecutionPolicy Bypass -File .\uninstall-autostart.ps1
```

## Les 3 règles pour que le site reste en ligne

1. **Le PC doit rester allumé** — c'est votre serveur maintenant.
2. **Empêchez la mise en veille** (le tunnel meurt en veille) :
   ```powershell
   powercfg /change standby-timeout-ac 0
   ```
   (l'écran peut se mettre en veille, pas le PC). Idem : ne pas activer l'hibernation.
3. **L'URL change à chaque redémarrage du PC** — c'est la limite du tunnel gratuit
   « quick ». L'URL à jour est toujours dans `ProteinStore-URL.txt` sur le Bureau.

## Avoir une URL FIXE (https://test.votre-domaine.pro)

Le quick tunnel est gratuit mais éphémère. Pour une adresse fixe il faut un
**tunnel nommé** Cloudflare : gratuit lui aussi, mais nécessite un domaine
ajouté sur Cloudflare (ex. `proteinestore.pro`, ~10 €/an chez un registrar).

Suivez [`NAMED-TUNNEL.md`](NAMED-TUNNEL.md) — à la fin, `cloudflared` devient un
service Windows (démarre au boot, avant même le login) et l'URL ne change plus jamais.

## Sécurité

- Le tunnel sortant ne nécessite **aucune ouverture de port** sur la box : rien
  n'est accessible directement depuis Internet hors du tunnel.
- L'admin est protégé par le token dans `data\admin_token.txt` (à changer si besoin :
  variable d'environnement `ADMIN_TOKEN` ou fichier).
- Limites à connaître : connexions illimitées mais **aucun SLA** (PC éteint = site
  hors ligne) et débit limité par votre connexion internet (upload de la box).

## Et si le PC doit s'éteindre ?

C'est la limite physique d'un hébergement maison. Pour du 24/7 : VPS — voir
[`deploy/DEPLOY.md`](../deploy/DEPLOY.md) (récupération de votre ancien serveur
Hetzner, ou location ~4,50 €/mois, installation en une commande).
