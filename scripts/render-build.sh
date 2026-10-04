#!/usr/bin/env bash
# Render free tier: no global npm/corepack writes (EROFS on /usr).
set -euo pipefail
PNPM="npx --yes pnpm@10.15.1"
$PNPM install --frozen-lockfile
$PNPM exec prisma generate
$PNPM exec prisma migrate deploy
$PNPM run build
