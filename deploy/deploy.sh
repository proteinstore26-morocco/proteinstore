#!/usr/bin/env bash
# Rebuild + restart the isolated Protein Store service, then smoke-test it.
# Never touches any other unit on this host.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> install"
NODE_ENV=development npm install --legacy-peer-deps --include=dev --no-audit --no-fund

echo "==> verify"
npx tsc --noEmit
npm test

echo "==> build"
rm -rf .output.prev
[ -d .output ] && cp -a .output .output.prev
npm run build

echo "==> restart (our unit only)"
systemctl restart proteinstore
sleep 2
systemctl is-active proteinstore

echo "==> smoke"
node scripts/smoke.mjs "https://proteinstore.46.225.2.52.sslip.io"
