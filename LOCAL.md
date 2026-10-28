# Lancer le projet réel en local (ce PC) — guide

## Nouveautés du 28/10 (build storefront/back-office)

- **Codes promo salles partenaires** : 9 salles seedées (PSPOWER10, PROFIT15 -15 %,
  PLANET10, ELITE10, ATLAS10, IRON12 -12 %, CROSSBOX10, OLYMPIC10, TITAN15 -15 %).
  Saisie dans le checkout → remise sur le sous-total, tracée sur la commande
  (`discount`, `promo_code`) et dans le message WhatsApp. Éditables dans
  **/admin → Catalogue & partenaires → salles** (code + remise % + actif).
- **Livraison** : Kénitra 20 MAD, autres villes 30 MAD, gratuite dès 500 MAD.
- **Suivi** : `/track-order` accepte le téléphone seul (liste des commandes)
  ou numéro + téléphone (fiche détaillée).
- **Comptes clients** : inscription e-mail avec **confirmation obligatoire** —
  en local, le « mail » est écrit dans `..\supabase-mock\mock-inbox.txt`
  (cliquez le lien /auth/confirm qu'il contient) ; bouton **Continuer avec
  Google** (simulation locale : page fournisseur fake). En production avec le
  vrai Supabase : activer le provider Google + SMTP dans le dashboard.
- Les commandes sont **miroir** vers Supabase (table orders) pour l'admin ;
  la vérité reste le SQLite local (data/proteinstore.db).
- Migration SQL pour la prod : `supabase/migrations/20261028120000_partner_promo_orders.sql`.

## État actuel : ça tourne ✅ (2026-10-28)

Le site tourne sur **http://localhost:5173** avec un **Supabase-mock local**
(données de démonstration, aucun compte cloud requis). Le hero, les produits,
le panier et l'admin fonctionnent.

### Comptes (mock local)

| Rôle | Identifiant | Mot de passe |
|---|---|---|
| **Super admin (root)** | `admin1` (= admin1@proteinestore.ma) | `Protein@321123` |
| Admin | `admin@proteinstore.pro` | `admin123` |
| Client | `client@demo.ma` | `client123` |

À la page `/auth`, tapez simplement `admin1` (l'app complète en
`admin1@proteinestore.ma`, voir `loginToEmail` dans `src/lib/auth.ts`).
Règles rôles : root > admin > manager > customer — seul le root gère les
comptes (`/admin` → utilisateurs), et il ne peut pas se retirer son propre accès.

- Les données de démo vivent dans `..\supabase-mock\data.json`
  (16 produits, 9 catégories, 1 campagne, 4 partenaires salles de sport, 7 avis).
  Supprimez ce fichier pour regénérer le seed (les comptes, eux, sont
  recréés automatiquement par `ensure_mock_users`).

## Comment c'est câblé

- `..\supabase-mock\server.py` (Python stdlib, port 8210) émule l'API Supabase
  utilisée par l'app : PostgREST (filtres `eq/in/order/limit`, embeds
  `category:categories(...)`), Auth (`/auth/v1/token`, `/auth/v1/user`),
  RPC `has_role`, Storage public (placeholders SVG générés).
- `.env` pointe `SUPABASE_URL` / `VITE_SUPABASE_URL` vers `http://127.0.0.1:8210`.
- `IMPORT_ALLOWED_HOSTS=127.0.0.1,localhost` autorise le proxy d'images
  `/api/public/img` à servir les photos du mock.
- `dev.bat` démarre le mock s'il est absent puis lance `bun run dev`.

## Passer aux vraies données Supabase (plus tard)

Dans le dashboard **supabase.com** → votre projet → *Project Settings* → *API* :
- `Project URL` → remplacez les 2 URL dans `.env`
- `anon / publishable key` → remplacez les 2 clés
- Ajoutez le domaine Supabase (ex. `xxxx.supabase.co`) à `IMPORT_ALLOWED_HOSTS`
Puis relancez `dev.bat`. ⚠️ Un projet Supabase free-tier en pause : cliquez "Restore".

## Outils installés sur ce PC (portables, dans ..\tools\)

- **Node 22.23** (`tools\node22`), **Bun 1.4.4** (`tools\bun`), **Git 2.56** (`tools\MinGit`) — tous dans le PATH utilisateur
- Dépendances : `bun install --frozen-lockfile` (fait, 515 paquets)

> ⚠️ `package-lock.json` du dépôt est désynchronisé : utilisez toujours **bun**
> (`bun install`, `bun run dev`, `bun run test`), jamais `npm ci`.

## Tests

- `bun run test` → 76 tests / 16 fichiers (✅ 2026-10-28)
- `python ..\supabase-mock\test_mock.py` → 7 vérifications site+mock (✅)
- `python ..\supabase-mock\test_stability.py` → hero, proxy images, charge parallèle (✅)

## Git

Le dossier est ancré sur l'historique GitHub (`origin/main`). Le zip fourni était
identique à GitHub. Commits locaux en attente de push (clé SSH à ajouter une fois
sur github.com/settings/keys — voir `..\proteinstore-demo\windows\WINDOWS.md`) :
- `ec4272e` dev.bat
- `87015c4` fix crash Response partagée (img proxy)

```bash
git add -A && git commit -m "..." && git push origin main
```

## Fichiers locaux (non poussés)

- `.env` (git-ignoré) — config mock local
- `LOCAL.md` — ce guide

