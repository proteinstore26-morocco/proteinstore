#!/usr/bin/env bash
# Snapshot the shared product photo directory (keeps the last 7 archives).
set -euo pipefail
SRC="${UPLOAD_DIR:-/srv/proteinstore-shared/uploads}"
DEST="${UPLOAD_BACKUP_DIR:-data/backups/uploads}"
if [ ! -d "$SRC" ]; then
  echo "[uploads] no upload directory at $SRC"
  exit 0
fi
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE="$DEST/uploads-$STAMP.tgz"
tar -czf "$ARCHIVE" -C "$(dirname "$SRC")" "$(basename "$SRC")"
ls -1t "$DEST"/uploads-*.tgz 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "[uploads] $ARCHIVE"
