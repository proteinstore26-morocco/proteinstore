# Sauvegarde locale — ProteinStore (branche local-backup)

Contenu (git-ignoré sur main, sauvegardé ici volontairement) :
- `.env` — configuration locale (mock Supabase, AUCUNE clé de production)
- `data/backup.db` — base SQLite complète (produits, commandes, comptes, photos référencées)
- `data/admin_token.txt` — token admin local
- `data/uploads/` — photos produits / catégories / partenaires

## Restaurer

1. Copier `backup.db` → `data/proteinstore.db` (serveur arrêté)
2. Copier `.env` → racine du projet
3. Copier `uploads/*` → `data/uploads/`
4. Redémarrer : `dev.bat`

⚠️ Ne JAMAIS pousser ici les vraies clés Supabase de production. Le repo est public.
