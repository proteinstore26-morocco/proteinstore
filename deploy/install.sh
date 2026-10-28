#!/usr/bin/env bash
# ============================================================
#  Installation ProteinStore sur un VPS Ubuntu / Debian
#  À exécuter en root :  sudo bash install.sh
# ============================================================
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST=/opt/proteinstore

# 1. Python3 (déjà présent sur Ubuntu/Debian en général)
if ! command -v python3 >/dev/null; then
  apt-get update -qq && apt-get install -y -qq python3
fi

# 2. Copie de l'application (aucune dépendance pip nécessaire)
mkdir -p "$DEST"
cp -r "$SRC/server.py" "$SRC/public" "$DEST/"
mkdir -p "$DEST/data"

# 3. Service systemd : démarrage auto au boot, redémarrage en cas de crash
cp "$SRC/deploy/proteinstore.service" /etc/systemd/system/
chown -R www-data:www-data "$DEST"
systemctl daemon-reload
systemctl enable --now proteinstore

# 4. Pare-feu : ouvrir le port 8000 si ufw est actif
if command -v ufw >/dev/null && ufw status | grep -q "active"; then
  ufw allow 8000/tcp
fi

sleep 2
IP=$(curl -s --max-time 5 ifconfig.me || echo "VOTRE_IP_SERVEUR")
TOKEN=$(cat "$DEST/data/admin_token.txt" 2>/dev/null || true)

echo
echo "=========================================================="
echo "  Boutique : http://$IP:8000"
echo "  Admin    : http://$IP:8000/admin"
[ -n "$TOKEN" ] && echo "  Token    : $TOKEN"
echo "  (l'URL reste fixe tant que le serveur tourne —"
echo "   contrairement au tunnel trycloudflare sur votre PC)"
echo "=========================================================="
systemctl --no-pager --lines=0 status proteinstore || true
