# ProteinStore — boutique de démonstration (Kénitra, Maroc)

Recréation autonome du projet [proteinstore26-morocco/proteinstore](https://github.com/proteinstore26-morocco/proteinstore) : boutique de nutrition sportive avec paiement à la livraison via WhatsApp, suivi de commande et tableau de bord admin.

**Zéro dépendance** : Python 3.12 standard uniquement + SQLite intégrée. Aucun npm, aucun Supabase, aucun service externe.

## Lancer

```bash
python server.py
# → http://127.0.0.1:8000        (boutique)
# → http://127.0.0.1:8000/admin  (tableau de bord)
```

Le token admin est généré au premier lancement : affiché dans la console et sauvegardé dans `data/admin_token.txt`. Surchargable avec `ADMIN_TOKEN=...`.

Variables : `PORT` (8000 par défaut), `HOST` (127.0.0.1), `ADMIN_TOKEN`.

## Fonctionnalités

- **Boutique** : catalogue (16 produits, catégories, recherche), fiche produit avec choix du goût, panier persistant (localStorage), livraison gratuite dès 500 DH.
- **Commande** : paiement à la livraison, numéro `PS-AAAA-NNNNN`, validation serveur (téléphone marocain, stock, prix calculés côté serveur), message WhatsApp pré-rempli vers +212 776 566 089.
- **Suivi** : `/#/suivi` — numéro de commande → timeline pending → confirmed → shipped → delivered.
- **Admin** : `/admin` (token) — statistiques CA, filtres par statut, changement de statut, lien WhatsApp client par commande.
- **API** : `/api/products`, `/api/orders` (POST), `/api/orders/<numéro>`, `/api/admin/*` (en-tête `X-Admin-Token`).

## Données

`data/store.db` (SQLite, mode WAL) — produits (seed au premier lancement), commandes, lignes de commande. Supprimez le fichier pour repartir de zéro.

## Déploiement 24/7 sur VPS

Voir [`deploy/DEPLOY.md`](deploy/DEPLOY.md) : location/récupération d'un VPS Hetzner, envoi par `scp`, installation en une commande (`install.sh` + service systemd auto-démarré), HTTPS optionnel via Caddy.

## Déploiement sur ce PC (Windows 11)

Voir [`windows/WINDOWS.md`](windows/WINDOWS.md) : démarrage automatique à l'ouverture de session (tâche planifiée), URL publique écrite sur le Bureau, tunnel nommé pour une URL fixe (`windows/NAMED-TUNNEL.md`).
