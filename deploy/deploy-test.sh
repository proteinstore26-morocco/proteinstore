#!/usr/bin/env bash
# Rebuild + restart the isolated TEST instance. Does not touch production.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> build"
npm run build

echo "==> backup test orders"
node scripts/backup-orders.mjs
./scripts/backup-uploads.sh

echo "==> restart test unit"
systemctl restart proteinstore-test
sleep 2
systemctl is-active proteinstore-test

echo "==> smoke"
node scripts/smoke.mjs "https://test.proteinstore.46.225.2.52.sslip.io"
