# Déploiement sur un serveur (VPS) — guide pas à pas

> ## ⚠️ Cas particulier Hostinger (et hébergements mutualisés)
>
> L'offre **mutualisée** Hostinger (« Premium », « Business »…) exécute uniquement du
> **PHP** : cette application **Python ne fonctionnera pas dessus**. Deux options :
>
> 1. **Hostinger VPS** (offre « KVM 1 », ~4-5 €/mois) — recommandé. Choisissez le
>    template **Ubuntu 24.04** à la création, notez l'IP et le mot de passe root,
>    puis suivez exactement les étapes 1-2 ci-dessous.
> 2. Un hébergement mutualisé qui propose **« Setup Python App »** (cPanel/Passenger,
>    ex. certains plans Namecheap, A2, o2switch) — l'application fonctionne avec un
>    petit fichier `passenger_wsgi.py` (demandez-le-moi).
>
> Dans les deux cas, le domaine `proteinstore.pro` se branche ensuite en 2 minutes :
> enregistrement DNS `A` → IP du serveur, puis le bloc Caddy de l'étape 3 pour le HTTPS.

Objectif : le site tourne **24/7 sur un serveur avec IP publique fixe**, indépendant de votre PC.
L'application n'a besoin que de Python 3 (préinstallé sur Ubuntu) — aucun npm, aucune base à installer.

---

## Étape 0 — Obtenir un VPS (2 choix)

### Choix A : récupérer l'ancien serveur Hetzner (gratuit, il tourne encore !)
Votre ancien site (`46.225.2.52`) est un **Hetzner Cloud** (datacenter Nuremberg) et il sert
encore la boutique. Il suffit de récupérer l'accès au compte :

1. Allez sur **https://console.hetzner.cloud** → "Forgot password" avec l'email utilisé à l'époque.
2. Si vous n'avez plus accès à l'email : écrivez à **support@hetzner.com** (ou via https://console.hetzner.cloud/support)
   en indiquant l'IP `46.225.2.52` — ils rétablissent l'accès après vérification du moyen de paiement
   (4 derniers chiffres de la carte / facture PayPal).
3. Une fois connecté : le serveur apparaît dans le projet. Utilisez l'onglet "Rescue" ou
   créez une nouvelle clé SSH, puis passez à l'étape 2.

### Choix B : louer un nouveau VPS (~4-6 €/mois)
Chez n'importe quel hébergeur, par exemple :
- **Hetzner Cloud** (console.hetzner.cloud) — CX22 à ~4,5 €/mois, très fiable
- Contabo, OVH, DigitalOcean, Scaleway…

À la création, choisissez **Ubuntu 24.04** et notez l'**IP publique** + mot de passe root
(ou ajoutez votre clé SSH depuis `C:\Users\nitro\.ssh\`).

---

## Étape 1 — Envoyer l'application vers le serveur

Depuis PowerShell sur ce PC (remplacez `IP_DU_SERVEUR`) :

```powershell
scp -r "C:\Users\nitro\.zcode\workspace\draft-4a72fee6-090b-4113-854c-dc09179a4706\proteinstore-demo" root@IP_DU_SERVEUR:/opt/
```

(La commande `scp` est incluse dans Windows 10/11. Le premier `ssh` demande de confirmer
l'empreinte : tapez `yes`.)

## Étape 2 — Installer et démarrer

```powershell
ssh root@IP_DU_SERVEUR
```

Puis sur le serveur :

```bash
bash /opt/proteinstore-demo/deploy/install.sh
```

Le script installe le service systemd, démarre la boutique et affiche :

- `http://IP_DU_SERVEUR:8000` — la boutique
- `http://IP_DU_SERVEUR:8000/admin` — le tableau de bord
- le token admin (aussi dans `/opt/proteinstore/data/admin_token.txt`)

C'est tout. Le site :
- redémarre tout seul en cas de crash (`Restart=always`),
- démarre tout seul au reboot du serveur,
- garde son URL fixe tant que le serveur existe.

---

## Étape 3 (optionnel) — HTTPS avec un vrai domaine

Avec votre domaine (ex. `proteinestore.pro`), enregistrement DNS `A` → IP du serveur, puis :

```bash
apt-get install -y caddy
cat > /etc/caddy/Caddyfile <<'EOF'
votre-domaine.pro {
    reverse_proxy 127.0.0.1:8000
}
EOF
systemctl reload caddy
```

Caddy obtient et renouvelle le certificat HTTPS tout seul.
Astuce sans domaine : `http://proteinstore.IP_DU_SERVEUR.sslip.io:8000` fonctionne immédiatement
(comme votre ancienne URL de test).

---

## Mise à jour de l'application plus tard

```powershell
scp -r "...\proteinstore-demo\server.py" "...\proteinstore-demo\public" root@IP_DU_SERVEUR:/opt/proteinstore/
ssh root@IP_DU_SERVEUR "systemctl restart proteinstore"
```

## Commandes utiles sur le serveur

```bash
systemctl status proteinstore     # état du service
journalctl -u proteinstore -f     # logs en direct
systemctl restart proteinstore    # redémarrer
ls /opt/proteinstore/data/        # base SQLite + token admin
```

---

## Alternative 100 % gratuite (contraintes)

- **Oracle Cloud "Always Free"** : un vrai VPS gratuit à vie (ARM 4 cœurs) — même installation
  que ci-dessus. Inconvénient : inscription avec carte bancaire pour vérification.
- **PythonAnywhere (compte gratuit)** : URL fixe `votrenom.pythonanywhere.com`, mais nécessite
  d'adapter le serveur en WSGI et performances limitées.
- Le tunnel Cloudflare sur ce PC (solution actuelle) reste utile pour tester **sans rien louer**,
  tant que le PC reste allumé.
